import { create } from 'zustand';
import { settingsService } from '@/services/settings.service';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'auto';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  hydrateThemeFromBackend: () => Promise<void>;
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
  hydrateThemeFromBackend: async () => {
    try {
      const data = await settingsService.getPreferences();
      if (data?.theme && ['light', 'dark', 'auto'].includes(data.theme)) {
        localStorage.setItem('tia-theme', data.theme);
        set({ theme: data.theme as 'light' | 'dark' | 'auto' });
      }
    } catch {
      // keep local value
    }
  },
}));
