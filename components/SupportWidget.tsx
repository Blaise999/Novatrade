'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_type: 'user' | 'admin' | 'system';
  message: string;
  created_at: string;
};

type SupportTicket = {
  id: string;
  user_id: string;
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  updated_at: string;
};

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canUse = useMemo(() => {
    const ok = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : !!isSupabaseConfigured;
    return ok && !!supabase;
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }

  async function getOrCreateTicket(userId: string) {
    // Try to reuse latest active ticket
    const { data: existing, error: qErr } = await supabase
      .from('support_tickets')
      .select('id, user_id, status, updated_at')
      .eq('user_id', userId)
      .in('status', ['open', 'in_progress', 'waiting_user'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (qErr) throw qErr;
    if (existing?.id) return existing.id as string;

    // Create a new ticket (subject required)
    const { data: created, error: cErr } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        subject: 'Support Chat',
        category: 'general',
        priority: 'normal',
        status: 'open',
      })
      .select('id')
      .single();

    if (cErr) throw cErr;

    // Optional greeting message (system)
    await supabase.from('support_messages').insert({
      ticket_id: created.id,
      sender_id: userId,
      sender_type: 'user',
      message: 'Hi 👋 I need help.',
      attachments: [],
    });

    return created.id as string;
  }

  async function loadMessages(tid: string) {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, ticket_id, sender_type, message, created_at')
      .eq('ticket_id', tid)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    setMessages((data ?? []) as SupportMessage[]);
    scrollToBottom();
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function init() {
      if (!canUse) return;

      setErr(null);
      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const userId = data.session?.user?.id ?? null;
        const ok = !!userId;

        setSignedIn(ok);
        setAuthReady(true);

        if (!ok) {
          setTicketId(null);
          setMessages([]);
          return;
        }

        const tid = await getOrCreateTicket(userId);
        if (cancelled) return;

        setTicketId(tid);
        await loadMessages(tid);
      } catch (e: any) {
        console.error('[SupportWidget] init error:', e);
        setErr(e?.message ?? 'Failed to open support chat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [open, canUse]);

  // Realtime subscription (admin replies show instantly)
  useEffect(() => {
    if (!open || !ticketId || !canUse) return;

    const channel = supabase
      .channel(`support:ticket:${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const row = payload.new as SupportMessage;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, ticketId, canUse]);

  async function sendMessage() {
    setErr(null);

    const msg = text.trim();
    if (!msg || !ticketId) return;

    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) {
        setSignedIn(false);
        setAuthReady(true);
        return;
      }

      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: userId,
          sender_type: 'user',
          message: msg,
          attachments: [],
          read_at: null,
        })
        .select('id, ticket_id, sender_type, message, created_at')
        .single();

      if (error) throw error;

      setText('');
      if (data) {
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as SupportMessage]));
      }
      scrollToBottom();
    } catch (e: any) {
      console.error('[SupportWidget] send error:', e);
      setErr(e?.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 bg-charcoal border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-cream">Support</span>
              <span className="text-[11px] text-cream/50">We usually reply fast.</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-cream">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3">
            {!canUse && (
              <p className="text-sm text-cream/60">
                Support chat isn’t configured. Email{' '}
                <span className="text-cream font-medium">support@novatrade.com</span>
              </p>
            )}

            {canUse && err && (
              <div className="mb-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {err}
              </div>
            )}

            {canUse && !authReady && (
              <div className="flex items-center gap-2 text-cream/60 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            )}

            {canUse && authReady && !signedIn && (
              <div className="space-y-2">
                <p className="text-sm text-cream/60">Sign in to chat with support.</p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-white/10 hover:bg-white/15 text-cream text-sm py-2"
                >
                  Sign in
                </Link>
              </div>
            )}

            {canUse && authReady && signedIn && (
              <>
                <div
                  ref={listRef}
                  className="h-64 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3 space-y-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2 text-cream/60 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading messages…
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-cream/50">No messages yet.</p>
                  ) : (
                    messages.map((m) => {
                      const isUser = m.sender_type === 'user';
                      const isSystem = m.sender_type === 'system';
                      return (
                        <div
                          key={m.id}
                          className={[
                            'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug',
                            isSystem
                              ? 'mx-auto bg-white/5 text-cream/70 text-center'
                              : isUser
                              ? 'ml-auto bg-gold/90 text-void'
                              : 'mr-auto bg-white/10 text-cream',
                          ].join(' ')}
                        >
                          {m.message}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendMessage();
                    }}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-cream placeholder:text-cream/30 outline-none focus:border-white/20"
                    maxLength={800}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !text.trim()}
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold/80 flex items-center justify-center text-void disabled:opacity-50"
                    aria-label="Send"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>

                <p className="mt-2 text-[11px] text-cream/35">
                  Or email <span className="text-cream/60">support@novatrade.com</span>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 bg-gradient-to-br from-gold to-gold/80 rounded-full flex items-center justify-center shadow-lg hover:shadow-gold/20 transition-all"
      >
        <MessageCircle className="w-5 h-5 text-void" />
      </button>
    </div>
  );
}
