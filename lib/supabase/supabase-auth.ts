/**
 * Supabase Authentication Service
 *
 * Handles ALL user authentication - replaces localStorage auth
 */

import { supabase } from '.client';

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
    role: row.role || 'user',
    tier: row.tier || 'basic',
    balance: {
      available: parseFloat(row.balance_available) || 0,
      bonus: parseFloat(row.balance_bonus) || 0,
    },
    totalDeposited: parseFloat(row.total_deposited) || 0,
    kycStatus: row.kyc_status || 'none',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  };
}

export const authService = {
  /**
   * Sign up a new user
   */
  async signUp(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
          },
        },
      });

      if (authError) {
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Failed to create user' };
      }

      // If no session (email confirm required), stop here (login will create profile after confirmation)
      if (!authData.session) {
        return { user: null, error: null };
      }

      // 2. Create user profile in our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: (authData.user.email || email).toLowerCase(),
          first_name: firstName || '',
          last_name: lastName || '',
          role: 'user',
          tier: 'basic',
          balance_available: 0,
          balance_bonus: 0,
          total_deposited: 0,
          kyc_status: 'none',
          registration_status: 'pending_kyc',
          is_active: true,
        })
        .select()
        .single();

      if (userError || !userData) {
        console.error('Error creating user profile:', userError);
        return { user: null, error: 'Account created but profile failed. Please login again.' };
      }

      return { user: rowToUser(userData), error: null };
    } catch (err: any) {
      return { user: null, error: err?.message || 'Signup failed' };
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

      // 2. Get user profile (SAFE)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      // If profile missing, create it and RETURN
      if (!userData) {
        const metadata = authData.user.user_metadata || {};

        const { data: newUser, error: newUserError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: (authData.user.email || email).toLowerCase(),
            first_name: metadata.first_name || '',
            last_name: metadata.last_name || '',
            role: 'user',
            tier: 'basic',
            balance_available: 0,
            balance_bonus: 0,
            total_deposited: 0,
            kyc_status: 'none',
            registration_status: 'pending_kyc',
            is_active: true,
          })
          .select()
          .single();

        if (newUserError || !newUser) {
          return { user: null, error: newUserError?.message || userError?.message || 'Failed to create profile' };
        }

        return { user: rowToUser(newUser), error: null };
      }

      // Check if user is active
      if (!userData.is_active) {
        await supabase.auth.signOut();
        return { user: null, error: 'Account is disabled. Please contact support.' };
      }

      return { user: rowToUser(userData), error: null };
    } catch (err: any) {
      return { user: null, error: err?.message || 'Login failed' };
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
      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes.session;

      if (!session?.user) {
        return null;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      return userData ? rowToUser(userData) : null;
    } catch {
      return null;
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string;
    }
  ): Promise<{ success: boolean; error: string | null }> {
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

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Update failed' };
    }
  },

  /**
   * Change password
   */
  async changePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Password change failed' };
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

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Reset failed' };
    }
  },

  /**
   * Listen for auth changes
   */
  onAuthChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!session?.user) {
          callback(null);
          return;
        }

        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        callback(data ? rowToUser(data) : null);
      } catch {
        callback(null);
      }
    });
  },
};

// ============================================
// ADMIN AUTH SERVICE
// ============================================

export const adminAuthService = {
  async isAdmin(): Promise<boolean> {
    const user = await authService.getCurrentUser();
    return user?.role === 'admin';
  },

  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const result = await authService.signIn(email, password);

    if (result.user && result.user.role !== 'admin') {
      await authService.signOut();
      return { user: null, error: 'Access denied. Admin privileges required.' };
    }

    return result;
  },
};
