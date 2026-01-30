import { createClient } from '@supabase/supabase-js';

// These will come from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for API routes)
export const createServerClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Database types (generate these with: npx supabase gen types typescript)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: 'user' | 'admin';
          tier: 'basic' | 'starter' | 'pro' | 'elite' | 'vip';
          balance_available: number;
          balance_bonus: number;
          total_deposited: number;
          kyc_status: 'none' | 'pending' | 'verified' | 'rejected';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin';
          tier?: 'basic' | 'starter' | 'pro' | 'elite' | 'vip';
          balance_available?: number;
          balance_bonus?: number;
          total_deposited?: number;
          kyc_status?: 'none' | 'pending' | 'verified' | 'rejected';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin';
          tier?: 'basic' | 'starter' | 'pro' | 'elite' | 'vip';
          balance_available?: number;
          balance_bonus?: number;
          total_deposited?: number;
          kyc_status?: 'none' | 'pending' | 'verified' | 'rejected';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      deposits: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          method: 'crypto' | 'bank' | 'processor';
          method_id: string;
          method_name: string;
          transaction_ref: string | null;
          proof_url: string | null;
          status: 'pending' | 'confirmed' | 'rejected';
          processed_by: string | null;
          processed_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          method: 'crypto' | 'bank' | 'processor';
          method_id: string;
          method_name: string;
          transaction_ref?: string | null;
          proof_url?: string | null;
          status?: 'pending' | 'confirmed' | 'rejected';
          processed_by?: string | null;
          processed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          method?: 'crypto' | 'bank' | 'processor';
          method_id?: string;
          method_name?: string;
          transaction_ref?: string | null;
          proof_url?: string | null;
          status?: 'pending' | 'confirmed' | 'rejected';
          processed_by?: string | null;
          processed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
      };
      withdrawals: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          method: string;
          wallet_address: string | null;
          bank_details: any | null;
          status: 'pending' | 'processing' | 'completed' | 'rejected';
          processed_by: string | null;
          processed_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          method: string;
          wallet_address?: string | null;
          bank_details?: any | null;
          status?: 'pending' | 'processing' | 'completed' | 'rejected';
          processed_by?: string | null;
          processed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          method?: string;
          wallet_address?: string | null;
          bank_details?: any | null;
          status?: 'pending' | 'processing' | 'completed' | 'rejected';
          processed_by?: string | null;
          processed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          pair: string;
          type: 'buy' | 'sell';
          side: 'long' | 'short';
          amount: number;
          entry_price: number;
          exit_price: number | null;
          leverage: number;
          status: 'open' | 'closed' | 'liquidated';
          pnl: number | null;
          stop_loss: number | null;
          take_profit: number | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pair: string;
          type: 'buy' | 'sell';
          side: 'long' | 'short';
          amount: number;
          entry_price: number;
          exit_price?: number | null;
          leverage?: number;
          status?: 'open' | 'closed' | 'liquidated';
          pnl?: number | null;
          stop_loss?: number | null;
          take_profit?: number | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pair?: string;
          type?: 'buy' | 'sell';
          side?: 'long' | 'short';
          amount?: number;
          entry_price?: number;
          exit_price?: number | null;
          leverage?: number;
          status?: 'open' | 'closed' | 'liquidated';
          pnl?: number | null;
          stop_loss?: number | null;
          take_profit?: number | null;
          closed_at?: string | null;
          created_at?: string;
        };
      };
      payment_methods: {
        Row: {
          id: string;
          type: 'crypto' | 'bank' | 'processor';
          name: string;
          details: any;
          enabled: boolean;
          min_deposit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: 'crypto' | 'bank' | 'processor';
          name: string;
          details: any;
          enabled?: boolean;
          min_deposit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: 'crypto' | 'bank' | 'processor';
          name?: string;
          details?: any;
          enabled?: boolean;
          min_deposit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      platform_settings: {
        Row: {
          id: string;
          key: string;
          value: any;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: any;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: any;
          updated_at?: string;
        };
      };
    };
  };
}
