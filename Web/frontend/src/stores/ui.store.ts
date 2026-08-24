import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'auto';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

const getInitialTheme = (): 'light' | 'dark' | 'auto' => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('tia-theme') as 'light' | 'dark' | 'auto' | null;
    if (stored) return stored;
  }
  return 'auto';
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: getInitialTheme(),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => {
    localStorage.setItem('tia-theme', theme);
    set({ theme });
  },
}));
