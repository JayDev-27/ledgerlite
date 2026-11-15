import React, { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  BrainCircuit,
  Shield,
  Clock,
  Trash2,
} from 'lucide-react';
import { repository } from '@/data/repository';
import { MemoryItem } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_NAME } from '@/constants/app';

export const AssistantPage: React.FC = () => {
  const { settings } = useSettingsStore();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Hello! I am your ${APP_NAME} financial assistant. I have access to your local transactions, budgets, and long-term financial memory. How can I assist you with your finances today?`,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [todayRequests, setTodayRequests] = useState(3);

  const suggestedPrompts = [
    'Summarise this week',
    'Where did I overspend this quarter?',
    'Can I afford a ₹15,000 purchase?',
    'How much did I spend on dining out last month?',
  ];

  const loadMemory = async () => {
    try {
      const items = await repository.getMemoryItems();
      setMemoryItems(items);
    } catch (e) {
      console.error('Failed to load memory:', e);
    }
  };

  useEffect(() => {
    loadMemory();
  }, []);

  const handleSend = (text: string) => {
    const userPrompt = text.trim();
    if (!userPrompt) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userPrompt },
      {
        role: 'assistant',
        text: `I received your query: "${userPrompt}". In Phase 5, this will trigger the agentic Gemini model with local tool-calling (query_transactions, aggregate, compare_periods, get_budget_status). Your data remains strictly local in Privacy Mode.`,
      },
    ]);
    setInputMessage('');
    setTodayRequests((c) => c + 1);
  };

  const handleDeleteMemory = async (id: string) => {
    await repository.deleteMemoryItem(id);
    loadMemory();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Quota & Privacy Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-deep-blue-500 text-cream-100 flex items-center justify-center font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-deep-blue-900 dark:text-cream-100">
              Gemini 3.5 & 3.8 Flash Assistant
            </div>
            <div className="text-deep-blue-600/70 dark:text-cream-400">
              Agentic financial reasoning over local IndexedDB
            </div>
          </div>
        </div>

        {/* Quota Meter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-deep-blue-700 dark:text-cream-300 font-medium">
              Privacy Mode: On
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cream-100 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border font-mono">
            <Clock className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>
              Requests: {todayRequests} / {settings.dailyAiBudget}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2 flex flex-col h-[560px] rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-deep-blue-500 text-cream-100 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-deep-blue-500 text-cream-100 rounded-br-none'
                      : 'bg-cream-50 dark:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 border border-cream-200 dark:border-dark-border rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Suggested Prompts */}
          <div className="px-5 py-2.5 bg-cream-50/50 dark:bg-dark-elevated/40 border-t border-cream-100 dark:border-dark-border flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-deep-blue-700/70 dark:text-cream-400 flex-shrink-0">
              Suggestions:
            </span>
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="px-2.5 py-1 rounded-full text-xs bg-white dark:bg-dark-surface hover:bg-cream-100 dark:hover:bg-dark-border text-deep-blue-800 dark:text-cream-200 border border-cream-200 dark:border-dark-border transition-colors flex-shrink-0"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-cream-200 dark:border-dark-border bg-white dark:bg-dark-surface">
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
                placeholder="Ask about spending, budgets, or what you can afford..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 placeholder:text-deep-blue-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="p-2.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 disabled:opacity-40 text-cream-100 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Long-term Memory Sidebar */}
        <div className="space-y-4">
          <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
                <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
                  Long-Term Financial Memory
                </h3>
              </div>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-cream-100 dark:bg-dark-elevated text-deep-blue-700 dark:text-cream-300">
                {memoryItems.length} facts
              </span>
            </div>

            <p className="text-xs text-deep-blue-700/70 dark:text-cream-400 leading-relaxed">
              Facts, income, goals, and user preferences stored permanently for contextual assistant queries.
            </p>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {memoryItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-cream-50/70 dark:bg-dark-elevated/70 border border-cream-200 dark:border-dark-border space-y-1 group text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono uppercase text-[10px] tracking-wider text-deep-blue-600 dark:text-cream-300 font-semibold">
                      {item.kind.replace('_', ' ')}
                    </span>

                    <button
                      onClick={() => handleDeleteMemory(item.id)}
                      title="Delete memory"
                      className="opacity-0 group-hover:opacity-100 text-deep-blue-400 hover:text-status-danger transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-deep-blue-900 dark:text-cream-100 leading-normal">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
