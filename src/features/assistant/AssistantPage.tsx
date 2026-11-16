import React, { useState, useEffect, useRef } from 'react';
import { SegmentedControl } from '@/components/common/SegmentedControl';
import { Link } from 'react-router-dom';
import {
  ArrowUp,
  ChevronDown,
  Check,
  X,
  Calculator,
  BookmarkPlus,
  ArrowUpRight,
  Paperclip,
  FileText,
  Receipt,
} from 'lucide-react';
import clsx from 'clsx';
import { repository } from '@/data/repository';
import { secretsAdapter } from '@/lib/secrets';
import { useSettingsStore } from '@/store/settingsStore';
import { requestQueue, type TodayUsageStats } from '@/lib/gemini/requestQueue';
import { runAgentTurn } from '@/lib/gemini/agent/agentLoop';
import type {
  ChatMessage,
  MemoryProposalRecord,
  ExtractedTransactionProposal,
} from '@/lib/gemini/agent/types';
import { MemoryManager } from './components/MemoryManager';
import { BrandGlyph } from '@/components/brand/BrandMark';

interface ComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 data URL
  previewUrl?: string;
  size: number;
}

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
          <span key={idx} className="inline-block w-1.5 h-4 ml-0.5 rounded-xs bg-deep-blue-950 dark:bg-white align-middle animate-pulse" />
        ) : null;
        if (t.startsWith('### ') || t.startsWith('## ')) {
          return (
            <h3 key={idx} className="pt-2 text-[15px] font-semibold text-deep-blue-950 dark:text-white">
              {formatInline(t.replace(/^#+\s/, ''))}
              {isLast && isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-950 dark:bg-white align-middle animate-pulse" />
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
                  <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-950 dark:bg-white align-middle animate-pulse" />
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
                  <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-950 dark:bg-white align-middle animate-pulse" />
                )}
              </span>
            </div>
          );
        }
        return (
          <p key={idx}>
            {formatInline(t)}
            {isLast && isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 rounded-xs bg-deep-blue-950 dark:bg-white align-middle animate-pulse" />
            )}
          </p>
        );
      })}
      {content.length === 0 && isStreaming && (
        <span className="inline-block w-1.5 h-4 rounded-xs bg-deep-blue-950 dark:bg-white align-middle animate-pulse" />
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
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [txStatuses, setTxStatuses] = useState<Record<string, 'pending' | 'saving' | 'added' | 'error'>>({});
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const streamIntervalRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const scroller = document.scrollingElement || document.documentElement || document.body;
    const targetY = Math.max(scroller.scrollHeight, document.body.scrollHeight, 100000);
    try {
      window.scrollTo({ top: targetY, behavior });
    } catch {
      window.scrollTo(0, targetY);
    }
    if (chatEndRef.current) {
      try {
        chatEndRef.current.scrollIntoView({ behavior, block: 'end' });
      } catch {}
    }
  };

  useEffect(() => {
    requestQueue.updateBudgets(settings.dailyAiBudgetHeavy ?? 20, settings.dailyAiBudgetLight ?? 200);
    requestQueue.setConfiguredModels(settings.geminiHeavyModel, settings.geminiLightModel);
    loadUsage();
  }, [settings.dailyAiBudgetHeavy, settings.dailyAiBudgetLight, settings.geminiHeavyModel, settings.geminiLightModel]);

  useEffect(() => {
    if (streamingMessageId) {
      scrollToBottom('auto');
    } else if (messages.length > 0) {
      const t1 = setTimeout(() => scrollToBottom('smooth'), 40);
      const t2 = setTimeout(() => scrollToBottom('smooth'), 160);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [messages, streamingMessageId, isLoading]);

  // Auto-grow composer
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputMessage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validMimes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'text/csv',
      'text/plain',
    ];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isAccepted =
        validMimes.includes(file.type) ||
        (ext === 'csv' && (file.type.includes('csv') || file.type.includes('text') || !file.type)) ||
        (ext === 'pdf' && (file.type.includes('pdf') || !file.type)) ||
        ['png', 'jpg', 'jpeg', 'webp', 'txt'].includes(ext || '');

      if (!isAccepted) {
        alert(`File format not supported: ${file.name}. Please upload PDF, CSV, TXT, PNG, JPEG, or WebP.`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`File exceeds 10MB limit: ${file.name}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = reader.result as string;
        const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '');
        let mimeType = file.type;
        if (!mimeType) {
          if (ext === 'csv') mimeType = 'text/csv';
          else if (ext === 'pdf') mimeType = 'application/pdf';
          else if (ext === 'txt') mimeType = 'text/plain';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
          else if (ext === 'webp') mimeType = 'image/webp';
        }

        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: mimeType || 'application/octet-stream',
            data: resultStr,
            previewUrl: isImage ? resultStr : undefined,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddTransaction = async (tx: ExtractedTransactionProposal) => {
    setTxStatuses((prev) => ({ ...prev, [tx.id]: 'saving' }));
    try {
      const categories = await repository.getCategories();
      let categoryId = tx.categoryId;
      if (!categoryId || !categories.some((c) => c.id === categoryId)) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === (tx.category || '').toLowerCase()
        );
        categoryId = match?.id || categories[0]?.id || 'cat_other';
      }

      await repository.addTransaction({
        amount: tx.amount,
        currency: 'INR',
        date: tx.date,
        merchant: tx.merchant,
        categoryId,
        paymentMethod: tx.paymentMethod || 'upi',
        notes: tx.notes || 'Extracted via Assistant',
        tags: ['ai-imported'],
        source: 'ai',
        confidence: tx.confidence ?? 0.95,
      });

      setTxStatuses((prev) => ({ ...prev, [tx.id]: 'added' }));
    } catch (err) {
      console.error('Failed to add transaction:', err);
      setTxStatuses((prev) => ({ ...prev, [tx.id]: 'error' }));
    }
  };

  const handleImportAll = async (txs: ExtractedTransactionProposal[]) => {
    setIsImportingBatch(true);
    try {
      const categories = await repository.getCategories();
      for (const tx of txs) {
        if (txStatuses[tx.id] === 'added') continue;
        setTxStatuses((prev) => ({ ...prev, [tx.id]: 'saving' }));
        let categoryId = tx.categoryId;
        if (!categoryId || !categories.some((c) => c.id === categoryId)) {
          const match = categories.find(
            (c) => c.name.toLowerCase() === (tx.category || '').toLowerCase()
          );
          categoryId = match?.id || categories[0]?.id || 'cat_other';
        }

        await repository.addTransaction({
          amount: tx.amount,
          currency: 'INR',
          date: tx.date,
          merchant: tx.merchant,
          categoryId,
          paymentMethod: tx.paymentMethod || 'upi',
          notes: tx.notes || 'Extracted via Assistant',
          tags: ['ai-imported'],
          source: 'ai',
          confidence: tx.confidence ?? 0.95,
        });

        setTxStatuses((prev) => ({ ...prev, [tx.id]: 'added' }));
      }
    } catch (err) {
      console.error('Failed batch import:', err);
    } finally {
      setIsImportingBatch(false);
    }
  };

  const handleSend = async (userText: string) => {
    const trimmed = userText.trim();
    if ((!trimmed && attachments.length === 0) || isLoading) return;

    const currentAttachments = [...attachments];
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
      attachments: currentAttachments.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        data: a.data,
      })),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setAttachments([]);
    setIsLoading(true);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const apiKey = (await secretsAdapter.getApiKey()) || settings.geminiApiKey || '';
      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', text: MISSING_KEY, timestamp: new Date().toISOString() },
        ]);
        return;
      }

      const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text, attachments: m.attachments }));
      const queryText =
        trimmed ||
        (currentAttachments.length > 0
          ? 'Please analyze the attached document(s)/receipt(s), extract any transactions or financial information, and summarize key insights.'
          : '');

      const result = await runAgentTurn(
        {
          userQuery: queryText,
          attachments: currentAttachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            data: a.data,
          })),
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

      if (result.extractedTransactions?.length) {
        setTxStatuses((prev) => {
          const next = { ...prev };
          for (const tx of result.extractedTransactions) {
            if (!next[tx.id]) next[tx.id] = 'pending';
          }
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
            extractedTransactions: result.extractedTransactions,
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
          extractedTransactions: result.extractedTransactions,
          modelUsed: result.modelUsed,
        },
      ]);
      setStreamingMessageId(assistantId);

      // Stream text word-by-word like ChatGPT
      const tokens = fullText.match(/\S+\s*|\n+/g) || [fullText];
      let currentIdx = 0;
      const totalTokens = tokens.length;
      // Snappy yet distinctly visible typing cadence matching ChatGPT:
      // ~25-34ms per token; emits 2 tokens per tick only if the response is quite long.
      const tokensPerStep = totalTokens > 140 ? 2 : 1;
      const intervalMs = totalTokens > 80 ? 25 : 34;

      if (streamIntervalRef.current) {
        window.clearInterval(streamIntervalRef.current);
      }

      scrollToBottom('auto');

      await new Promise<void>((resolve) => {
        streamIntervalRef.current = window.setInterval(() => {
          currentIdx = Math.min(totalTokens, currentIdx + tokensPerStep);
          const currentSlice = tokens.slice(0, currentIdx).join('');

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: currentSlice } : m))
          );

          scrollToBottom('auto');

          if (currentIdx >= totalTokens) {
            if (streamIntervalRef.current) {
              window.clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            setStreamingMessageId(null);
            setTimeout(() => scrollToBottom('smooth'), 40);
            setTimeout(() => scrollToBottom('smooth'), 180);
            resolve();
          }
        }, intervalMs);
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
              <ol className="space-y-8 pb-32 md:pb-28" aria-live="polite">
                {messages.map((m) => {
                  if (m.role === 'user') {
                    return (
                      <li key={m.id} className="flex justify-end">
                        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-deep-blue-950 text-white dark:bg-white/[0.08] dark:text-white text-[15px] leading-relaxed">
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                              {m.attachments.map((att, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15 text-white text-[11px] border border-white/20"
                                >
                                  {att.mimeType.startsWith('image/') ? (
                                    <img
                                      src={att.data.startsWith('data:') ? att.data : `data:${att.mimeType};base64,${att.data}`}
                                      alt={att.name}
                                      className="w-4 h-4 rounded object-cover shrink-0"
                                    />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 opacity-80 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {m.text && <div>{m.text}</div>}
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

                        {m.extractedTransactions && m.extractedTransactions.length > 0 && (() => {
                          const pendingCount = m.extractedTransactions.filter(
                            (tx) => (txStatuses[tx.id] || 'pending') === 'pending'
                          ).length;
                          const addedCount = m.extractedTransactions.filter(
                            (tx) => txStatuses[tx.id] === 'added'
                          ).length;

                          return (
                            <div className="rounded-2xl border border-cream-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-4 animate-fadeIn space-y-3">
                              <div className="flex items-center justify-between gap-3 border-b border-cream-200/60 dark:border-white/[0.05] pb-3">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-deep-blue-950 dark:text-white">
                                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                                  <span>Extracted Transactions ({m.extractedTransactions.length})</span>
                                  {addedCount > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                                      {addedCount} added
                                    </span>
                                  )}
                                </div>
                                {pendingCount > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleImportAll(m.extractedTransactions!)}
                                    disabled={isImportingBatch}
                                    className="h-8 px-3 rounded-lg text-[12px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Import All ({pendingCount})</span>
                                  </button>
                                )}
                              </div>

                              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {m.extractedTransactions.map((tx) => {
                                  const status = txStatuses[tx.id] || 'pending';
                                  return (
                                    <div
                                      key={tx.id}
                                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cream-100 dark:border-white/[0.04] bg-cream-50/50 dark:bg-white/[0.02] transition-colors"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-[14px] text-deep-blue-950 dark:text-white truncate">
                                            {tx.merchant}
                                          </span>
                                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-deep-blue-50 dark:bg-white/[0.06] text-deep-blue-900/60 dark:text-white/60">
                                            {tx.category || 'Expense'}
                                          </span>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-deep-blue-900/45 dark:text-white/40">
                                          <span>{tx.date}</span>
                                          <span>•</span>
                                          <span className="capitalize">{tx.paymentMethod || 'upi'}</span>
                                          {tx.notes && (
                                            <>
                                              <span>•</span>
                                              <span className="truncate max-w-[150px]">{tx.notes}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="font-semibold text-[14px] text-deep-blue-950 dark:text-white tabular-nums">
                                          ₹{Number(tx.amount).toLocaleString('en-IN')}
                                        </span>
                                        {status === 'pending' ? (
                                          <button
                                            type="button"
                                            onClick={() => handleAddTransaction(tx)}
                                            className="h-8 px-2.5 rounded-lg text-[12px] font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity"
                                          >
                                            Add to Transactions
                                          </button>
                                        ) : status === 'saving' ? (
                                          <span className="text-[12px] text-deep-blue-900/45 dark:text-white/45">Adding…</span>
                                        ) : status === 'added' ? (
                                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                                            <Check className="w-3.5 h-3.5" /> Added
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleAddTransaction(tx)}
                                            className="h-8 px-2.5 rounded-lg text-[12px] font-medium bg-rose-600 text-white"
                                          >
                                            Retry
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
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
                            className="w-2 h-2 rounded-full bg-deep-blue-950 dark:bg-white animate-thinking-dot"
                            style={{ animationDelay: `${i * 180}ms` }}
                          />
                        ))}
                        <span className="sr-only">Thinking...</span>
                      </div>
                    </div>
                  </li>
                )}
                <li ref={chatEndRef} className="h-4 w-full shrink-0 list-none pointer-events-none" aria-hidden="true" />
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
              className="flex flex-col liquid-glass rounded-[22px] overflow-hidden"
            >
              {/* Attachment preview chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2.5 pb-1 border-b border-cream-200/50 dark:border-white/[0.06]">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl bg-white/80 dark:bg-white/[0.08] border border-cream-200 dark:border-white/[0.1] text-[12px] shadow-2xs"
                    >
                      {att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-5 h-5 rounded object-cover shrink-0 ring-1 ring-black/10"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-deep-blue-900/60 dark:text-white/60 shrink-0" />
                      )}
                      <span className="truncate max-w-[140px] font-medium text-deep-blue-950 dark:text-white">
                        {att.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="p-0.5 rounded-full hover:bg-cream-200 dark:hover:bg-white/10 text-deep-blue-900/50 dark:text-white/40 hover:text-deep-blue-950 dark:hover:text-white transition-colors"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 p-2 pl-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/csv,text/plain,.pdf,.csv,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  aria-label="Attach file or image"
                  title="Upload bank statement, bill, CSV, PDF, or receipt image"
                  className="grid place-items-center w-9 h-9 rounded-full shrink-0 text-deep-blue-900/50 dark:text-white/45 hover:text-deep-blue-950 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.05] disabled:opacity-25 transition-colors mb-0.5"
                >
                  <Paperclip className="w-4 h-4" strokeWidth={2} />
                </button>

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
                  placeholder={
                    attachments.length > 0
                      ? 'Add instructions or press enter to analyze…'
                      : 'Ask about spending, or attach receipts, statements…'
                  }
                  disabled={isLoading}
                  className="flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-deep-blue-950 dark:text-white placeholder:text-deep-blue-900/35 dark:placeholder:text-white/30 focus:outline-none focus-visible:outline-none"
                />
                <button
                  type="submit"
                  disabled={(!inputMessage.trim() && attachments.length === 0) || isLoading}
                  aria-label="Send"
                  className="grid place-items-center w-9 h-9 rounded-full shrink-0 bg-deep-blue-950 text-white dark:bg-white dark:text-black disabled:opacity-25 transition-opacity"
                >
                  <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>
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
