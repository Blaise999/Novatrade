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
  isLoading: true,
  isAuthenticated: false,
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // ✅ Your store typings currently resolve to `unknown`, so TS won't allow `.user`
  // We safely read fields via `any` and then cast to our own AuthUser type.
  const store = useStore() as any;

  const user = (store?.user ?? null) as AuthUser | null;
  const isAuthenticated = Boolean(store?.isAuthenticated);
  const isLoading = Boolean(store?.isLoading);
  const checkSession = (store?.checkSession ??
    (async () => {})) as () => Promise<any>;

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    checkSession().finally(() => setInitialized(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cream/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, user }}>
      {children}
    </AuthContext.Provider>
  );
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
