'use client';

/**
 * APP PROVIDERS
 * 
 * Wraps the app with all necessary providers:
 * - Web3Provider (Wagmi + RainbowKit + TanStack Query)
 * - Any other providers can be added here
 */

import { ReactNode } from 'react';
import { Web3Provider } from '@/lib/wagmi/provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Web3Provider>
      {children}
    </Web3Provider>
  );
}
