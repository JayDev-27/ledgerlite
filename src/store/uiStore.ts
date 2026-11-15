import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/app';

interface UiState {
  isQuickAddOpen: boolean;
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  isDbSeeded: boolean;
  activeModal: string | null;

  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  toggleQuickAdd: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setDbSeeded: (seeded: boolean) => void;
  setActiveModal: (modalId: string | null) => void;
}

export const useUiStore = create<UiState>((set) => {
  let initialSidebarCollapsed = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
    if (saved !== null) {
      initialSidebarCollapsed = JSON.parse(saved);
    }
  } catch {
    // Ignore
  }

  return {
    isQuickAddOpen: false,
    isSidebarCollapsed: initialSidebarCollapsed,
    isMobileNavOpen: false,
    isDbSeeded: false,
    activeModal: null,

    openQuickAdd: () => set({ isQuickAddOpen: true }),
    closeQuickAdd: () => set({ isQuickAddOpen: false }),
    toggleQuickAdd: () => set((state) => ({ isQuickAddOpen: !state.isQuickAddOpen })),

    toggleSidebar: () =>
      set((state) => {
        const next = !state.isSidebarCollapsed;
        try {
          localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return { isSidebarCollapsed: next };
      }),

    setSidebarCollapsed: (collapsed: boolean) => {
      try {
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
      } catch {
        // Ignore
      }
      set({ isSidebarCollapsed: collapsed });
    },

    setMobileNavOpen: (open: boolean) => set({ isMobileNavOpen: open }),
    setDbSeeded: (seeded: boolean) => set({ isDbSeeded: seeded }),
    setActiveModal: (modalId: string | null) => set({ activeModal: modalId }),
  };
});
