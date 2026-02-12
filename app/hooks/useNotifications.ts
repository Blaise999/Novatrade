// hooks/useNotifications.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/supabase/store-supabase';

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

export function useNotifications() {
  const { user } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user?.id) h['x-user-id'] = user.id;
    return h;
  }, [user?.id]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/notifications?unreadOnly=true', {
        headers: getHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      setUnreadCount(json.unreadCount || 0);
    } catch {
      // Network error — ignore silently
    }
  }, [user?.id, getHeaders]);

  const loadNotifications = useCallback(async (page = 1) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?page=${page}&pageSize=20`, {
        headers: getHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data || []);
      setUnreadCount(json.unreadCount || 0);
    } catch {
      // Network error — silent
    } finally {
      setLoading(false);
    }
  }, [user?.id, getHeaders]);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ id }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, [getHeaders]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {}
  }, [getHeaders]);

  // Poll unread count every 30s
  useEffect(() => {
    if (!user?.id) return;
    refreshUnreadCount();
    intervalRef.current = setInterval(refreshUnreadCount, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, refreshUnreadCount]);

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
