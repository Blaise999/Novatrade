// hooks/useNotifications.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useStore } from '@/lib/supabase/store-supabase';

export type AppNotification = {
  id: string;
  user_id: string;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  created_at: string;
  read_at: string | null;
};

type UseNotificationsOptions = {
  limit?: number; // default 200
  autoRefreshMs?: number; // default 0 (off)
};

export function useNotifications(opts: UseNotificationsOptions = {}) {
  const { user } = useStore();
  const userId = (user as any)?.id as string | undefined;

  const limit = opts.limit ?? 200;
  const autoRefreshMs = opts.autoRefreshMs ?? 0;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aliveRef = useRef(true);

  const unreadCount = useMemo(
    () => items.reduce((acc, n) => acc + (n.read_at ? 0 : 1), 0),
    [items]
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setItems([]);
      setError('Supabase not configured');
      return;
    }
    if (!userId) {
      setItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: qErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (qErr) throw qErr;

      if (!aliveRef.current) return;

      const list = (data ?? []) as AppNotification[];
      setItems(list);
    } catch (e: any) {
      if (!aliveRef.current) return;
      setError(e?.message || 'Failed to load notifications');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [userId, limit]);

  const markRead = useCallback(
    async (id: string) => {
      if (!isSupabaseConfigured() || !supabase || !userId) return;

      // optimistic
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));

      const { error: uErr } = await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', id)
        .eq('user_id', userId);

      if (uErr) {
        // revert on failure
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)));
        setError(uErr.message || 'Failed to mark as read');
      }
    },
    [userId]
  );

  const markAllRead = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !userId) return;

    const now = new Date().toISOString();

    // optimistic
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));

    const { error: uErr } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);

    if (uErr) {
      setError(uErr.message || 'Failed to mark all as read');
      // safest: re-fetch
      await refresh();
    }
  }, [userId, refresh]);

  const clearLocal = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // initial load + when user changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // optional auto refresh
  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs < 1000) return;
    const id = window.setInterval(() => refresh(), autoRefreshMs);
    return () => window.clearInterval(id);
  }, [autoRefreshMs, refresh]);

  return {
    notifications: items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    clearLocal,
  };
}
