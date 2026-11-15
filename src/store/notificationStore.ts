import { create } from 'zustand';

export interface AppNotification {
  id: string;
  tone: 'info' | 'action' | 'warning';
  title: string;
  body?: string;
  primary?: { label: string; to?: string; onClick?: () => void };
  secondary?: { label: string; onClick: () => void };
  dismissible?: boolean;
}

interface NotificationState {
  items: AppNotification[];
  upsert: (n: AppNotification) => void;
  remove: (id: string) => void;
}

/** In-app notices shown in the header bell instead of page banners. */
export const useNotifications = create<NotificationState>((set) => ({
  items: [],
  upsert: (n) =>
    set((s) => ({
      items: s.items.some((i) => i.id === n.id) ? s.items.map((i) => (i.id === n.id ? n : i)) : [...s.items, n],
    })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
