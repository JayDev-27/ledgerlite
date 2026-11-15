import React, { useState, useEffect, useRef } from 'react';
import { SegmentedControl } from '@/components/common/SegmentedControl';
import { Link } from 'react-router-dom';
import { ArrowUp, ChevronDown, Check, X, Calculator, BookmarkPlus, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';
import { repository } from '@/data/repository';
import { secretsAdapter } from '@/lib/secrets';
import { useSettingsStore } from '@/store/settingsStore';
import { requestQueue, type TodayUsageStats } from '@/lib/gemini/requestQueue';
import { runAgentTurn } from '@/lib/gemini/agent/agentLoop';
import type { ChatMessage, MemoryProposalRecord } from '@/lib/gemini/agent/types';
import { MemoryManager } from './components/MemoryManager';
import { BrandGlyph } from '@/components/brand/BrandMark';

const SUGGESTED_PROMPTS = [
  { q: 'Summarise this week', hint: 'Spend, top categories, anything unusual' },
  { q: 'Where did I overspend this quarter?', hint: 'Compared with your budgets' },
  { q: 'Can I afford a ₹15,000 purchase?', hint: 'Against this month’s pace' },
  { q: 'What are my recurring monthly commitments?', hint: 'Rent, EMIs, subscriptions' },
];

const MISSING_KEY = '__missing_key__';

// ── Lightweight Markdown renderer ──────────────────────────────────────────
function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-deep-blue-950 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded-md bg-deep-blue-50 dark:bg-white/[0.06] font-mono text-[12px]">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts;
}

const MarkdownView: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-2.5 text-[15px] leading-[1.7] text-deep-blue-950/80 dark:text-white/75">
      {lines.map((line, idx) => {
        const t = line.trim();
        const isLast = idx === lines.length - 1;
        if (!t) return isLast && isStreaming ? (
          <span key={idx} className="inline-block w-1.5 h-4 ml-0.5 rounded-xs bg-deep-blue-500 dark:bg-gallery-iris align-middle animate-pulse" />
        ) : null;
        if (t.startsWith('### ') || t.startsWith('## ')) {
          return (
            <h3 key={idx} className="pt-2 text-[15px] font-semibold text-deep-blue-950 dark:text-white">
              {formatInline(t.replace(/^#+\s/, ''))}
              {isLast && isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-500 dark:bg-gallery-iris align-middle animate-pulse" />
              )}
            </h3>
          );
        }
        if (t.startsWith('- ') || t.startsWith('* ')) {
          return (
            <div key={idx} className="flex gap-3">
              <span className="mt-[11px] w-1 h-1 rounded-full bg-current opacity-40 shrink-0" />
              <span>
                {formatInline(t.slice(2))}
                {isLast && isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-500 dark:bg-gallery-iris align-middle animate-pulse" />
                )}
              </span>
            </div>
          );
        }
        const num = t.match(/^(\d+)\.\s+(.*)$/);
        if (num) {
          return (
            <div key={idx} className="flex gap-3">
              <span className="tabular-nums text-deep-blue-900/40 dark:text-white/35 shrink-0">{num[1]}.</span>
              <span>
                {formatInline(num[2] || '')}
                {isLast && isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-500 dark:bg-gallery-iris align-middle animate-pulse" />
                )}
              </span>
            </div>
          );
        }
        return (
          <p key={idx}>
            {formatInline(t)}
            {isLast && isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-500 dark:bg-gallery-iris align-middle animate-pulse" />
            )}
          </p>
        );
      })}
      {content.length === 0 && isStreaming && (
        <span className="inline-block w-1.5 h-4 rounded-xs bg-deep-blue-500 dark:bg-gallery-iris align-middle animate-pulse" />
      )}
    </div>
  );
};

const AssistantAvatar: React.FC = () => (
  <span
    aria-hidden="true"
    className="grid place-items-center w-8 h-8 rounded-full shrink-0 bg-deep-blue-50 text-deep-blue-950 dark:bg-white/[0.06] dark:text-white ring-1 ring-inset ring-black/5 dark:ring-white/10"
  >
    <BrandGlyph size={15} />
  </span>
);

export const AssistantPage: React.FC = () => {
  const { settings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usageStats, setUsageStats] = useState<TodayUsageStats | null>(null);
  const [expandedTools, setExpandedTools] = useState<string | null>(null);
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamIntervalRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        window.clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  const loadUsage = async () => {
    try {
      setUsageStats(await requestQueue.getTodayUsage());
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
    if (messages.length) chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  // Auto-grow composer
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputMessage]);

  const handleSend = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const apiKey = (await secretsAdapter.getApiKey()) || settings.geminiApiKey || '';
      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', text: MISSING_KEY, timestamp: new Date().toISOString() },
        ]);
        return;
      }

      const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
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

      if (result.proposals?.length) {
        setProposalStatuses((prev) => {
          const next = { ...prev };
          for (const p of result.proposals) next[p.memoryId] = 'pending';
          return next;
        });
      }

      const assistantId = crypto.randomUUID();
      const fullText = result.text || '';

      // Stop thinking indicator as soon as synthesized response arrives
      setIsLoading(false);

      if (!fullText) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            text: '',
            timestamp: new Date().toISOString(),
            toolExecutions: result.toolExecutions,
            proposals: result.proposals,
            modelUsed: result.modelUsed,
          },
        ]);
        await loadUsage();
        return;
      }

      // Add message placeholder for smooth typewriter reveal
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          timestamp: new Date().toISOString(),
          toolExecutions: result.toolExecutions,
          proposals: result.proposals,
          modelUsed: result.modelUsed,
        },
      ]);
      setStreamingMessageId(assistantId);

      // Stream text chunk by chunk like ChatGPT
      await new Promise<void>((resolve) => {
        let currentIndex = 0;
        const totalLen = fullText.length;
        // Adaptive step size: snappy pace that feels lively and smooth
        const stepSize = Math.max(2, Math.min(10, Math.ceil(totalLen / 60)));
        const intervalTime = 16;

        if (streamIntervalRef.current) {
          window.clearInterval(streamIntervalRef.current);
        }

        streamIntervalRef.current = window.setInterval(() => {
          currentIndex = Math.min(totalLen, currentIndex + stepSize);
          const currentSlice = fullText.slice(0, currentIndex);

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: currentSlice } : m))
          );

          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });

          if (currentIndex >= totalLen) {
            if (streamIntervalRef.current) {
              window.clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            setStreamingMessageId(null);
            resolve();
          }
        }, intervalTime);
      });

      await loadUsage();
    } catch (err: unknown) {
      console.error('Agent error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `I couldn’t finish that one. ${msg}`,
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

  const used = usageStats?.lightCount ?? 0;
  const limit = settings.dailyAiBudgetLight ?? 200;
  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col min-h-[calc(100svh-10rem)] animate-fadeIn">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 pb-6">
        <SegmentedControl
          ariaLabel="Assistant view"
          value={activeTab}
          options={[
            { value: 'chat', label: 'Chat' },
            { value: 'memory', label: 'Memory' },
          ]}
          onChange={setActiveTab}
        />

        <div
          className="flex items-center gap-2 text-[12px] text-deep-blue-900/45 dark:text-white/35"
          title={`Model: ${settings.geminiLightModel} · ${used} of ${limit} requests used today`}
        >
          <span
            className={clsx('w-1.5 h-1.5 rounded-full', settings.privacyMode ? 'bg-emerald-500 dark:bg-sky-400' : 'bg-amber-400')}
            aria-hidden="true"
          />
          <span>{settings.privacyMode ? 'Private mode' : 'Private mode off'}</span>
          <span className="hidden sm:inline opacity-50">·</span>
          <span className="hidden sm:inline tabular-nums">{Math.max(0, limit - used)} questions left today</span>
        </div>
      </div>

      {activeTab === 'memory' ? (
        <MemoryManager onMemoryChanged={loadUsage} />
      ) : (
        <>
          {/* Conversation */}
          <div className="flex-1">
            {isEmpty ? (
              <div className="pt-10 sm:pt-16 pb-10">
                <h2 className="font-display text-[44px] sm:text-[56px] leading-[0.95] tracking-[-0.01em] text-deep-blue-950 dark:text-white">
                  Ask anything about
                  <br />
                  <em>your money.</em>
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-deep-blue-900/55 dark:text-white/45">
                  Answers are calculated from your own ledger. Private mode strips names and identifiers before anything leaves
                  this device.
                </p>

                <div className="mt-10 grid sm:grid-cols-2 gap-2">
                  {SUGGESTED_PROMPTS.map(({ q, hint }) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="group text-left p-4 rounded-2xl border border-cream-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.015] hover:bg-deep-blue-50/40 dark:hover:bg-white/[0.04] hover:border-cream-300 dark:hover:border-white/[0.12] transition-colors"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-[14px] font-medium text-deep-blue-950 dark:text-white/90">{q}</span>
                        <ArrowUpRight
                          className="w-4 h-4 shrink-0 text-deep-blue-900/25 dark:text-white/20 group-hover:text-deep-blue-950 dark:group-hover:text-white transition-colors"
                          strokeWidth={1.75}
                        />
                      </span>
                      <span className="mt-1 block text-[12px] text-deep-blue-900/45 dark:text-white/35">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol className="space-y-8 pb-8" aria-live="polite">
                {messages.map((m) => {
                  if (m.role === 'user') {
                    return (
                      <li key={m.id} className="flex justify-end">
                        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-deep-blue-950 text-white dark:bg-white/[0.08] dark:text-white text-[15px] leading-relaxed">
                          {m.text}
                        </div>
                      </li>
                    );
                  }

                  const toolsOpen = expandedTools === m.id;
                  return (
                    <li key={m.id} className="flex gap-4">
                      <AssistantAvatar />
                      <div className="flex-1 min-w-0 pt-1 space-y-3">
                        {m.text === MISSING_KEY ? (
                          <div className="text-[15px] leading-relaxed text-deep-blue-950/80 dark:text-white/75">
                            <p>To answer questions I need a Gemini API key. It stays on this device.</p>
                            <Link
                              to="/app/settings"
                              className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[13px] font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black"
                            >
                              Add your key in Settings
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        ) : (
                          <MarkdownView content={m.text} isStreaming={streamingMessageId === m.id} />
                        )}

                        {m.toolExecutions && m.toolExecutions.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedTools(toolsOpen ? null : m.id)}
                              aria-expanded={toolsOpen}
                              className="inline-flex items-center gap-1.5 text-[12px] text-deep-blue-900/45 hover:text-deep-blue-950 dark:text-white/35 dark:hover:text-white transition-colors"
                            >
                              <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />
                              Checked against {m.toolExecutions.length}{' '}
                              {m.toolExecutions.length === 1 ? 'calculation' : 'calculations'}
                              <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', toolsOpen && 'rotate-180')} />
                            </button>
                            {toolsOpen && (
                              <div className="mt-3 space-y-2">
                                {m.toolExecutions.map((tool, i) => (
                                  <details
                                    key={i}
                                    className="rounded-xl border border-cream-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] text-[12px]"
                                  >
                                    <summary className="cursor-pointer list-none px-3 py-2 font-mono text-deep-blue-900/70 dark:text-white/55 [&::-webkit-details-marker]:hidden">
                                      {tool.name.replace(/_/g, ' ')}
                                    </summary>
                                    <pre className="px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-deep-blue-900/60 dark:text-white/45 max-h-64 overflow-auto">
                                      {JSON.stringify({ input: tool.args, output: tool.result }, null, 2)}
                                    </pre>
                                  </details>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {m.proposals?.map((proposal) => {
                          const status = proposalStatuses[proposal.memoryId] || 'pending';
                          return (
                            <div
                              key={proposal.memoryId}
                              className="rounded-2xl border border-cream-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-4 animate-fadeIn"
                            >
                              <p className="flex items-center gap-2 text-[12px] text-deep-blue-900/45 dark:text-white/40">
                                <BookmarkPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                                Remember this for next time?
                              </p>
                              <p className="mt-2 text-[14px] text-deep-blue-950 dark:text-white/90">{proposal.text}</p>
                              <div className="mt-3 flex items-center gap-2">
                                {status === 'pending' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveProposal(proposal)}
                                      className="h-8 px-3 rounded-lg text-[13px] font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black"
                                    >
                                      Remember
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectProposal(proposal)}
                                      className="h-8 px-3 rounded-lg text-[13px] text-deep-blue-900/55 hover:text-deep-blue-950 dark:text-white/45 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.05]"
                                    >
                                      Not now
                                    </button>
                                  </>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[13px] text-deep-blue-900/55 dark:text-white/45">
                                    {status === 'approved' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                    {status === 'approved' ? 'Saved to memory' : 'Dismissed'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}

                {isLoading && (
                  <li className="flex gap-4" role="status" aria-label="Assistant is thinking">
                    <AssistantAvatar />
                    <div className="pt-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-dark-surface border border-cream-200 dark:border-white/[0.08] shadow-sm">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-deep-blue-500 dark:bg-gallery-iris animate-thinking-dot"
                            style={{ animationDelay: `${i * 180}ms` }}
                          />
                        ))}
                        <span className="sr-only">Thinking...</span>
                      </div>
                    </div>
                  </li>
                )}
                <div ref={chatEndRef} />
              </ol>
            )}
          </div>

          {/* Composer */}
          <div className="sticky bottom-20 md:bottom-6 pt-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputMessage);
              }}
              className="flex items-end gap-2 p-2 pl-4 liquid-glass rounded-[22px]"
            >
              <label htmlFor="assistant-input" className="sr-only">
                Ask the assistant
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(inputMessage);
                  }
                }}
                placeholder="Ask about spending, budgets or what you can afford…"
                disabled={isLoading}
                className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-deep-blue-950 dark:text-white placeholder:text-deep-blue-900/35 dark:placeholder:text-white/30 focus:outline-none focus-visible:outline-none"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                aria-label="Send"
                className="grid place-items-center w-9 h-9 rounded-full shrink-0 bg-deep-blue-950 text-white dark:bg-white dark:text-black disabled:opacity-25 transition-opacity"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </form>
            <p className="mt-2.5 text-center text-[11px] text-deep-blue-900/35 dark:text-white/25">
              Calculated from your ledger. Not financial advice.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
