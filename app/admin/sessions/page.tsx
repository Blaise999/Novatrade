'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckCircle,
  Eye,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useAdminSessionStore } from '@/lib/admin-store';
import { formatTime, generateTelegramMessage, TradingSession } from '@/lib/admin-types';

type FilterStatus = 'all' | 'draft' | 'scheduled' | 'active' | 'completed';

export default function SessionsPage() {
  const { sessions, activeSession, activateSession, completeSession, deleteSession } = useAdminSessionStore();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Copy telegram message
  const copyTelegramMessage = (session: TradingSession) => {
    const message = generateTelegramMessage(session);
    navigator.clipboard.writeText(message);
    setCopiedSessionId(session.id);
    setTimeout(() => setCopiedSessionId(null), 2000);
  };

  // Get status badge styles
  const getStatusBadge = (status: TradingSession['status']) => {
    switch (status) {
      case 'active':
        return 'bg-profit/10 text-profit border-profit/20';
      case 'scheduled':
        return 'bg-gold/10 text-gold border-gold/20';
      case 'completed':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'draft':
      default:
        return 'bg-white/5 text-slate-400 border-white/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Trading Sessions</h1>
          <p className="text-slate-400 mt-1">{sessions.length} total sessions</p>
        </div>
        <Link
          href="/admin/sessions/new"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-loss text-white font-semibold rounded-xl hover:bg-loss/90 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Session
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        {(['all', 'active', 'scheduled', 'draft', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
              filter === status
                ? 'bg-loss text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cream mb-2">No Sessions Found</h3>
            <p className="text-slate-400 mb-6">
              {filter === 'all' 
                ? "You haven't created any sessions yet."
                : `No ${filter} sessions found.`}
            </p>
            <Link
              href="/admin/sessions/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-loss text-white font-semibold rounded-xl hover:bg-loss/90 transition-all"
            >
              <Plus className="w-5 h-5" />
              Create Your First Session
            </Link>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white/5 rounded-2xl border transition-all ${
                session.status === 'active' 
                  ? 'border-profit/30' 
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              {/* Session Header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      session.status === 'active' 
                        ? 'bg-profit/10' 
                        : 'bg-white/5'
                    }`}>
                      <Calendar className={`w-6 h-6 ${
                        session.status === 'active' ? 'text-profit' : 'text-slate-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-cream">{session.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadge(session.status)}`}>
                          {session.status === 'active' && (
                            <span className="w-1.5 h-1.5 bg-profit rounded-full inline-block mr-1 animate-pulse" />
                          )}
                          {session.status}
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {session.assetSymbol} • {session.signals.length} signals
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(new Date(session.startTime))} - {formatTime(new Date(session.endTime))}
                        </span>
                        <span>
                          Created {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {session.status === 'scheduled' && (
                      <button
                        onClick={() => activateSession(session.id)}
                        className="p-2 bg-profit/10 text-profit rounded-lg hover:bg-profit/20 transition-all"
                        title="Go Live"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    )}
                    {session.status === 'active' && (
                      <button
                        onClick={() => completeSession(session.id)}
                        className="p-2 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all"
                        title="End Session"
                      >
                        <Pause className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => copyTelegramMessage(session)}
                      className="p-2 bg-electric/10 text-electric rounded-lg hover:bg-electric/20 transition-all"
                      title="Copy Telegram Message"
                    >
                      {copiedSessionId === session.id ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                      className="p-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
                      title="View Signals"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {session.status !== 'active' && (
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="p-2 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Signal Summary */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-profit" />
                    <span className="text-sm text-cream">
                      {session.signals.filter(s => s.direction === 'up').length} UP
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-loss" />
                    <span className="text-sm text-cream">
                      {session.signals.filter(s => s.direction === 'down').length} DOWN
                    </span>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                    className="flex items-center gap-1 text-sm text-gold hover:text-gold/80 transition-colors"
                  >
                    View all signals
                    <ChevronRight className={`w-4 h-4 transition-transform ${
                      expandedSession === session.id ? 'rotate-90' : ''
                    }`} />
                  </button>
                </div>
              </div>

              {/* Expanded Signals */}
              <AnimatePresence>
                {expandedSession === session.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5">
                      <div className="p-4 bg-void rounded-xl">
                        <div className="flex flex-wrap gap-2">
                          {session.signals.map((signal, index) => (
                            <div
                              key={signal.id}
                              className={`px-3 py-2 rounded-lg border ${
                                signal.direction === 'up'
                                  ? 'bg-profit/10 border-profit/20'
                                  : 'bg-loss/10 border-loss/20'
                              }`}
                            >
                              <p className="text-xs text-slate-400 mb-1">
                                #{index + 1} • {formatTime(new Date(signal.startTime))}
                              </p>
                              <div className="flex items-center gap-1">
                                {signal.direction === 'up' ? (
                                  <ArrowUp className="w-4 h-4 text-profit" />
                                ) : (
                                  <ArrowDown className="w-4 h-4 text-loss" />
                                )}
                                <span className={`text-sm font-medium ${
                                  signal.direction === 'up' ? 'text-profit' : 'text-loss'
                                }`}>
                                  {signal.direction.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
