import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  BrainCircuit,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Database,
} from 'lucide-react';
import { repository } from '@/data/repository';
import { secretsAdapter } from '@/lib/secrets';
import { useSettingsStore } from '@/store/settingsStore';
import { requestQueue, type TodayUsageStats } from '@/lib/gemini/requestQueue';
import { runAgentTurn } from '@/lib/gemini/agent/agentLoop';
import type { ChatMessage, MemoryProposalRecord } from '@/lib/gemini/agent/types';
import { MemoryManager } from './components/MemoryManager';
import { APP_NAME } from '@/constants/app';

const SUGGESTED_PROMPTS = [
  'Summarise this week',
  'Where did I overspend this quarter?',
  'Can I afford a ₹15,000 purchase?',
  'What are my recurring monthly commitments?',
];

// Lightweight Markdown Formatter
const MarkdownView: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Heading 3
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-sm sm:text-base text-deep-blue-950 dark:text-cream-50 mt-2">
              {formatInline(trimmed.slice(4))}
            </h4>
          );
        }

        // Heading 2
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-base text-deep-blue-950 dark:text-cream-50 mt-3 pb-1 border-b border-cream-200 dark:border-dark-border">
              {formatInline(trimmed.slice(3))}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-deep-blue-400 dark:text-cream-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-deep-blue-500 dark:bg-cream-300 flex-shrink-0" />
              <span>{formatInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-semibold text-deep-blue-700 dark:text-cream-300 flex-shrink-0">
                {numMatch[1]}.
              </span>
              <span>{formatInline(numMatch[2] || '')}</span>
            </div>
          );
        }

        return <p key={idx}>{formatInline(trimmed)}</p>;
      })}
    </div>
  );
};

// Inline bold/code parser
function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-deep-blue-950 dark:text-cream-50">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-cream-200/60 dark:bg-dark-elevated font-mono text-[11px] text-deep-blue-900 dark:text-cream-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export const AssistantPage: React.FC = () => {
  const { settings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello! I am your ${APP_NAME} quantitative financial strategist.
I reason directly over your local IndexedDB ledger using code calculation tools (\`query_transactions\`, \`aggregate\`, \`compare_periods\`, \`get_budget_status\`).
All calculations are deterministic and verified against your local records. How can I assist you?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usageStats, setUsageStats] = useState<TodayUsageStats | null>(null);
  const [expandedToolIndex, setExpandedToolIndex] = useState<string | null>(null);
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadUsage = async () => {
    try {
      const stats = await requestQueue.getTodayUsage();
      setUsageStats(stats);
    } catch (e) {
      console.warn('Failed to load quota stats:', e);
    }
  };

  useEffect(() => {
    requestQueue.updateBudgets(settings.dailyAiBudgetHeavy ?? 20, settings.dailyAiBudgetLight ?? 200);
    requestQueue.setConfiguredModels(settings.geminiHeavyModel, settings.geminiLightModel);
    loadUsage();
  }, [settings.dailyAiBudgetHeavy, settings.dailyAiBudgetLight, settings.geminiHeavyModel, settings.geminiLightModel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const apiKey = (await secretsAdapter.getApiKey()) || settings.geminiApiKey || '';

      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `⚠️ **Gemini API Key Missing**: Please configure your Google AI Studio key in [Settings](/settings) to enable agentic chat with tool reasoning.`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Convert prior conversation history
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const result = await runAgentTurn(
        {
          userQuery: trimmed,
          history,
          apiKey,
          model: settings.geminiLightModel || 'gemini-3.5-flash-lite',
          privacyMode: settings.privacyMode,
        },
        repository
      );

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: result.text,
        timestamp: new Date().toISOString(),
        toolExecutions: result.toolExecutions,
        proposals: result.proposals,
        modelUsed: result.modelUsed,
      };

      // Initialize proposal statuses
      if (result.proposals && result.proposals.length > 0) {
        setProposalStatuses((prev) => {
          const next = { ...prev };
          for (const p of result.proposals) {
            next[p.memoryId] = 'pending';
          }
          return next;
        });
      }

      setMessages((prev) => [...prev, assistantMsg]);
      await loadUsage();
    } catch (err: unknown) {
      console.error('Agent error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `An error occurred while reasoning over your request: ${msg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveProposal = async (proposal: MemoryProposalRecord) => {
    try {
      await repository.approveMemoryItem(proposal.memoryId);
      setProposalStatuses((prev) => ({ ...prev, [proposal.memoryId]: 'approved' }));
    } catch (e) {
      console.error('Failed to approve memory:', e);
    }
  };

  const handleRejectProposal = async (proposal: MemoryProposalRecord) => {
    try {
      await repository.deleteMemoryItem(proposal.memoryId);
      setProposalStatuses((prev) => ({ ...prev, [proposal.memoryId]: 'rejected' }));
    } catch (e) {
      console.error('Failed to reject memory:', e);
    }
  };

  const toggleToolExpand = (id: string) => {
    setExpandedToolIndex((curr) => (curr === id ? null : id));
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl">
      {/* Top Quota & Privacy Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-deep-blue-500 text-cream-100 flex items-center justify-center font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-deep-blue-900 dark:text-cream-100 flex items-center gap-2">
              <span>Gemini Quantitative Agent</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-deep-blue-100 dark:bg-dark-elevated text-deep-blue-800 dark:text-cream-300 font-mono">
                {settings.geminiLightModel}
              </span>
            </div>
            <div className="text-deep-blue-700/70 dark:text-cream-400">
              Deterministic calculations over local IndexedDB • Max 2 tool rounds
            </div>
          </div>
        </div>

        {/* Quota Meters & Privacy */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cream-100 dark:bg-dark-elevated text-deep-blue-800 dark:text-cream-200 font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Privacy Mode: {settings.privacyMode ? 'Active' : 'Off'}</span>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-cream-100 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border font-mono text-[11px]"
            title="Daily request meter for light & heavy models"
          >
            <Clock className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>
              Light: {usageStats?.lightCount ?? 0}/{settings.dailyAiBudgetLight ?? 200}
            </span>
            <span className="text-deep-blue-300 dark:text-cream-500">•</span>
            <span>
              Heavy: {usageStats?.heavyCount ?? 0}/{settings.dailyAiBudgetHeavy ?? 20}
            </span>
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-cream-200/70 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-dark-surface text-deep-blue-900 dark:text-cream-100 shadow-sm'
                  : 'text-deep-blue-700 dark:text-cream-300 hover:text-deep-blue-900'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'memory'
                  ? 'bg-white dark:bg-dark-surface text-deep-blue-900 dark:text-cream-100 shadow-sm'
                  : 'text-deep-blue-700 dark:text-cream-300 hover:text-deep-blue-900'
              }`}
            >
              <BrainCircuit className="w-3 h-3" />
              <span>Memory Vault</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'memory' ? (
        <MemoryManager onMemoryChanged={loadUsage} />
      ) : (
        /* Chat View */
        <div className="flex flex-col h-[650px] rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle overflow-hidden">
          {/* Messages list */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {messages.map((m) => {
              const isUser = m.role === 'user';

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-deep-blue-500 text-cream-100 flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-sm">
                      AI
                    </div>
                  )}

                  <div className={`space-y-2 max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Tool execution badges (above assistant response) */}
                    {!isUser && m.toolExecutions && m.toolExecutions.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {m.toolExecutions.map((tool, tIdx) => {
                          const toolKey = `${m.id}-tool-${tIdx}`;
                          const isExpanded = expandedToolIndex === toolKey;

                          return (
                            <div
                              key={toolKey}
                              className="text-[11px] rounded-lg border border-cream-200 dark:border-dark-border bg-cream-50/80 dark:bg-dark-elevated/80 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => toggleToolExpand(toolKey)}
                                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cream-100/60 dark:hover:bg-dark-elevated text-deep-blue-800 dark:text-cream-200 text-left transition-colors font-mono"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <Database className="w-3 h-3 text-deep-blue-600 dark:text-cream-300 flex-shrink-0" />
                                  <span className="font-semibold">Tool: {tool.name}()</span>
                                  <span className="text-deep-blue-500 dark:text-cream-400 text-[10px] truncate">
                                    {JSON.stringify(tool.args)}
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="p-2.5 bg-white dark:bg-dark-surface border-t border-cream-200 dark:border-dark-border text-[10px] font-mono overflow-x-auto space-y-2">
                                  <div>
                                    <div className="font-bold text-deep-blue-700 dark:text-cream-300">
                                      Inputs:
                                    </div>
                                    <pre className="text-deep-blue-900 dark:text-cream-200 whitespace-pre-wrap">
                                      {JSON.stringify(tool.args, null, 2)}
                                    </pre>
                                  </div>
                                  <div>
                                    <div className="font-bold text-deep-blue-700 dark:text-cream-300">
                                      Verified Output:
                                    </div>
                                    <pre className="text-deep-blue-900 dark:text-cream-200 whitespace-pre-wrap">
                                      {JSON.stringify(tool.result, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-deep-blue-500 text-cream-100 rounded-br-none shadow-sm'
                          : 'bg-cream-50 dark:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 border border-cream-200 dark:border-dark-border rounded-bl-none shadow-subtle'
                      }`}
                    >
                      {isUser ? m.text : <MarkdownView content={m.text} />}
                    </div>

                    {/* Interactive Memory Proposal Cards */}
                    {!isUser && m.proposals && m.proposals.length > 0 && (
                      <div className="space-y-2 pt-1 w-full">
                        {m.proposals.map((proposal) => {
                          const status = proposalStatuses[proposal.memoryId] || 'pending';

                          return (
                            <div
                              key={proposal.memoryId}
                              className="p-3.5 rounded-xl border border-amber-300/80 bg-amber-50/60 dark:bg-dark-elevated dark:border-amber-500/40 text-xs space-y-2 animate-fadeIn"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Proposed Memory Confirmation</span>
                                  <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-dark-surface text-amber-900 dark:text-amber-300">
                                    {proposal.kind.replace('_', ' ')}
                                  </span>
                                </div>

                                <span className="text-[11px] font-medium text-amber-800/80 dark:text-amber-400">
                                  Requires Your Approval
                                </span>
                              </div>

                              <p className="text-deep-blue-950 dark:text-cream-100 font-medium bg-white/70 dark:bg-dark-surface/70 p-2 rounded-lg border border-amber-200/50 dark:border-dark-border">
                                {proposal.text}
                              </p>

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-deep-blue-600 dark:text-cream-400">
                                  Will be stored in long-term memory for future queries.
                                </span>

                                <div className="flex items-center gap-2">
                                  {status === 'pending' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveProposal(proposal)}
                                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-cream-100 font-semibold transition-colors shadow-sm"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectProposal(proposal)}
                                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-status-danger hover:bg-red-700 text-cream-100 font-semibold transition-colors shadow-sm"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  ) : status === 'approved' ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-dark-surface text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Saved to Memory Vault</span>
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-dark-surface text-status-danger font-bold flex items-center gap-1">
                                      <X className="w-3.5 h-3.5" />
                                      <span>Rejected</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-deep-blue-500 text-cream-100 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  AI
                </div>
                <div className="p-3.5 rounded-2xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs text-deep-blue-700 dark:text-cream-300 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-deep-blue-600 dark:text-cream-300" />
                  <span>Executing code tools & synthesizing quantitative answer...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Suggested Prompts */}
          <div className="px-5 py-2.5 bg-cream-50/70 dark:bg-dark-elevated/40 border-t border-cream-100 dark:border-dark-border flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-deep-blue-700/70 dark:text-cream-400 flex-shrink-0">
              Suggestions:
            </span>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                disabled={isLoading}
                className="px-3 py-1 rounded-full text-xs bg-white dark:bg-dark-surface hover:bg-cream-100 dark:hover:bg-dark-border text-deep-blue-800 dark:text-cream-200 border border-cream-200 dark:border-dark-border transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box & Legal Footnote */}
          <div className="p-4 border-t border-cream-200 dark:border-dark-border bg-white dark:bg-dark-surface space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputMessage);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about spending, budgets, commitments, or what you can afford..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 placeholder:text-deep-blue-400/60 focus:outline-none focus:ring-2 focus:ring-deep-blue-400"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 disabled:opacity-40 text-cream-100 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="text-[10px] text-center text-deep-blue-600/70 dark:text-cream-400">
              * LedgerLite Assistant calculations are computed deterministically from your local transactions and do not constitute formal financial advice.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
