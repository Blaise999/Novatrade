// hooks/useNotifications.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  created_at: string;
  read_at: string | null;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import('@/lib/supabase/client');
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const headers = useCallback(async () => {
    const token = await getAuthToken();
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const h = await headers();
      const res = await fetch('/api/notifications?unreadOnly=true', { headers: h, cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setUnreadCount(json.unreadCount || 0);
    } catch {}
  }, [headers]);

  const loadNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const h = await headers();
      const res = await fetch(`/api/notifications?page=${page}&pageSize=20`, { headers: h, cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setNotifications(json.data || []);
      setUnreadCount(json.unreadCount || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const markRead = useCallback(async (id: string) => {
    try {
      const h = await headers();
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ id }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, [headers]);

  const markAllRead = useCallback(async () => {
    try {
      const h = await headers();
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {}
  }, [headers]);

  // Poll unread count every 30s
  useEffect(() => {
    refreshUnreadCount();
    intervalRef.current = setInterval(refreshUnreadCount, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markRead,
    markAllRead,
    refreshUnreadCount,
  };
}
