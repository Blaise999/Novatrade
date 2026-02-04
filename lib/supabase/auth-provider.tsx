'use client';

/**
 * SUPABASE AUTH PROVIDER
 *
 * Wrap your app with this to automatically handle auth state.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type ComponentType,
} from 'react';
import { useStore } from './store-supabase';

type AuthUser = {
  id?: string;
  email?: string;
  role?: string;
  [key: string]: any;
};

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: false,
  isAuthenticated: false,
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // ✅ Use selectors so TS stays correct and we don’t rely on `any`
  const user = useStore((s) => s.user) as any as AuthUser | null;
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const storeLoading = useStore((s) => s.isLoading);
  const checkSession = useStore((s) => s.checkSession);

  // ✅ Prevent redirects until we’ve at least tried checkSession once
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let alive = true;

    // Run once on mount
    Promise.resolve(checkSession())
      .catch(() => {
        // ignore; store handles error state
      })
      .finally(() => {
        if (alive) setInitialized(true);
      });

    return () => {
      alive = false;
    };
  }, [checkSession]);

  // ✅ During init we force "loading" so HOCs don’t redirect early
  const ctxValue: AuthContextType = {
    isLoading: !initialized || storeLoading,
    isAuthenticated: initialized && isAuthenticated,
    user: initialized ? user : null,
  };

  return <AuthContext.Provider value={ctxValue}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}

// HOC to protect routes
export function withAuth<P extends object>(Component: ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return null;
    }

    return <Component {...props} />;
  };
}

// HOC to protect admin routes
export function withAdmin<P extends object>(Component: ComponentType<P>) {
  return function AdminComponent(props: P) {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-loss border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!isAuthenticated || user?.role !== 'admin') {
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
      return null;
    }

    return <Component {...props} />;
  };
}
