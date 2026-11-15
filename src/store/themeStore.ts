import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/app';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDocument(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  initTheme: () => {
    let savedTheme = 'dark' as ThemeMode;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        savedTheme = stored;
      }
    } catch {
      // localStorage may fail in private mode
    }

    const resolved = savedTheme === 'system' ? getSystemTheme() : savedTheme;
    applyThemeToDocument(resolved);
    set({ theme: savedTheme, resolvedTheme: resolved });

    // Listen to OS changes if system theme
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (get().theme === 'system') {
          const newResolved = getSystemTheme();
          applyThemeToDocument(newResolved);
          set({ resolvedTheme: newResolved });
        }
      });
    }
  },

  setTheme: (theme: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // Ignore
    }
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    applyThemeToDocument(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const current = get().resolvedTheme;
    const next = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));
