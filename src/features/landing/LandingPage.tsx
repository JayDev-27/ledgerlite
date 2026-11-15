import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, ArrowDown, Plus, CornerDownLeft, Repeat, FileSpreadsheet, ShieldCheck, Gauge } from 'lucide-react';
import { HeroCanvas, type HeroCanvasHandle } from './components/HeroCanvas';
import { ProductPreview } from './components/ProductPreview';
import { BrandMark } from '@/components/brand/BrandMark';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CLOUD_MODE } from '@/lib/auth/firebase';

gsap.registerPlugin(ScrollTrigger);

/** [fadeInStart, fullyIn, fullyOutStart, fadeOutEnd] in hero progress units. */
const CHAPTER_WINDOWS: Array<[number, number, number, number]> = [
  [-1, 0, 0.2, 0.3],
  [0.3, 0.37, 0.52, 0.6],
  [0.6, 0.67, 0.8, 0.86],
  [0.86, 0.92, 2, 3],
];
const CHAPTER_NAMES = ['Chaos', 'Ledger', 'Budget', 'Vault'];

const STATEMENT = CLOUD_MODE
  ? 'LedgerLite turns scattered spending into a calm, private ledger — sorted, budgeted and explained, in a vault that only your account can open.'
  : 'LedgerLite turns scattered spending into a calm, private ledger — sorted, budgeted and explained, without your records ever leaving this device.';

const FAQ = [
  {
    q: 'Where is my financial data stored?',
    a: CLOUD_MODE
      ? 'In your own private vault in Google Cloud Firestore, encrypted at rest. Security rules let only your signed-in account read or write it, so your ledger follows you across devices. Download a JSON backup any time from Settings.'
      : 'In your browser’s IndexedDB on this device. Your sign-in identifies you; the ledger itself is not uploaded to a server. Download a JSON backup any time from Settings.',
  },
  {
    q: 'Does it work offline?',
    a: CLOUD_MODE
      ? 'The website needs a connection to open your vault; changes made during a brief drop are retried automatically. Prefer fully offline? The open-source version runs entirely on your device.'
      : 'Yes. LedgerLite is an installable Progressive Web App. Once loaded, tracking, budgets, reports and exports keep working without a connection.',
  },
  {
    q: 'What does the AI see?',
    a: 'Gemini features are optional and use your own API key, added in Settings. When you ask, a privacy sanitiser strips identifiers before a summary is sent to Google. Calculations themselves run in the app.',
  },
  {
    q: 'Can I bring my bank statements?',
    a: 'Import CSV exports from your bank. Duplicates are detected, and rules plus the categoriser file each transaction — you can correct any of them and LedgerLite learns.',
  },
  {
    q: 'Which exports are available?',
    a: 'Excel workbooks, CSV and print-ready PDF period packs for any month, quarter or financial year (April–March by default).',
  },
];

function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * 0.25, y: y * 0.35, duration: 0.4, ease: 'power3.out' });
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);
  return ref;
}

const Tile: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg) translateZ(0)`;
    el.style.setProperty('--gx', `${(px + 0.5) * 100}%`);
    el.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`feature-tile relative overflow-hidden rounded-tile p-7 md:p-8 transition-transform duration-300 ease-out will-change-transform ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(420px circle at var(--gx, 50%) var(--gy, 0%), rgba(255,255,255,0.22), transparent 60%)',
      }}
    >
      {children}
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HeroCanvasHandle>(null);
  const chapterRefs = useRef<Array<HTMLDivElement | null>>([]);
  const railRefs = useRef<Array<HTMLLIElement | null>>([]);
  const lenisRef = useRef<Lenis | null>(null);
  const [navSolid, setNavSolid] = useState(false);
  const ctaRef = useMagnetic<HTMLAnchorElement>();

  const primaryHref = user ? '/app' : '/signin?mode=signup';
  const primaryLabel = user ? 'Open dashboard' : 'Open your vault';

  useEffect(() => {
    document.title = 'LedgerLite — Own your money, quietly';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf: ((time: number) => void) | null = null;
    if (!reduced) {
      const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
      lenisRef.current = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    const updateChapters = (p: number) => {
      let active = 0;
      let best = -1;
      CHAPTER_WINDOWS.forEach(([a, b, c, d], i) => {
        const el = chapterRefs.current[i];
        let o = 0;
        if (p >= b && p <= c) o = 1;
        else if (p > a && p < b) o = (p - a) / (b - a);
        else if (p > c && p < d) o = 1 - (p - c) / (d - c);
        if (o > best) {
          best = o;
          active = i;
        }
        if (el) {
          el.style.opacity = String(o);
          el.style.transform = reduced ? '' : `translate3d(0, ${(1 - o) * (p < b ? 28 : -28)}px, 0)`;
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        }
      });
      railRefs.current.forEach((li, i) => li?.setAttribute('data-active', String(i === active)));
    };
    updateChapters(0);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: trackRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          canvasRef.current?.setProgress(self.progress);
          updateChapters(self.progress);
        },
      });

      ScrollTrigger.create({
        start: 80,
        end: 'max',
        onToggle: (self) => setNavSolid(self.isActive),
      });

      if (reduced) return;

      // Statement: words light up as you read
      gsap.fromTo(
        '.statement-word',
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.08,
          ease: 'none',
          scrollTrigger: { trigger: '.statement', start: 'top 75%', end: 'bottom 45%', scrub: true },
        }
      );

      // Tape marquees drift with scroll as well as time
      gsap.to('.tape-a', { xPercent: -12, ease: 'none', scrollTrigger: { trigger: '.tapes', scrub: true } });
      gsap.to('.tape-b', { xPercent: 12, ease: 'none', scrollTrigger: { trigger: '.tapes', scrub: true } });

      // Bento tiles rise in
      gsap.from('.feature-tile', {
        y: 80,
        opacity: 0,
        rotate: (i: number) => (i % 2 ? 2 : -2),
        duration: 1,
        ease: 'power3.out',
        stagger: 0.09,
        clearProps: 'transform',
        scrollTrigger: { trigger: '.bento', start: 'top 80%' },
      });

      // Product preview tilts up into place
      gsap.fromTo(
        '.preview-frame',
        { rotateX: 32, scale: 0.84, y: 60 },
        {
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: '.preview-stage', start: 'top 90%', end: 'center 60%', scrub: true },
        }
      );

      // Giant YOURS slides across
      gsap.fromTo(
        '.yours',
        { xPercent: 10 },
        {
          xPercent: -30,
          ease: 'none',
          scrollTrigger: { trigger: '.privacy', start: 'top bottom', end: 'bottom top', scrub: true },
        }
      );

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
      });
    }, rootRef);

    return () => {
      ctx.revert();
      if (raf) gsap.ticker.remove(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;
    e.preventDefault();
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -20, duration: 1.4 });
    else target.scrollIntoView();
    target.focus({ preventScroll: true });
  };

  return (
    <div ref={rootRef} className="bg-dark-bg text-gallery-cloud min-h-screen overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-full"
      >
        Skip to content
      </a>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 px-4 pt-4">
        <nav
          aria-label="Primary"
          className={`mx-auto max-w-6xl flex items-center justify-between rounded-full pl-3 pr-2 py-2 transition-all duration-500 ${
            navSolid ? 'glass shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]' : 'border border-transparent'
          }`}
        >
          <Link to="/" className="rounded-full" aria-label="LedgerLite home">
            <BrandMark withWord size={32} />
          </Link>
          <ul className="hidden md:flex items-center gap-1 text-[13px] font-medium text-white/70">
            {[
              ['#features', 'Features'],
              ['#product', 'Product'],
              ['#privacy', 'Privacy'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={(e) => scrollTo(e, href!)}
                  className="px-3.5 py-2 rounded-full hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            {!user && (
              <Link
                to="/signin"
                className="hidden sm:inline-flex px-4 py-2 rounded-full text-[13px] font-medium text-white/80 hover:text-white border border-white/15 hover:border-white/35 transition-colors"
              >
                Sign in
              </Link>
            )}
            <Link
              to={primaryHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-white text-black hover:bg-sky-400 transition-colors"
            >
              {user ? 'Dashboard' : 'Get started'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* ── Hero: 400vh scroll track, sticky 3D stage ─────────────────── */}
        <section ref={trackRef} aria-label="Introduction" className="relative h-[340vh] md:h-[400vh]">
          <div className="sticky top-0 h-[100svh] overflow-hidden noise">
            <HeroCanvas ref={canvasRef} className="absolute inset-0" />
            {/* Vignette for legibility */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_80%_at_50%_40%,transparent_40%,rgba(11,12,13,0.85)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none bg-gradient-to-t from-dark-bg to-transparent" />

            {/* Chapter 0 — hero copy */}
            <div
              ref={(el) => (chapterRefs.current[0] = el)}
              className="absolute inset-0 flex items-end md:items-center pointer-events-none"
            >
              {/* Legibility scrim travels with the hero copy */}
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-dark-bg via-dark-bg/60 md:via-dark-bg/50 to-transparent md:to-60%" />
              <div className="relative w-full max-w-6xl mx-auto px-5 md:px-8 pb-24 md:pb-0">
                <p className="label-mono text-sky-400 mb-6">Private finance · Local-first · ₹ native</p>
                <h1 className="font-display font-normal text-[clamp(58px,10vw,136px)] leading-[0.88] tracking-[-0.02em] text-gallery-cloud max-w-[11ch]">
                  Own your money, <em className="text-white">quietly.</em>
                </h1>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-gallery-ash">
                  {CLOUD_MODE
                    ? 'LedgerLite sorts every rupee, paces your budgets and explains your month — in a private vault that only you can open.'
                    : 'LedgerLite sorts every rupee, paces your budgets and explains your month — all inside your browser, where your data stays.'}
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-3 pointer-events-auto">
                  <Link
                    to={primaryHref}
                    className="group inline-flex items-center gap-2 pl-6 pr-5 py-3.5 rounded-full bg-white text-black font-semibold text-[15px] hover:bg-sky-400 transition-colors"
                  >
                    {primaryLabel}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <a
                    href="#features"
                    onClick={(e) => scrollTo(e, '#features')}
                    className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-white/20 text-white/85 text-[15px] font-medium hover:border-white/40 hover:text-white transition-colors"
                  >
                    Explore features
                  </a>
                </div>
              </div>
            </div>

            {/* Chapter 1 — Ledger */}
            <div
              ref={(el) => (chapterRefs.current[1] = el)}
              className="absolute inset-x-0 top-24 md:top-32 pointer-events-none"
              style={{ opacity: 0, visibility: 'hidden' }}
            >
              <div className="max-w-6xl mx-auto px-5 md:px-8">
                <p className="label-mono text-white/50 mb-4">02 — Ledger</p>
                <h2 className="font-display text-[clamp(44px,6.5vw,92px)] leading-[0.9] max-w-[12ch]">
                  Every rupee, <em className="text-sky-400">sorted.</em>
                </h2>
                <p className="mt-5 max-w-sm text-gallery-ash text-[16px] leading-relaxed">
                  Import a bank CSV or type “chai 40 cash”. Rules and the categoriser file each spend in its place — twelve
                  months stacked at a glance.
                </p>
              </div>
            </div>

            {/* Chapter 2 — Budget */}
            <div
              ref={(el) => (chapterRefs.current[2] = el)}
              className="absolute inset-0 flex items-end md:items-center pointer-events-none"
              style={{ opacity: 0, visibility: 'hidden' }}
            >
              <div className="w-full max-w-6xl mx-auto px-5 md:px-8 pb-24 md:pb-0 flex md:justify-end">
                <div className="md:max-w-sm md:text-right">
                  <p className="label-mono text-white/50 mb-4">03 — Budget</p>
                  <h2 className="font-display text-[clamp(44px,6vw,84px)] leading-[0.9]">
                    Budgets that <em className="text-gallery-orchid">breathe.</em>
                  </h2>
                  <p className="mt-5 text-gallery-ash text-[16px] leading-relaxed">
                    50/30/20 envelopes with live pace tracking, rollovers and suggestions drawn from your own history.
                  </p>
                </div>
              </div>
            </div>

            {/* Chapter 3 — Vault */}
            <div
              ref={(el) => (chapterRefs.current[3] = el)}
              className="absolute inset-x-0 bottom-16 md:bottom-20 pointer-events-none text-center"
              style={{ opacity: 0, visibility: 'hidden' }}
            >
              <div className="max-w-2xl mx-auto px-5">
                <p className="label-mono text-white/50 mb-4">04 — Vault</p>
                <h2 className="font-display text-[clamp(44px,6vw,88px)] leading-[0.9]">
                  Sealed in <em className="text-gallery-periwinkle">your</em> {CLOUD_MODE ? 'vault.' : 'browser.'}
                </h2>
                <p className="mt-5 text-gallery-ash text-[16px] leading-relaxed">
                  {CLOUD_MODE
                    ? 'Your ledger lives in a private cloud vault only your account can open — on every device you sign in to, and exportable whenever you like.'
                    : 'Your ledger lives in IndexedDB on this device, works offline as an installable app, and exports whenever you like.'}
                </p>
              </div>
            </div>

            {/* Progress rail */}
            <ol
              aria-hidden="true"
              className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col gap-4 label-mono text-[10px]"
            >
              {CHAPTER_NAMES.map((name, i) => (
                <li
                  key={name}
                  ref={(el) => (railRefs.current[i] = el)}
                  data-active={i === 0}
                  className="group flex items-center justify-end gap-3 text-white/30 data-[active=true]:text-white transition-colors"
                >
                  <span>
                    0{i + 1} {name}
                  </span>
                  <span className="w-2 h-2 rounded-full border border-current group-data-[active=true]:bg-sky-400 group-data-[active=true]:border-sky-400 transition-colors" />
                </li>
              ))}
            </ol>

            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 label-mono text-[10px] text-white/40 flex items-center gap-2 pointer-events-none whitespace-nowrap">
              <ArrowDown className="w-3 h-3 animate-bounce" /> Scroll to sort the chaos · tap to scatter
            </p>
          </div>
        </section>

        {/* ── Sticker tapes ───────────────────────────────────────────────── */}
        <section aria-label="Capabilities" className="tapes relative py-16 md:py-24 overflow-hidden">
          <div className="tape-a -rotate-2 bg-sky-400 text-black py-4 md:py-5 border-y border-black">
            <div className="flex w-max animate-marquee">
              {[0, 1].map((k) => (
                <span
                  key={k}
                  aria-hidden={k === 1}
                  className="flex shrink-0 items-center font-black uppercase tracking-[-0.03em] text-[clamp(32px,5vw,64px)] leading-none"
                >
                  {['Track', 'Budget', 'Forecast', 'Export', 'Ask Gemini', 'Back up'].map((w) => (
                    <span key={w} className="flex items-center px-6">
                      {w}
                      <Plus className="w-8 h-8 ml-12" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <div className="tape-b rotate-[1.5deg] -mt-3 bg-white text-black py-3 border-y border-black">
            <div className="flex w-max animate-marquee [animation-direction:reverse] [animation-duration:36s]">
              {[0, 1].map((k) => (
                <span key={k} aria-hidden={k === 1} className="flex shrink-0 items-center label-mono text-[13px] text-black">
                  {['Indian FY ready', 'UPI · Cards · Cash', 'CSV import', 'Excel & PDF packs', 'Offline PWA', 'Dark mode', 'Recurring EMIs'].map(
                    (w) => (
                      <span key={w} className="px-8">
                        ✦ {w}
                      </span>
                    )
                  )}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Statement ───────────────────────────────────────────────────── */}
        <section aria-label="The idea" className="statement max-w-5xl mx-auto px-5 md:px-8 py-20 md:py-32">
          <p className="label-mono text-white/40 mb-8">The idea</p>
          <p className="font-display text-[clamp(34px,4.6vw,64px)] leading-[1.05] tracking-[-0.01em]">
            {STATEMENT.split(' ').map((w, i) => (
              <span key={i} className="statement-word">
                {w}{' '}
              </span>
            ))}
          </p>
        </section>

        {/* ── Bento features ──────────────────────────────────────────────── */}
        <section
          id="features"
          tabIndex={-1}
          aria-labelledby="features-title"
          className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24 focus:outline-none"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <h2 id="features-title" className="reveal font-display text-[clamp(44px,6vw,84px)] leading-[0.9] max-w-[13ch]">
              Everything a ledger <em>should</em> be.
            </h2>
            <p className="reveal max-w-sm text-gallery-ash leading-relaxed">
              Built for how money actually moves in India — UPI, cards, cash and EMIs — with the polish of an instrument.
            </p>
          </div>

          <div className="bento grid grid-cols-1 md:grid-cols-6 gap-4 text-black">
            <Tile className="md:col-span-4 bg-gallery-iris min-h-[320px] flex flex-col justify-between">
              <div>
                <span className="label-mono text-black/60">Quick add</span>
                <h3 className="font-display text-[44px] md:text-[56px] leading-[0.92] mt-3 max-w-[14ch]">
                  Type it like a text message.
                </h3>
              </div>
              <div className="mt-8 rounded-2xl bg-black/85 text-white p-4 max-w-lg">
                <div className="flex items-center gap-2 text-[14px]">
                  <CornerDownLeft className="w-4 h-4 text-sky-400" aria-hidden="true" /> uber 236 office cab today
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['₹236', 'Transport', 'Today', 'Card'].map((c) => (
                    <span key={c} className="label-mono text-[10px] px-2 py-1 rounded-full border border-white/20">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Tile>

            <Tile className="md:col-span-2 bg-sky-400 min-h-[320px] flex flex-col justify-between">
              <div>
                <span className="label-mono text-black/60 flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5" aria-hidden="true" /> Pace
                </span>
                <h3 className="font-display text-[40px] leading-[0.92] mt-3">Budgets with a pulse.</h3>
              </div>
              <div className="space-y-3 mt-6">
                {[
                  ['Needs', 72],
                  ['Wants', 48],
                  ['Savings', 91],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="flex justify-between text-[12px] font-medium mb-1">
                      <span>{l}</span>
                      <span className="tabular-nums">{v}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/15">
                      <div className="h-full rounded-full bg-black" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Tile>

            <Tile className="md:col-span-2 bg-gallery-orchid min-h-[280px]">
              <span className="label-mono text-black/60 flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" /> Reports
              </span>
              <h3 className="font-display text-[40px] leading-[0.92] mt-3">Reports you’d actually read.</h3>
              <div className="flex flex-wrap gap-2 mt-6">
                {['Excel', 'CSV', 'PDF', 'FY pack'].map((c) => (
                  <span key={c} className="px-3 py-1.5 rounded-full border border-black text-[12px] font-semibold bg-white/40">
                    {c}
                  </span>
                ))}
              </div>
            </Tile>

            <Tile className="md:col-span-2 bg-gallery-periwinkle min-h-[280px]">
              <span className="label-mono text-black/60 flex items-center gap-2">
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" /> Recurring
              </span>
              <h3 className="font-display text-[40px] leading-[0.92] mt-3">Rent, EMIs, remembered.</h3>
              <ul className="mt-5 space-y-1.5 text-[13px] font-medium">
                {['House rent · 1st', 'Car EMI · 5th', 'Music subscription · 12th'].map((r) => (
                  <li key={r} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    {r}
                  </li>
                ))}
              </ul>
            </Tile>

            <Tile className="md:col-span-2 bg-dark-elevated text-white border border-white/10 min-h-[280px]">
              <span className="label-mono text-white/50 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" /> Assistant
              </span>
              <h3 className="font-display text-[40px] leading-[0.92] mt-3">
                Gemini, <em className="text-sky-400">on a leash.</em>
              </h3>
              <p className="mt-4 text-[14px] text-gallery-ash leading-relaxed">
                Ask “where did October go?”. Answers use tools over your ledger, remember what you approve, and see only
                sanitised data.
              </p>
            </Tile>
          </div>
        </section>

        {/* ── Product preview ─────────────────────────────────────────────── */}
        <section
          id="product"
          tabIndex={-1}
          aria-labelledby="product-title"
          className="preview-stage relative py-20 md:py-32 focus:outline-none"
        >
          <div className="absolute inset-x-0 top-1/3 h-2/3 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(132,125,255,0.22),transparent_70%)] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-5 md:px-8 text-center">
            <p className="reveal label-mono text-sky-400 mb-5">The dashboard</p>
            <h2 id="product-title" className="reveal font-display text-[clamp(44px,6.5vw,96px)] leading-[0.9] mx-auto max-w-[14ch]">
              Your month, at a <em>glance.</em>
            </h2>
            <p className="reveal mt-6 text-gallery-ash max-w-lg mx-auto leading-relaxed">
              KPIs, twelve-month trends, category splits, merchant leaderboards and day-of-week heatmaps — tuned for calm,
              not noise.
            </p>
            <div className="mt-14 [perspective:1600px]">
              <div className="preview-frame origin-top">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── Privacy ─────────────────────────────────────────────────────── */}
        <section
          id="privacy"
          tabIndex={-1}
          aria-labelledby="privacy-title"
          className="privacy relative py-20 md:py-28 overflow-hidden focus:outline-none"
        >
          <p
            aria-hidden="true"
            className="yours font-black uppercase text-[clamp(120px,26vw,420px)] leading-[0.78] tracking-[-0.05em] whitespace-nowrap text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.22)] select-none"
          >
            Yours. Yours.
          </p>
          <div className="max-w-6xl mx-auto px-5 md:px-8 -mt-[8vw] relative">
            <h2 id="privacy-title" className="reveal font-display text-[clamp(44px,6vw,84px)] leading-[0.9] max-w-[15ch]">
              Privacy isn’t a setting. It’s the <em className="text-sky-400">architecture.</em>
            </h2>
            <dl className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
              {[
                CLOUD_MODE
                  ? ['Storage', 'A private Firestore vault, encrypted at rest. Rules let only your account in.']
                  : ['Storage', 'IndexedDB on this device. No LedgerLite server holds your ledger.'],
                CLOUD_MODE
                  ? ['Sign-in', 'Google or email. Every vault is isolated to its owner’s account.']
                  : ['Offline', 'Installable PWA. Tracking, budgets and exports work without a network.'],
                ['AI', 'Optional, with your own key. Identifiers are sanitised before anything is sent.'],
                ['Backup', 'One-file JSON export and restore — move devices on your terms.'],
              ].map(([k, v]) => (
                <div key={k} className="bg-dark-bg p-7">
                  <dt className="label-mono text-sky-400">{k}</dt>
                  <dd className="mt-4 text-[15px] leading-relaxed text-gallery-ash">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section aria-labelledby="how-title" className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <h2 id="how-title" className="reveal font-display text-[clamp(40px,5vw,72px)] leading-[0.92] mb-12">
            Three steps to <em>calm.</em>
          </h2>
          <ol className="grid md:grid-cols-3 gap-4">
            {[
              ['01', 'Sign in', 'Email and password or Google. Your vault opens with demo data you can clear any time.'],
              ['02', 'Bring your money', 'Import a bank CSV, set recurring bills, or quick-add in plain English.'],
              ['03', 'Let it sort itself', 'Rules learn from your corrections. Budgets pace. Reports write themselves.'],
            ].map(([n, t, d]) => (
              <li
                key={n}
                className="reveal rounded-card border border-white/10 bg-white/[0.02] p-7 hover:bg-white/[0.04] transition-colors"
              >
                <span className="font-display text-6xl text-white/25">{n}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{t}</h3>
                <p className="mt-2 text-[15px] text-gallery-ash leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section
          id="faq"
          tabIndex={-1}
          aria-labelledby="faq-title"
          className="max-w-4xl mx-auto px-5 md:px-8 py-20 md:py-28 focus:outline-none"
        >
          <h2 id="faq-title" className="reveal font-display text-[clamp(40px,5vw,72px)] leading-[0.92] mb-10">
            Honest answers.
          </h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-6">
                <summary className="flex items-center justify-between gap-6 cursor-pointer list-none text-[18px] md:text-[20px] font-medium tracking-tight rounded-md [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus
                    className="w-5 h-5 shrink-0 text-white/60 transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-4 text-gallery-ash leading-relaxed max-w-2xl">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <section aria-labelledby="cta-title" className="relative overflow-hidden px-5 md:px-8 pt-24 pb-32 md:pt-32 md:pb-44 text-center">
          {/* Ambient light pooled on the page itself — no container */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none bg-[radial-gradient(45%_55%_at_50%_60%,rgba(132,125,255,0.20),transparent_70%),radial-gradient(30%_35%_at_62%_72%,rgba(159,232,112,0.10),transparent_70%)]"
          />
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative">
            <p className="reveal label-mono text-white/40 mb-8">Begin</p>
            <h2
              id="cta-title"
              className="reveal font-display text-[clamp(52px,8vw,120px)] leading-[0.88] tracking-[-0.015em] max-w-[13ch] mx-auto text-gallery-cloud"
            >
              Quiet wealth starts with a <em className="text-white">calm</em> ledger.
            </h2>
            <div className="mt-12 flex justify-center">
              <Link
                ref={ctaRef}
                to={primaryHref}
                className="group inline-flex items-center gap-2 pl-8 pr-7 py-4 rounded-full bg-white text-black font-semibold text-[16px] hover:bg-sky-400 transition-colors"
              >
                {primaryLabel}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="mt-7 label-mono text-white/40">
              {CLOUD_MODE ? 'Free · Private by design · No card required' : 'Free · Works offline · No card required'}
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <BrandMark withWord size={28} />
          <nav aria-label="Footer" className="flex flex-wrap gap-5 text-[13px] text-white/60">
            <a href="#features" onClick={(e) => scrollTo(e, '#features')} className="hover:text-white">
              Features
            </a>
            <a href="#privacy" onClick={(e) => scrollTo(e, '#privacy')} className="hover:text-white">
              Privacy
            </a>
            <a href="#faq" onClick={(e) => scrollTo(e, '#faq')} className="hover:text-white">
              FAQ
            </a>
            <Link to="/signin" className="hover:text-white">
              Sign in
            </Link>
          </nav>
          <p className="label-mono text-[10px] text-white/40">© {new Date().getFullYear()} LedgerLite · Local-first</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
