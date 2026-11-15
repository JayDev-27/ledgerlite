import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User, CheckCircle2, Info } from 'lucide-react';
import clsx from 'clsx';
import { HeroCanvas } from '@/features/landing/components/HeroCanvas';
import { BrandMark } from '@/components/brand/BrandMark';
import { useAuth } from '@/lib/auth/AuthProvider';
import { friendlyAuthError } from '@/lib/auth/types';
import { AuthSplash } from '@/components/auth/RequireAuth';
import { CLOUD_MODE } from '@/lib/auth/firebase';

type Mode = 'signin' | 'signup' | 'reset';

const GoogleG: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return pw.length < 8 ? 0 : Math.min(4, s);
}
const STRENGTH = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'];
const STRENGTH_COLOR = ['bg-white/15', 'bg-[#FB4903]', 'bg-[#FFD731]', 'bg-sky-400', 'bg-sky-400'];

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ComponentType<{ className?: string }>;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  trailing?: React.ReactNode;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

const Field: React.FC<FieldProps> = ({
  label,
  type,
  value,
  onChange,
  icon: Icon,
  autoComplete,
  required,
  minLength,
  trailing,
  invalid,
  describedBy,
  inputRef,
}) => {
  const id = useId();
  return (
    <div
      className={clsx(
        'group relative rounded-2xl border bg-white/[0.03] transition-colors focus-within:bg-white/[0.06]',
        invalid ? 'border-[#FB4903]/70' : 'border-white/10 focus-within:border-sky-400/70 hover:border-white/20'
      )}
    >
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-sky-400 transition-colors" />
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder=" "
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="peer w-full bg-transparent pl-11 pr-12 pt-6 pb-2.5 text-[15px] text-white placeholder-transparent rounded-2xl focus:outline-none focus-visible:outline-none [&:-webkit-autofill]:[-webkit-text-fill-color:#fff] [&:-webkit-autofill]:[transition:background-color_9999s]"
      />
      <label
        htmlFor={id}
        className="absolute left-11 top-1/2 -translate-y-1/2 text-[15px] text-white/45 pointer-events-none transition-all duration-200 peer-focus:top-4 peer-focus:text-[11px] peer-focus:text-sky-400 peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[11px]"
      >
        {label}
      </label>
      {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  );
};

export const SignInPage: React.FC = () => {
  const {
    user,
    loading,
    mode: authMode,
    googleAvailable,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const strengthId = useId();

  const from = (location.state as { from?: string } | null)?.from || '/app';
  const strength = useMemo(() => scorePassword(password), [password]);

  useEffect(() => {
    document.title =
      mode === 'signup' ? 'Create account — LedgerLite' : mode === 'reset' ? 'Reset password — LedgerLite' : 'Sign in — LedgerLite';
  }, [mode]);

  if (loading) return <AuthSplash />;
  if (user) return <Navigate to={from} replace />;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
    if (m !== 'reset') setParams(m === 'signup' ? { mode: 'signup' } : {}, { replace: true, state: location.state });
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(friendlyAuthError({ code: 'auth/invalid-email' }));
      emailRef.current?.focus();
      return;
    }
    if (mode !== 'reset' && !password) {
      setError('Enter your password.');
      return;
    }
    setBusy('email');
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setNotice('If an account exists for that email, a reset link is on its way.');
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
        navigate(from, { replace: true });
      } else {
        await signInWithEmail(email, password);
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const heading = mode === 'signup' ? 'Open your vault.' : mode === 'reset' ? 'Reset password.' : 'Welcome back.';
  const sub =
    mode === 'signup'
      ? 'Create an account to start a private, local-first ledger.'
      : mode === 'reset'
        ? 'Enter your email and we’ll send a secure reset link.'
        : 'Sign in to continue to your ledger.';

  return (
    <div className="min-h-[100svh] bg-dark-bg text-gallery-cloud grid lg:grid-cols-[1.1fr_1fr]">
      {/* ── Visual panel ─────────────────────────────────────────────────── */}
      <aside className="relative hidden lg:block overflow-hidden noise border-r border-white/[0.06]">
        <HeroCanvas className="absolute inset-0" fixedProgress={1} coinCount={180} />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(90%_70%_at_50%_45%,transparent_35%,rgba(11,12,13,0.9)_100%)]" />
        <div className="relative z-10 h-full flex flex-col justify-between p-10 pointer-events-none">
          <Link to="/" className="pointer-events-auto self-start rounded-full" aria-label="LedgerLite home">
            <BrandMark withWord size={34} />
          </Link>
          <div>
            <p className="label-mono text-sky-400 mb-5">Local-first · Private by design</p>
            <p className="font-display text-[clamp(44px,4.6vw,72px)] leading-[0.92] max-w-[12ch]">
              {CLOUD_MODE ? (
                <>
                  Your ledger, <em>yours alone.</em>
                </>
              ) : (
                <>
                  Your ledger never leaves <em>this device.</em>
                </>
              )}
            </p>
            <p className="mt-5 text-gallery-ash max-w-sm text-[15px] leading-relaxed">
              {CLOUD_MODE
                ? 'Your transactions, budgets and reports live in a private vault that only your account can open — on any device.'
                : 'Sign-in identifies you. Your transactions, budgets and reports stay in this browser’s storage.'}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Form panel ───────────────────────────────────────────────────── */}
      <main className="relative flex flex-col min-h-[100svh]">
        <div className="lg:hidden absolute inset-x-0 top-0 h-72 pointer-events-none bg-[radial-gradient(60%_80%_at_50%_0%,rgba(132,125,255,0.35),transparent_70%)]" />

        <div className="relative flex items-center justify-between px-6 md:px-10 pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-white rounded-full px-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <span className="lg:hidden">
            <BrandMark size={30} />
          </span>
        </div>

        <div className="relative flex-1 flex items-center justify-center px-6 md:px-10 py-10">
          <div className="w-full max-w-[420px] animate-fadeIn">
            {mode !== 'reset' && (
              <div
                role="tablist"
                aria-label="Account"
                className="liquid-glass relative grid grid-cols-2 p-1 rounded-full mb-10"
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    'absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-sky-400 transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    mode === 'signup' && 'translate-x-full'
                  )}
                />
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={clsx(
                      'relative z-10 py-2.5 rounded-full text-[13px] font-semibold transition-colors',
                      mode === m ? 'text-black' : 'text-white/60 hover:text-white'
                    )}
                  >
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
            )}

            <h1 className="font-display text-[56px] leading-[0.9] tracking-[-0.01em]">{heading}</h1>
            <p className="mt-3 text-gallery-ash text-[15px]">{sub}</p>

            {mode !== 'reset' && (
              <>
                <button
                  type="button"
                  onClick={onGoogle}
                  disabled={busy !== null}
                  aria-describedby={!googleAvailable ? 'google-note' : undefined}
                  className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-full bg-white text-black py-3.5 text-[15px] font-semibold hover:bg-cream-200 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {busy === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleG />}
                  Continue with Google
                </button>

                <div className="my-7 flex items-center gap-4" aria-hidden="true">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="label-mono text-[10px] text-white/40">or with email</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              </>
            )}

            <form onSubmit={onSubmit} noValidate className={clsx('space-y-3', mode === 'reset' && 'mt-8')}>
              {mode === 'signup' && (
                <Field label="Full name (optional)" type="text" value={name} onChange={setName} icon={User} autoComplete="name" />
              )}
              <Field
                inputRef={emailRef}
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                icon={Mail}
                autoComplete="email"
                required
                invalid={Boolean(error) && /email/i.test(error ?? '')}
                describedBy={error ? errorId : undefined}
              />
              {mode !== 'reset' && (
                <Field
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  icon={Lock}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  describedBy={[error ? errorId : '', mode === 'signup' ? strengthId : ''].filter(Boolean).join(' ') || undefined}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      aria-pressed={showPw}
                      className="p-2.5 rounded-full text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              )}

              {mode === 'signup' && (
                <div id={strengthId} className="pt-1" aria-live="polite">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={clsx(
                          'h-1 rounded-full transition-colors duration-300',
                          strength >= i ? STRENGTH_COLOR[strength] : 'bg-white/10'
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-2 label-mono text-[10px] text-white/50">
                    {password ? `Password strength: ${STRENGTH[strength]}` : 'At least 8 characters'}
                  </p>
                </div>
              )}

              {mode === 'signin' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-[13px] text-white/55 hover:text-sky-400 transition-colors rounded px-1"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <div aria-live="assertive" id={errorId}>
                {error && (
                  <p className="flex items-start gap-2 rounded-2xl border border-[#FB4903]/40 bg-[#FB4903]/10 px-4 py-3 text-[13px] text-[#ffc2ab] animate-fadeIn">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                  </p>
                )}
              </div>
              <div aria-live="polite">
                {notice && (
                  <p className="flex items-start gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-[13px] text-sky-200 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {notice}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy !== null}
                className="group w-full mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-deep-blue-500 text-white py-3.5 text-[15px] font-semibold hover:bg-deep-blue-600 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_10px_40px_-12px_rgba(91,84,232,0.8)]"
              >
                {busy === 'email' ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-label="Working" />
                ) : (
                  <>
                    {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full text-center text-[13px] text-white/55 hover:text-white pt-2"
                >
                  Back to sign in
                </button>
              )}
            </form>

            {authMode === 'local' && (
              <p id="google-note" className="mt-8 flex items-start gap-2 text-[12px] leading-relaxed text-white/50">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-400" />
                On-device account mode: your password is hashed (PBKDF2) and kept only in this browser. Google sign-in and
                password reset switch on once Firebase keys are configured.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignInPage;
