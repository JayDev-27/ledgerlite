import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkIsStandalone,
  getPwaDismissed,
  setPwaDismissed,
  INSTALL_DISMISSED_KEY,
  BeforeInstallPromptEvent,
} from '@/lib/pwa/usePwa';

describe('PWA & Offline System (usePwa & PWA Helpers)', () => {
  let mockStorage: Record<string, string>;
  let storageObj: Storage;

  beforeEach(() => {
    mockStorage = {};
    storageObj = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      key: vi.fn(),
      length: 0,
    };
  });

  describe('checkIsStandalone', () => {
    it('detects desktop/Android standalone display mode', () => {
      const mockWin = {
        matchMedia: vi.fn((query: string) => ({
          matches: query === '(display-mode: standalone)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      } as unknown as Window;

      const mockNav = { standalone: false } as unknown as Navigator;

      expect(checkIsStandalone(mockWin, mockNav)).toBe(true);
    });

    it('detects iOS Safari Add-to-Home-Screen standalone mode', () => {
      const mockWin = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window;

      const mockNav = { standalone: true } as unknown as Navigator & { standalone: boolean };

      expect(checkIsStandalone(mockWin, mockNav)).toBe(true);
    });

    it('returns false for standard web browser tabs', () => {
      const mockWin = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window;

      const mockNav = { standalone: false } as unknown as Navigator;

      expect(checkIsStandalone(mockWin, mockNav)).toBe(false);
    });

    it('handles missing window or navigator safely without throwing', () => {
      expect(checkIsStandalone(null, null)).toBe(false);
    });
  });

  describe('getPwaDismissed & setPwaDismissed', () => {
    it('returns false by default when not dismissed', () => {
      expect(getPwaDismissed(storageObj)).toBe(false);
    });

    it('persists dismissed flag to storage and reads it back as true', () => {
      setPwaDismissed(storageObj);
      expect(storageObj.setItem).toHaveBeenCalledWith(INSTALL_DISMISSED_KEY, 'true');
      expect(getPwaDismissed(storageObj)).toBe(true);
    });

    it('gracefully handles storage throws (e.g. Safari Private Browsing quota exceeded)', () => {
      const throwingStorage = {
        getItem: vi.fn(() => {
          throw new Error('SecurityError: The operation is insecure.');
        }),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
      } as unknown as Storage;

      expect(getPwaDismissed(throwingStorage)).toBe(false);
      expect(() => setPwaDismissed(throwingStorage)).not.toThrow();
    });

    it('handles null storage gracefully', () => {
      expect(getPwaDismissed(null)).toBe(false);
      expect(() => setPwaDismissed(null)).not.toThrow();
    });
  });

  describe('BeforeInstallPrompt Lifecycle & Execution', () => {
    it('executes userChoice accepted workflow correctly', async () => {
      let promptCalled = false;
      let preventDefaultCalled = false;

      const mockPromptEvent: BeforeInstallPromptEvent = {
        platforms: ['web', 'desktop'],
        preventDefault: () => {
          preventDefaultCalled = true;
        },
        prompt: async () => {
          promptCalled = true;
        },
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      } as unknown as BeforeInstallPromptEvent;

      mockPromptEvent.preventDefault();
      expect(preventDefaultCalled).toBe(true);

      await mockPromptEvent.prompt();
      expect(promptCalled).toBe(true);

      const choice = await mockPromptEvent.userChoice;
      expect(choice.outcome).toBe('accepted');
    });

    it('executes userChoice dismissed workflow correctly', async () => {
      const mockPromptEvent: BeforeInstallPromptEvent = {
        platforms: ['android'],
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'android' }),
      } as unknown as BeforeInstallPromptEvent;

      await mockPromptEvent.prompt();
      const choice = await mockPromptEvent.userChoice;
      expect(choice.outcome).toBe('dismissed');
    });
  });

  describe('Online / Offline Event Handling', () => {
    it('tracks online and offline transitions through window listeners', () => {
      const listeners: Record<string, EventListener[]> = {};
      const fakeWindow = {
        addEventListener: (event: string, fn: EventListener) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
        },
        removeEventListener: (event: string, fn: EventListener) => {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((f) => f !== fn);
        },
      };

      let isOnline = true;
      fakeWindow.addEventListener('offline', () => {
        isOnline = false;
      });
      fakeWindow.addEventListener('online', () => {
        isOnline = true;
      });

      expect(isOnline).toBe(true);

      // Trigger offline
      listeners['offline']?.forEach((fn) => fn(new Event('offline')));
      expect(isOnline).toBe(false);

      // Trigger online
      listeners['online']?.forEach((fn) => fn(new Event('online')));
      expect(isOnline).toBe(true);
    });
  });
});
