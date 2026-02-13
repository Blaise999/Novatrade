/**
 * UI STORE — standalone file
 * Sidebar, mobile menu, theme state
 */
import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';

interface UIStore {
  sidebarOpen: boolean;

  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;

  mobileNavOpen: boolean;
  toggleMobileNav: () => void;

  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  setMobileMenuOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true,

  mobileMenuOpen: false,
  mobileNavOpen: false,

  toggleMobileMenu: () => {
    const next = !get().mobileMenuOpen;
    set({ mobileMenuOpen: next, mobileNavOpen: next });
  },

  toggleMobileNav: () => {
    const next = !get().mobileNavOpen;
    set({ mobileNavOpen: next, mobileMenuOpen: next });
  },

  theme: 'system',
  setTheme: (theme) => set({ theme }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open, mobileNavOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open, mobileMenuOpen: open }),
}));
