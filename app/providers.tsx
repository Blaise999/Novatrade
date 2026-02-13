'use client';

/**
 * APP PROVIDERS
 * 
 * Wraps the app with all necessary providers:
 * - AuthProvider (session hydration from localStorage/Supabase)
 * - Web3Provider (Wagmi + RainbowKit + TanStack Query)
 * 
 * ✅ HYDRATION FIX: Web3Provider is loaded with next/dynamic ssr:false
 * because RainbowKit/Wagmi inject portal elements & styles during SSR
 * that cause React #418 (hydration mismatch) on the client.
 */

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider } from '@/lib/supabase/auth-provider';

// ✅ HYDRATION FIX: Load Web3Provider client-only to prevent SSR mismatch
const Web3Provider = dynamic(
  () => import('@/lib/wagmi/provider').then(mod => ({ default: mod.Web3Provider })),
  {
    ssr: false,
    loading: () => null, // AuthProvider handles loading state
  }
);

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
