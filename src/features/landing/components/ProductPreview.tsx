import React, { useEffect, useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, PieChart, FileBarChart, Bot, CornerDownLeft } from 'lucide-react';

const QUICK_ADD = 'Swiggy 420 dinner yesterday via UPI';
const BARS = [42, 58, 36, 71, 55, 88, 64, 49, 80, 60, 94, 70];
const CATS = [
  { name: 'Housing', pct: 34, color: '#847DFF' },
  { name: 'Food & Dining', pct: 21, color: '#DD90D8' },
  { name: 'Transport', pct: 14, color: '#90B8F0' },
  { name: 'Shopping', pct: 12, color: '#FFD731' },
];

/** A faithful, illustrative render of the real dashboard (demo data, clearly labelled). */
export const ProductPreview: React.FC = () => {
  const [typed, setTyped] = useState('');
  const [parsed, setParsed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(QUICK_ADD);
      setParsed(true);
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i <= QUICK_ADD.length) {
        setTyped(QUICK_ADD.slice(0, i++));
        timer = setTimeout(step, 55 + Math.random() * 40);
      } else {
        setParsed(true);
        timer = setTimeout(() => {
          setParsed(false);
          i = 0;
          step();
        }, 3800);
      }
    };
    timer = setTimeout(step, 800);
    return () => clearTimeout(timer);
  }, []);

  const max = Math.max(...BARS);

  return (
    <div className="relative rounded-[22px] bg-[#111213] border border-white/10 overflow-hidden text-left shadow-[0_40px_120px_-30px_rgba(132,125,255,0.45)]">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 h-10 border-b border-white/[0.06] bg-gradient-to-b from-[#2b2b2c] to-[#131313]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-4 label-mono text-[10px] text-white/40">ledgerlite.app / dashboard</span>
        <span className="ml-auto label-mono text-[10px] text-white/40">Demo data</span>
      </div>

      <div className="grid grid-cols-[52px_1fr] md:grid-cols-[180px_1fr] min-h-[420px]">
        {/* Sidebar */}
        <aside className="border-r border-white/[0.06] p-2 md:p-3 space-y-1">
          {[
            [LayoutDashboard, 'Dashboard', true],
            [ArrowLeftRight, 'Transactions', false],
            [PieChart, 'Budgets', false],
            [FileBarChart, 'Reports', false],
            [Bot, 'Assistant', false],
          ].map(([Icon, label, active]) => {
            const I = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div
                key={label as string}
                className={`flex items-center gap-2.5 rounded-lg px-2 md:px-2.5 py-2 text-[12px] ${
                  active ? 'bg-white text-black' : 'text-white/55'
                }`}
              >
                <I className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{label as string}</span>
              </div>
            );
          })}
        </aside>

        <div className="p-4 md:p-6 space-y-4 min-w-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="label-mono text-[10px] text-white/40">November · spent</p>
              <p className="font-display text-4xl md:text-5xl text-white leading-none mt-1 tabular-nums">₹48,210</p>
            </div>
            <span className="label-mono text-[10px] px-2 py-1 rounded-full bg-sky-400/15 text-sky-300">
              −12% vs Oct
            </span>
          </div>

          {/* Quick add */}
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 flex items-center gap-2 min-h-[44px]">
            <CornerDownLeft className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-[13px] text-white/85 truncate">
              {typed}
              {!parsed && <span className="inline-block w-[2px] h-4 bg-sky-400 align-middle ml-0.5 animate-pulse" />}
            </span>
          </div>
          <div
            className={`flex flex-wrap gap-1.5 transition-all duration-500 ${parsed ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
          >
            {['₹420', 'Food & Dining', 'Yesterday', 'UPI'].map((chip) => (
              <span key={chip} className="label-mono text-[10px] px-2 py-1 rounded-full border border-white/15 text-white/80">
                {chip}
              </span>
            ))}
          </div>

          <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
            {/* Bars */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="label-mono text-[10px] text-white/40 mb-3">12-month spend</p>
              <div className="flex items-end gap-1.5 h-28">
                {BARS.map((b, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md"
                    style={{
                      height: `${(b / max) * 100}%`,
                      background: i === BARS.length - 2 ? '#9FE870' : 'rgba(255,255,255,0.14)',
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Categories */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2.5">
              <p className="label-mono text-[10px] text-white/40">By category</p>
              {CATS.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-[11px] text-white/70 mb-1">
                    <span>{c.name}</span>
                    <span className="tabular-nums">{c.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${c.pct * 2.4}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
