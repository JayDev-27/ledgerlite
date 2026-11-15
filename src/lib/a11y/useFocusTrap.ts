import { useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  autoFocus?: boolean;
}

/**
 * Returns an array of visible, interactive focusable elements inside a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  ).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility();
    }
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    }
    return true;
  });
}

/**
 * Handles Tab, Shift+Tab, and Escape key events for modal focus trapping.
 * Returns true if the key event was trapped/handled.
 */
export function handleFocusTrapKeyDown(
  e: KeyboardEvent,
  container: HTMLElement | null,
  onClose?: () => void
): boolean {
  if (e.key === 'Escape') {
    if (onClose) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      onClose();
      return true;
    }
    return false;
  }

  if (e.key !== 'Tab' || !container) return false;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    e.preventDefault();
    return true;
  }

  const firstElement = focusables[0];
  const lastElement = focusables[focusables.length - 1];

  if (!firstElement || !lastElement) return false;

  const activeElement = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  if (e.shiftKey) {
    // Shift + Tab: if on first element or outside container, wrap to last
    if (activeElement === firstElement || (activeElement && !container.contains(activeElement))) {
      e.preventDefault();
      lastElement.focus();
      return true;
    }
  } else {
    // Tab: if on last element or outside container, wrap to first
    if (activeElement === lastElement || (activeElement && !container.contains(activeElement))) {
      e.preventDefault();
      firstElement.focus();
      return true;
    }
  }

  return false;
}

/**
 * WCAG AA compliant Focus Trap hook for modal dialogs.
 * - Traps Tab and Shift+Tab navigation within the modal container.
 * - Listens for Escape key to trigger onClose.
 * - Preserves and restores focus to the previously active element upon unmount / close.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions
) {
  const { isOpen, onClose, autoFocus = true } = options;
  const containerRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save current active element to restore later
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    const container = containerRef.current;
    if (container && autoFocus) {
      const focusables = getFocusableElements(container);
      const firstFocusable = focusables[0];
      if (firstFocusable) {
        requestAnimationFrame(() => {
          firstFocusable.focus();
        });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      handleFocusTrapKeyDown(e, containerRef.current, onClose);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
      // Restore focus to original element
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, autoFocus]);

  return containerRef;
}
