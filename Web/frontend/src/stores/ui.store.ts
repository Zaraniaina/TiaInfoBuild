import { create } from 'zustand';
import { settingsService } from '@/services/settings.service';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  hydrateThemeFromBackend: () => Promise<void>;
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('tia-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'light';
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
      if (data?.theme && ['light', 'dark'].includes(data.theme)) {
        localStorage.setItem('tia-theme', data.theme);
        set({ theme: data.theme as 'light' | 'dark' });
      }
    } catch {
      // keep local value
    }
  },
}));
