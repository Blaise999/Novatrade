'use client';

/**
 * APP PROVIDERS
 *
 * ✅ HYDRATION FIX:
 * - Server renders: AuthProvider → children (page content IS in server HTML)
 * - Client 1st render: same (mounted=false, so Web3 wrapper is skipped)
 * - Client after useEffect: AuthProvider → Web3Provider → children
 *
 * This ensures server HTML matches client first render (no hydration mismatch).
 * Web3/RainbowKit wrapping is added AFTER hydration completes.
 *
 * The old approach used `next/dynamic({ ssr: false })` which SWALLOWED {children}
 * on the server (loading:()=>null ate the page content) → empty server HTML →
 * massive #418 hydration mismatch → #423 recovery → appendChild DOM errors.
 */

import { ReactNode, useState, useEffect } from 'react';
import { AuthProvider } from '@/lib/supabase/auth-provider';
import { Web3Provider } from '@/lib/wagmi/provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <AuthProvider>
      {mounted ? (
        <Web3Provider>{children}</Web3Provider>
      ) : (
        children
      )}
    </AuthProvider>
  );
}
