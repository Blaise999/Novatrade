/**
 * Server-side Supabase client with service role key
 * Use this ONLY in API routes, never in client components
 */

import { createServerClient } from './client';

// Re-export the server client
export const supabaseAdmin = createServerClient();
