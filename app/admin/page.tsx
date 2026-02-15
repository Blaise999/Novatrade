'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Search,
  Send,
  Clock,
  CheckCircle,
  User,
  X,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Inbox,
  Archive
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ============================================
// TYPES
// ============================================
interface SupportMessage {
  id: string;
  content: string;
  sender: 'user' | 'admin' | 'bot';
  sender_id?: string;
  sender_name?: string;
  timestamp: string;
  read: boolean;
}

interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'medium' | 'high';
  subject?: string;
  messages: SupportMessage[];
  created_at: string;
  updated_at: string;
  assigned_to?: string;
}

// ============================================
// ADMIN SUPPORT PAGE
// ============================================
export default function AdminSupportPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'pending'>('open');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick reply templates
  const quickReplies = [
    "Thank you for contacting us! How can I help you today?",
    "I understand your concern. Let me look into this for you.",
    "Your request has been processed. Is there anything else I can help with?",
    "Please allow 24-48 hours for this to be resolved.",
    "Could you please provide more details about the issue?",
    "Your deposit/withdrawal is being processed. Thank you for your patience.",
  ];

  // Load tickets
  useEffect(() => {
    loadTickets();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadTickets, 10000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  // Scroll to bottom when viewing messages
  useEffect(() => {
    if (selectedTicket && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const loadTickets = async () => {
    try {
      if (isSupabaseConfigured()) {
        let query = supabase
          .from('support_tickets')
          .select('*')
          .order('updated_at', { ascending: false });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        setTickets(data || []);
      } else {
        // Load from localStorage for demo
        const stored = localStorage.getItem('novatrade_support_tickets');
        if (stored) {
          const allTickets = JSON.parse(stored);
          setTickets(statusFilter === 'all' ? allTickets : allTickets.filter((t: SupportTicket) => t.status === statusFilter));
        }
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    }
    setLoading(false);
  };

  const sendAdminReply = async (content: string) => {
    if (!selectedTicket || !content.trim()) return;

    setIsSending(true);
    const newMessage: SupportMessage = {
      id: `msg-${Date.now()}`,
      content: content.trim(),
      sender: 'admin',
      sender_id: admin?.id,
      sender_name: admin?.name || 'Support',
      timestamp: new Date().toISOString(),
      read: true,
    };

    try {
      if (isSupabaseConfigured()) {
        const updatedMessages = [...selectedTicket.messages, newMessage];
        const { error } = await supabase
          .from('support_tickets')
          .update({
            messages: updatedMessages,
            updated_at: new Date().toISOString(),
            status: 'pending', // Mark as awaiting user response
          })
          .eq('id', selectedTicket.id);

        if (error) throw error;
      } else {
        // Update localStorage for demo
        const stored = localStorage.getItem('novatrade_support_tickets') || '[]';
        const allTickets = JSON.parse(stored);
        const ticketIndex = allTickets.findIndex((t: SupportTicket) => t.id === selectedTicket.id);
        if (ticketIndex >= 0) {
          allTickets[ticketIndex].messages.push(newMessage);
          allTickets[ticketIndex].updated_at = new Date().toISOString();
          allTickets[ticketIndex].status = 'pending';
          localStorage.setItem('novatrade_support_tickets', JSON.stringify(allTickets));
        }
      }

      // Update local state
      setSelectedTicket(prev => prev ? {
        ...prev,
        messages: [...prev.messages, newMessage],
        updated_at: new Date().toISOString(),
        status: 'pending',
      } : null);

      setMessage('');
      loadTickets();
    } catch (error) {
      console.error('Failed to send message:', error);
    }

    setIsSending(false);
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;

    try {
      if (isSupabaseConfigured()) {
        await supabase
          .from('support_tickets')
          .update({ status: 'closed', updated_at: new Date().toISOString() })
          .eq('id', selectedTicket.id);
      } else {
        const stored = localStorage.getItem('novatrade_support_tickets') || '[]';
        const allTickets = JSON.parse(stored);
        const ticketIndex = allTickets.findIndex((t: SupportTicket) => t.id === selectedTicket.id);
        if (ticketIndex >= 0) {
          allTickets[ticketIndex].status = 'closed';
          localStorage.setItem('novatrade_support_tickets', JSON.stringify(allTickets));
        }
      }

      setSelectedTicket(null);
      loadTickets();
    } catch (error) {
      console.error('Failed to close ticket:', error);
    }
  };

  const reopenTicket = async () => {
    if (!selectedTicket) return;

    try {
      if (isSupabaseConfigured()) {
        await supabase
          .from('support_tickets')
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq('id', selectedTicket.id);
      } else {
        const stored = localStorage.getItem('novatrade_support_tickets') || '[]';
        const allTickets = JSON.parse(stored);
        const ticketIndex = allTickets.findIndex((t: SupportTicket) => t.id === selectedTicket.id);
        if (ticketIndex >= 0) {
          allTickets[ticketIndex].status = 'open';
          localStorage.setItem('novatrade_support_tickets', JSON.stringify(allTickets));
        }
      }

      setSelectedTicket(prev => prev ? { ...prev, status: 'open' } : null);
      loadTickets();
    } catch (error) {
      console.error('Failed to reopen ticket:', error);
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-cream">Support Center</h1>
        <p className="text-slate-400 mt-1">Manage customer support tickets and live chat</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Inbox className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream">{tickets.filter(t => t.status === 'open').length}</p>
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
              <p className="text-2xl font-bold text-cream">{tickets.filter(t => t.status === 'pending').length}</p>
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
              <p className="text-2xl font-bold text-cream">{tickets.filter(t => t.status === 'closed').length}</p>
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

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Ticket List */}
        <div className="w-96 flex flex-col bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {/* Search & Filters */}
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
              {(['all', 'open', 'pending', 'closed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    statusFilter === status
                      ? 'bg-gold text-void font-medium'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 text-gold animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <Inbox className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No tickets found</p>
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full p-4 text-left border-b border-white/5 hover:bg-white/5 transition-all ${
                    selectedTicket?.id === ticket.id ? 'bg-gold/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-electric/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-cream truncate">{ticket.user_name || 'User'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          ticket.status === 'open' ? 'bg-yellow-500/20 text-yellow-500' :
                          ticket.status === 'pending' ? 'bg-blue-500/20 text-blue-500' :
                          'bg-profit/20 text-profit'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{ticket.user_email}</p>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {ticket.messages[ticket.messages.length - 1]?.content || 'No messages'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{formatTime(ticket.updated_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-electric/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-cream font-medium">{selectedTicket.user_name || 'User'}</p>
                    <p className="text-xs text-slate-500">{selectedTicket.user_email}</p>
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
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="p-2 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTicket.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] ${
                        msg.sender === 'admin'
                          ? 'bg-gold text-void rounded-2xl rounded-br-md'
                          : msg.sender === 'user'
                          ? 'bg-white/10 text-cream rounded-2xl rounded-bl-md'
                          : 'bg-electric/20 text-cream rounded-2xl rounded-bl-md'
                      } px-4 py-3`}
                    >
                      {msg.sender !== 'admin' && (
                        <p className="text-xs opacity-70 mb-1">
                          {msg.sender === 'user' ? selectedTicket.user_name || 'User' : 'Bot'}
                        </p>
                      )}
                      <p className="text-sm">{msg.content}</p>
                      <div className="flex items-center gap-1 mt-1 opacity-60">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              {selectedTicket.status !== 'closed' && (
                <div className="px-4 py-2 border-t border-white/5">
                  <p className="text-xs text-slate-500 mb-2">Quick Replies</p>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(reply)}
                        className="px-3 py-1 bg-white/5 text-slate-400 text-xs rounded-full hover:bg-white/10 hover:text-cream transition-all truncate max-w-[200px]"
                      >
                        {reply.substring(0, 40)}...
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              {selectedTicket.status !== 'closed' && (
                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type your reply..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendAdminReply(message)}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream text-sm placeholder:text-slate-500 focus:outline-none focus:border-gold"
                    />
                    <button
                      onClick={() => sendAdminReply(message)}
                      disabled={!message.trim() || isSending}
                      className="px-4 py-3 bg-gold text-void rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                    >
                      {isSending ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
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
