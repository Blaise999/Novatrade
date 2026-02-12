// components/NotificationPanel.tsx
'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Bell,
  CheckCircle,
  Gift,
  TrendingUp,
  Shield,
  AlertCircle,
  Info,
  CreditCard,
  CheckCheck,
} from 'lucide-react';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const typeIcons: Record<string, ReactNode> = {
  tier_purchase: <Shield className="w-4 h-4 text-gold" />,
  deposit: <CreditCard className="w-4 h-4 text-profit" />,
  withdrawal: <CreditCard className="w-4 h-4 text-electric" />,
  bonus: <Gift className="w-4 h-4 text-gold" />,
  trade: <TrendingUp className="w-4 h-4 text-electric" />,
  alert: <AlertCircle className="w-4 h-4 text-loss" />,
  success: <CheckCircle className="w-4 h-4 text-profit" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationPanel() {
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Load notifications when opening
  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) refresh(); // ✅ was loadNotifications()
  };

  const handleClick = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-slate-400 hover:text-cream transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-loss text-void text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-cream">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-electric hover:text-electric/80 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                    !n.read_at ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{typeIcons[n.type] || typeIcons.info}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${!n.read_at ? 'text-cream' : 'text-slate-400'}`}>
                        {n.title}
                      </p>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-electric flex-shrink-0" />}
                    </div>
                    {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
