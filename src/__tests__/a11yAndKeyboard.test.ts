import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isQuickAddShortcutAllowed } from '@/components/layout/Shell';
import {
  getFocusableElements,
  handleFocusTrapKeyDown,
  FOCUSABLE_SELECTORS,
} from '@/lib/a11y/useFocusTrap';

describe('Accessibility & Keyboard Navigation (WCAG AA Compliance)', () => {
  describe('Global "N" Shortcut Suppression (Shell.tsx)', () => {
    it('triggers Quick Add when pressing "N" or "n" on body or normal elements when no dialog is open', () => {
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'BODY' } }, false, false)
      ).toBe(true);
      expect(
        isQuickAddShortcutAllowed({ key: 'N', target: { tagName: 'DIV' } }, false, false)
      ).toBe(true);
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'BUTTON' } }, false, false)
      ).toBe(true);
    });

    it('suppresses shortcut when user is typing in an <input>', () => {
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'INPUT' } }, false, false)
      ).toBe(false);
      expect(
        isQuickAddShortcutAllowed({ key: 'N', target: { tagName: 'INPUT' } }, false, false)
      ).toBe(false);
    });

    it('suppresses shortcut when user is typing in a <textarea>', () => {
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'TEXTAREA' } }, false, false)
      ).toBe(false);
      expect(
        isQuickAddShortcutAllowed({ key: 'N', target: { tagName: 'TEXTAREA' } }, false, false)
      ).toBe(false);
    });

    it('suppresses shortcut when user is selecting in a <select>', () => {
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'SELECT' } }, false, false)
      ).toBe(false);
    });

    it('suppresses shortcut inside contentEditable elements', () => {
      expect(
        isQuickAddShortcutAllowed(
          { key: 'n', target: { tagName: 'DIV', isContentEditable: true } },
          false,
          false
        )
      ).toBe(false);
    });

    it('suppresses shortcut when modifier keys (Ctrl, Cmd/Meta, Alt) are held', () => {
      expect(
        isQuickAddShortcutAllowed(
          { key: 'n', ctrlKey: true, target: { tagName: 'BODY' } },
          false,
          false
        )
      ).toBe(false);
      expect(
        isQuickAddShortcutAllowed(
          { key: 'n', metaKey: true, target: { tagName: 'BODY' } },
          false,
          false
        )
      ).toBe(false);
      expect(
        isQuickAddShortcutAllowed(
          { key: 'n', altKey: true, target: { tagName: 'BODY' } },
          false,
          false
        )
      ).toBe(false);
    });

    it('suppresses shortcut if Quick Add is ALREADY OPEN', () => {
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'BODY' } }, true, false)
      ).toBe(false);
    });

    it('suppresses shortcut if ANY OTHER modal dialog is currently active on screen', () => {
      expect(
        isQuickAddShortcutAllowed({ key: 'n', target: { tagName: 'BODY' } }, false, true)
      ).toBe(false);
    });
  });

  describe('Focus Management & Modal Trap (useFocusTrap.ts)', () => {
    let mockContainer: HTMLElement;
    let btnFirst: HTMLElement;
    let inputMid: HTMLElement;
    let btnLast: HTMLElement;
    let disabledBtn: HTMLElement;
    let hiddenEl: HTMLElement;

    beforeEach(() => {
      // Create mock DOM structure
      const createEl = (tag: string, attrs: Record<string, string> = {}) => {
        const el = {
          tagName: tag.toUpperCase(),
          attributes: { ...attrs },
          hasAttribute: (name: string) => name in attrs,
          getAttribute: (name: string) => attrs[name] ?? null,
          focus: vi.fn(),
          style: {
            display: attrs.style?.includes('display: none') ? 'none' : 'block',
            visibility: attrs.style?.includes('visibility: hidden') ? 'hidden' : 'visible',
          },
        } as unknown as HTMLElement;
        return el;
      };

      btnFirst = createEl('button', { id: 'first-btn' });
      inputMid = createEl('input', { id: 'mid-input' });
      btnLast = createEl('button', { id: 'last-btn' });
      disabledBtn = createEl('button', { id: 'disabled-btn', disabled: '' });
      hiddenEl = createEl('button', { id: 'hidden-btn', 'aria-hidden': 'true' });

      const allChildren = [btnFirst, inputMid, btnLast, disabledBtn, hiddenEl];

      mockContainer = {
        querySelectorAll: (selector: string) => {
          if (selector === FOCUSABLE_SELECTORS) {
            return allChildren.filter(
              (c) =>
                !c.hasAttribute('disabled') &&
                c.getAttribute('aria-hidden') !== 'true' &&
                c.style.display !== 'none'
            );
          }
          return [];
        },
        contains: (node: unknown) => allChildren.includes(node as HTMLElement),
      } as unknown as HTMLElement;
    });

    it('extracts only visible, enabled focusable elements', () => {
      const focusables = getFocusableElements(mockContainer);
      expect(focusables).toHaveLength(3);
      expect(focusables[0]).toBe(btnFirst);
      expect(focusables[1]).toBe(inputMid);
      expect(focusables[2]).toBe(btnLast);
    });

    it('wraps focus from last focusable element to first on Tab keydown', () => {
      // Set document.activeElement to btnLast
      (global as unknown as { document: { activeElement: unknown } }).document = {
        activeElement: btnLast,
      };

      let prevented = false;
      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, mockContainer);
      expect(handled).toBe(true);
      expect(prevented).toBe(true);
      expect(btnFirst.focus).toHaveBeenCalledTimes(1);
    });

    it('wraps focus from first element to last on Shift+Tab keydown', () => {
      // Set document.activeElement to btnFirst
      (global as unknown as { document: { activeElement: unknown } }).document = {
        activeElement: btnFirst,
      };

      let prevented = false;
      const event = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, mockContainer);
      expect(handled).toBe(true);
      expect(prevented).toBe(true);
      expect(btnLast.focus).toHaveBeenCalledTimes(1);
    });

    it('pulls focus back into modal when Tab is pressed and activeElement is outside container', () => {
      // Focus is outside container
      (global as unknown as { document: { activeElement: unknown } }).document = {
        activeElement: { id: 'outside-el' },
      };

      let prevented = false;
      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: () => {
          prevented = true;
        },
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, mockContainer);
      expect(handled).toBe(true);
      expect(prevented).toBe(true);
      expect(btnFirst.focus).toHaveBeenCalledTimes(1);
    });

    it('pulls focus back to last element when Shift+Tab is pressed and activeElement is outside container', () => {
      (global as unknown as { document: { activeElement: unknown } }).document = {
        activeElement: { id: 'outside-el' },
      };

      let prevented = false;
      const event = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: () => {
          prevented = true;
        },
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, mockContainer);
      expect(handled).toBe(true);
      expect(prevented).toBe(true);
      expect(btnLast.focus).toHaveBeenCalledTimes(1);
    });

    it('invokes onClose and stops immediate propagation when Escape key is pressed', () => {
      const onClose = vi.fn();
      let stoppedImmediate = false;
      let prevented = false;

      const event = {
        key: 'Escape',
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: vi.fn(),
        stopImmediatePropagation: () => {
          stoppedImmediate = true;
        },
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, mockContainer, onClose);
      expect(handled).toBe(true);
      expect(prevented).toBe(true);
      expect(stoppedImmediate).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prevents default Tab behavior if modal container has zero focusable elements', () => {
      const emptyContainer = {
        querySelectorAll: () => [],
        contains: () => false,
      } as unknown as HTMLElement;

      let prevented = false;
      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: () => {
          prevented = true;
        },
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, emptyContainer);
      expect(handled).toBe(true);
      expect(prevented).toBe(true);
    });

    it('ignores non-tab and non-escape keys without calling preventDefault', () => {
      let prevented = false;
      const event = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: () => {
          prevented = true;
        },
      } as unknown as KeyboardEvent;

      const handled = handleFocusTrapKeyDown(event, mockContainer);
      expect(handled).toBe(false);
      expect(prevented).toBe(false);
    });
  });

  describe('WCAG AA Color Contrast Ratio Verification', () => {
    // Relative luminance calculation according to WCAG 2.1 specs
    function getLuminance(r: number, g: number, b: number): number {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
    }

    function hexToRgb(hex: string): [number, number, number] {
      const clean = hex.replace('#', '');
      const num = parseInt(clean, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    function getContrastRatio(hex1: string, hex2: string): number {
      const lum1 = getLuminance(...hexToRgb(hex1));
      const lum2 = getLuminance(...hexToRgb(hex2));
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    it('verifies Deep Blue on Cream passes WCAG AA contrast (> 4.5:1)', () => {
      // #16587B (Deep Blue) on #F5EEDD (Cream)
      const contrast = getContrastRatio('#16587B', '#F5EEDD');
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      // Actual ratio is ~6.7:1
      expect(contrast).toBeGreaterThan(6.0);
    });

    it('verifies Dark Vault text contrast exceeds WCAG AAA (> 7.0:1)', () => {
      // Cream text #F5EEDD on Dark Surface #081722
      const contrast = getContrastRatio('#F5EEDD', '#081722');
      expect(contrast).toBeGreaterThan(10.0);
    });
  });
});
