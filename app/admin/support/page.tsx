'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Search,
  Send,
  Clock,
  CheckCircle,
  User,
  X,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';

// ============================================
// TOKEN HELPER (migration-safe)
// ============================================
function getAdminToken() {
  const key = 'novatrade_admin_token';
  if (typeof window === 'undefined') return null;

  const s = sessionStorage.getItem(key);
  if (s) return s;

  const l = localStorage.getItem(key);
  if (l) {
    sessionStorage.setItem(key, l);
    return l;
  }
  return null;
}

// ============================================
// TYPES (DB SHAPE)
// ============================================
type DbTicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
type UiFilter = 'all' | 'open' | 'pending' | 'closed';
type DbPriority = 'low' | 'normal' | 'high' | 'urgent';

type DbTicket = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: DbPriority;
  status: DbTicketStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  users?: { id: string; email: string; first_name?: string | null; last_name?: string | null } | null;
  last_message?: { message: string; sender_type: string; created_at: string } | null;
};

type DbMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: 'user' | 'admin' | 'system';
  message: string;
  attachments: any[] | null;
  read_at: string | null;
  created_at: string;
};

function formatTime(ts: string) {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function statusBadge(status: DbTicketStatus) {
  if (status === 'open' || status === 'in_progress')
    return { cls: 'bg-yellow-500/20 text-yellow-500', label: 'open' };
  if (status === 'waiting_user') return { cls: 'bg-blue-500/20 text-blue-500', label: 'pending' };
  if (status === 'resolved') return { cls: 'bg-profit/20 text-profit', label: 'resolved' };
  return { cls: 'bg-profit/20 text-profit', label: 'closed' };
}

function priorityLabel(p: DbPriority) {
  if (p === 'urgent') return 'high';
  if (p === 'high') return 'high';
  if (p === 'normal') return 'medium';
  return 'low';
}

// ============================================
// ADMIN SUPPORT PAGE
// ============================================
export default function AdminSupportPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();

  const [tickets, setTickets] = useState<DbTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<DbTicket | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);

  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UiFilter>('open');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickReplies = [
    'Thank you for contacting us! How can I help you today?',
    'I understand your concern. Let me look into this for you.',
    'Your request has been processed. Is there anything else I can help with?',
    'Please allow 24-48 hours for this to be resolved.',
    'Could you please provide more details about the issue?',
    'Your deposit/withdrawal is being processed. Thank you for your patience.',
  ];

  // --------------------------------------------
  // API helpers (always read fresh token)
  // --------------------------------------------
  async function apiGet<T>(url: string): Promise<T> {
    const token = getAdminToken();
    if (!token) throw new Error('Missing admin token. Please log in again.');

    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
    return json as T;
  }

  async function apiPost<T>(url: string, body: any): Promise<T> {
    const token = getAdminToken();
    if (!token) throw new Error('Missing admin token. Please log in again.');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
    return json as T;
  }

  // --------------------------------------------
  // Load tickets
  // --------------------------------------------
  async function loadTickets() {
    setLoadingTickets(true);
    setApiError(null);
    try {
      const data = await apiGet<{ tickets: DbTicket[] }>(`/api/admin/support/tickets?filter=${statusFilter}`);
      setTickets(data.tickets ?? []);
    } catch (e: any) {
      console.error('[AdminSupport] loadTickets error:', e);
      setTickets([]);
      setApiError(e?.message ?? 'Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  }

  // --------------------------------------------
  // Open ticket by id (safer than passing stale objects)
  // --------------------------------------------
  async function openTicketById(ticketId: string) {
    setLoadingMessages(true);
    setApiError(null);
    try {
      const data = await apiGet<{ ticket: DbTicket; messages: DbMessage[] }>(`/api/admin/support/tickets/${ticketId}`);
      setSelectedTicket(data.ticket);
      setMessages(data.messages ?? []);
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (e: any) {
      console.error('[AdminSupport] openTicket error:', e);
      setApiError(e?.message ?? 'Failed to open ticket');
    } finally {
      setLoadingMessages(false);
    }
  }

  // --------------------------------------------
  // Send admin reply
  // --------------------------------------------
  async function sendAdminReply(text: string) {
    const body = text.trim();
    if (!selectedTicket || !body) return;

    setIsSending(true);
    setApiError(null);
    try {
      await apiPost(`/api/admin/support/tickets/${selectedTicket.id}/messages`, {
        message: body,
        adminId: admin?.id ?? null,
      });

      setMessage('');
      await openTicketById(selectedTicket.id);
      await loadTickets();
    } catch (e: any) {
      console.error('[AdminSupport] sendAdminReply error:', e);
      setApiError(e?.message ?? 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }

  // --------------------------------------------
  // Status actions
  // --------------------------------------------
  async function setTicketStatus(status: DbTicketStatus) {
    if (!selectedTicket) return;
    setApiError(null);
    try {
      const data = await apiPost<{ ticket: DbTicket }>(`/api/admin/support/tickets/${selectedTicket.id}/status`, {
        status,
      });
      setSelectedTicket(data.ticket);
      await loadTickets();
    } catch (e: any) {
      console.error('[AdminSupport] setTicketStatus error:', e);
      setApiError(e?.message ?? 'Failed to update status');
    }
  }

  const closeTicket = () => setTicketStatus('closed');
  const reopenTicket = () => setTicketStatus('open');

  // --------------------------------------------
  // Effects
  // --------------------------------------------
  useEffect(() => {
    if (!isAuthenticated || !admin) return;

    loadTickets();
    const interval = setInterval(loadTickets, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, isAuthenticated, admin?.id]);

  useEffect(() => {
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, [messages.length]);

  // --------------------------------------------
  // Guards
  // --------------------------------------------
  if (!getAdminToken()) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Missing admin token. Please log in again.</p>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  const filteredTickets = tickets.filter((t) => {
    const email = t.users?.email ?? '';
    const name = `${t.users?.first_name ?? ''} ${t.users?.last_name ?? ''}`.trim();
    const subj = t.subject ?? '';
    const q = searchQuery.toLowerCase();
    return email.toLowerCase().includes(q) || name.toLowerCase().includes(q) || subj.toLowerCase().includes(q);
  });

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-cream">Support Center</h1>
        <p className="text-slate-400 mt-1">Manage customer support tickets and live chat</p>
      </div>

      {apiError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {apiError}
        </div>
      )}

      {/* Stats (based on currently loaded list) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Inbox className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">
                {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
              </p>
              <p className="text-sm text-yellow-500">Open</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">
                {tickets.filter((t) => t.status === 'waiting_user').length}
              </p>
              <p className="text-sm text-blue-500">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-profit/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-profit" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">
                {tickets.filter((t) => t.status === 'closed' || t.status === 'resolved').length}
              </p>
              <p className="text-sm text-profit">Resolved</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageCircle className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{tickets.length}</p>
              <p className="text-sm text-purple-500">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Ticket List */}
        <div className="w-96 flex flex-col bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-cream text-sm focus:outline-none focus:border-gold"
              />
            </div>

            <div className="flex gap-2">
              {(['all', 'open', 'pending', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    statusFilter === s
                      ? 'bg-gold text-void font-medium'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 text-gold animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <Inbox className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No tickets found</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const name = `${t.users?.first_name ?? ''} ${t.users?.last_name ?? ''}`.trim() || 'User';
                const email = t.users?.email ?? '—';
                const last = t.last_message?.message ?? t.subject ?? '—';
                const badge = statusBadge(t.status);

                return (
                  <button
                    key={t.id}
                    onClick={() => openTicketById(t.id)}
                    className={`w-full p-4 text-left border-b border-white/5 hover:bg-white/5 transition-all ${
                      selectedTicket?.id === t.id ? 'bg-gold/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-electric/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gold" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-cream truncate">{name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        </div>

                        <p className="text-xs text-slate-500 truncate mt-0.5">{email}</p>
                        <p className="text-xs text-slate-400 mt-1 truncate">{last}</p>

                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-slate-500">{formatTime(t.updated_at)}</p>
                          <p className="text-xs text-slate-500">Priority: {priorityLabel(t.priority)}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {selectedTicket ? (
            <>
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-electric/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-cream font-medium">
                      {`${selectedTicket.users?.first_name ?? ''} ${selectedTicket.users?.last_name ?? ''}`.trim() ||
                        'User'}
                    </p>
                    <p className="text-xs text-slate-500">{selectedTicket.users?.email ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedTicket.subject} • {selectedTicket.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedTicket.status !== 'closed' ? (
                    <button
                      onClick={closeTicket}
                      className="px-3 py-1.5 bg-profit/10 text-profit text-sm rounded-lg hover:bg-profit/20 transition-all"
                    >
                      Close Ticket
                    </button>
                  ) : (
                    <button
                      onClick={reopenTicket}
                      className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 text-sm rounded-lg hover:bg-yellow-500/20 transition-all"
                    >
                      Reopen Ticket
                    </button>
                  )}

                  <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-white/10 rounded-lg">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-28">
                    <RefreshCw className="w-6 h-6 text-gold animate-spin" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const isAdminMsg = m.sender_type === 'admin';
                    const isSystem = m.sender_type === 'system';

                    return (
                      <div key={m.id} className={`flex ${isAdminMsg ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] ${
                            isSystem
                              ? 'bg-electric/20 text-cream rounded-2xl rounded-bl-md'
                              : isAdminMsg
                              ? 'bg-gold text-void rounded-2xl rounded-br-md'
                              : 'bg-white/10 text-cream rounded-2xl rounded-bl-md'
                          } px-4 py-3`}
                        >
                          {!isAdminMsg && !isSystem && (
                            <p className="text-xs opacity-70 mb-1">
                              {`${selectedTicket.users?.first_name ?? ''} ${selectedTicket.users?.last_name ?? ''}`.trim() ||
                                'User'}
                            </p>
                          )}
                          {isSystem && <p className="text-xs opacity-70 mb-1">System</p>}

                          <p className="text-sm">{m.message}</p>

                          <div className="flex items-center gap-1 mt-1 opacity-60">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs">{formatTime(m.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {selectedTicket.status !== 'closed' && (
                <div className="px-4 py-2 border-t border-white/5">
                  <p className="text-xs text-slate-500 mb-2">Quick Replies</p>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(reply)}
                        className="px-3 py-1 bg-white/5 text-slate-400 text-xs rounded-full hover:bg-white/10 hover:text-cream transition-all truncate max-w-[240px]"
                      >
                        {reply.length > 44 ? `${reply.slice(0, 44)}…` : reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTicket.status !== 'closed' && (
                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type your reply..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendAdminReply(message);
                      }}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream text-sm placeholder:text-slate-500 focus:outline-none focus:border-gold"
                    />
                    <button
                      onClick={() => sendAdminReply(message)}
                      disabled={!message.trim() || isSending}
                      className="px-4 py-3 bg-gold text-void rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                      aria-label="Send"
                    >
                      {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-cream">Select a ticket</p>
              <p className="text-sm">Choose a conversation from the list to view and respond</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
