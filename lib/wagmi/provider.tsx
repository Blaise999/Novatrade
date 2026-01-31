'use client';

/**
 * WEB3 PROVIDER
 * 
 * Wraps app with Wagmi, RainbowKit, and TanStack Query providers.
 * This enables real wallet connections throughout the app.
 * 
 * Usage in layout.tsx:
 *   import { Web3Provider } from '@/lib/wagmi/provider';
 *   
 *   export default function Layout({ children }) {
 *     return <Web3Provider>{children}</Web3Provider>;
 *   }
 */

import { ReactNode, useState, useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, Theme } from '@rainbow-me/rainbowkit';
import { config } from './config';

import '@rainbow-me/rainbowkit/styles.css';

// Custom theme matching Nova Trade's design
const customTheme: Theme = {
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    accentColor: '#F5A623', // Gold
    accentColorForeground: '#0A0B0D', // Void
    connectButtonBackground: '#1A1B1E',
    connectButtonBackgroundError: '#EF4444',
    connectButtonInnerBackground: '#0A0B0D',
    connectButtonText: '#F5F0E5',
    connectButtonTextError: '#FFFFFF',
    modalBackground: '#0A0B0D',
    modalBorder: 'rgba(255, 255, 255, 0.1)',
    modalText: '#F5F0E5',
    modalTextSecondary: 'rgba(245, 240, 229, 0.6)',
    profileForeground: '#1A1B1E',
    selectedOptionBorder: '#F5A623',
  },
  fonts: {
    body: 'Inter, system-ui, sans-serif',
  },
  radii: {
    ...darkTheme().radii,
    connectButton: '12px',
    modal: '16px',
    modalMobile: '16px',
  },
  shadows: {
    ...darkTheme().shadows,
    connectButton: '0 4px 12px rgba(245, 166, 35, 0.15)',
  },
};

// Create query client outside component to persist across renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // Prevent hydration issues by only rendering after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={customTheme}
          modalSize="compact"
          showRecentTransactions={true}
        >
          {/* Only render children after mount to prevent hydration mismatch */}
          {mounted ? children : (
            <div className="min-h-screen bg-void flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
