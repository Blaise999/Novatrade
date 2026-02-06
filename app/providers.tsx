'use client';

/**
 * APP PROVIDERS
 * 
 * Wraps the app with all necessary providers:
 * - AuthProvider (session hydration from localStorage/Supabase)
 * - Web3Provider (Wagmi + RainbowKit + TanStack Query)
 */

import { ReactNode } from 'react';
import { Web3Provider } from '@/lib/wagmi/provider';
import { AuthProvider } from '@/lib/supabase/auth-provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <Web3Provider>
        {children}
      </Web3Provider>
    </AuthProvider>
  );
}
