/**
 * Supabase Authentication Service
 * 
 * Handles ALL user authentication - replaces localStorage auth
 */

import { supabase } from './supabase-client';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  tier: 'basic' | 'starter' | 'pro' | 'elite' | 'vip';
  balance: {
    available: number;
    bonus: number;
  };
  totalDeposited: number;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  isActive: boolean;
  createdAt: string;
}

// Convert database row to User object
function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role,
    tier: row.tier,
    balance: {
      available: parseFloat(row.balance_available) || 0,
      bonus: parseFloat(row.balance_bonus) || 0,
    },
    totalDeposited: parseFloat(row.total_deposited) || 0,
    kycStatus: row.kyc_status,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export const authService = {
  /**
   * Sign up a new user
   */
  async signUp(email: string, password: string, firstName?: string, lastName?: string): Promise<{ user: User | null; error: string | null }> {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Failed to create user' };
      }

      // 2. Create user profile in our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role: 'user',
          tier: 'basic',
          balance_available: 0,
          balance_bonus: 0,
          total_deposited: 0,
          kyc_status: 'none',
          is_active: true,
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating user profile:', userError);
        return { user: null, error: 'Account created but profile failed. Please contact support.' };
      }

      return { user: rowToUser(userData), error: null };
    } catch (err: any) {
      return { user: null, error: err.message };
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      // 1. Authenticate
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Invalid credentials' };
      }

      // 2. Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        // Profile doesn't exist, create it
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email.toLowerCase(),
            role: 'user',
            tier: 'basic',
          })
          .select()
          .single();
        
        return { user: newUser ? rowToUser(newUser) : null, error: null };
      }

      // Check if user is active
      if (!userData.is_active) {
        await supabase.auth.signOut();
        return { user: null, error: 'Account is disabled. Please contact support.' };
      }

      return { user: rowToUser(userData), error: null };
    } catch (err: any) {
      return { user: null, error: err.message };
    }
  },

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Get current session user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return null;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      return userData ? rowToUser(userData) : null;
    } catch {
      return null;
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: updates.firstName,
          last_name: updates.lastName,
          phone: updates.phone,
          avatar_url: updates.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Change password
   */
  async changePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Listen for auth changes
   */
  onAuthChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        callback(data ? rowToUser(data) : null);
      } else {
        callback(null);
      }
    });
  },
};

// ============================================
// ADMIN AUTH SERVICE
// ============================================

export const adminAuthService = {
  /**
   * Check if current user is admin
   */
  async isAdmin(): Promise<boolean> {
    const user = await authService.getCurrentUser();
    return user?.role === 'admin';
  },

  /**
   * Admin sign in (same as regular but checks role)
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const result = await authService.signIn(email, password);
    
    if (result.user && result.user.role !== 'admin') {
      await authService.signOut();
      return { user: null, error: 'Access denied. Admin privileges required.' };
    }

    return result;
  },
};
