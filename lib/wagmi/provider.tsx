'use client';

/**
 * WEB3 PROVIDER
 *
 * Wraps app with Wagmi, RainbowKit, and TanStack Query providers.
 *
 * ✅ HYDRATION NOTE: This component is ONLY mounted client-side
 * (Providers.tsx gates it behind a mounted check). So we don't need
 * our own mounted guard for hydration — but we keep it for RainbowKit
 * modal styling stability.
 */

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, Theme } from '@rainbow-me/rainbowkit';
import { config } from './config';

import '@rainbow-me/rainbowkit/styles.css';

const customTheme: Theme = {
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    accentColor: '#F5A623',
    accentColorForeground: '#0A0B0D',
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // No mounted guard needed — this component is only rendered client-side
  // by Providers.tsx (which gates on its own mounted state)
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={customTheme}
          modalSize="compact"
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
