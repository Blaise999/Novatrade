'use client';

/**
 * SUPABASE AUTH PROVIDER
 * 
 * Wrap your app with this to automatically handle auth state.
 * 
 * Usage in layout.tsx:
 * 
 *   import { AuthProvider } from '@/lib/supabase/auth-provider';
 *   
 *   export default function Layout({ children }) {
 *     return (
 *       <AuthProvider>
 *         {children}
 *       </AuthProvider>
 *     );
 *   }
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useStore } from '../store-supabase';

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: ReturnType<typeof useStore>['user'];
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, checkSession } = useStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Check session on mount
    checkSession().finally(() => setInitialized(true));
  }, [checkSession]);

  // Show loading spinner while checking session
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
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
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
export function withAdmin<P extends object>(Component: React.ComponentType<P>) {
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
