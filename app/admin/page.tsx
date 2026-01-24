'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  Signal,
  Users,
  TrendingUp,
  Clock,
  ChevronRight,
  Play,
  Pause,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckCircle,
  MessageCircle
} from 'lucide-react';
import { useAdminSessionStore, useAdminAuthStore } from '@/lib/admin-store';
import { formatTime, generateTelegramMessage } from '@/lib/admin-types';

export default function AdminDashboardPage() {
  const { admin } = useAdminAuthStore();
  const { sessions, activeSession, activateSession, completeSession } = useAdminSessionStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get stats
  const todaySessions = sessions.filter(s => {
    const sessionDate = new Date(s.createdAt);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString();
  });

  const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  // Get current signal if active session
  const getCurrentSignal = () => {
    if (!activeSession) return null;
    const now = currentTime.getTime();
    return activeSession.signals.find(signal => {
      const start = new Date(signal.startTime).getTime();
      const end = new Date(signal.endTime).getTime();
      return now >= start && now < end;
    });
  };

  const currentSignal = getCurrentSignal();

  // Get next signal
  const getNextSignal = () => {
    if (!activeSession) return null;
    const now = currentTime.getTime();
    return activeSession.signals.find(signal => {
      const start = new Date(signal.startTime).getTime();
      return start > now;
    });
  };

  const nextSignal = getNextSignal();

  // Copy telegram message
  const copyTelegramMessage = () => {
    if (!activeSession) return;
    const message = generateTelegramMessage(activeSession);
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">
            Welcome, {admin?.name}! 🎯
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your trading signals and sessions
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-cream">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-sm text-slate-500">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-gradient-to-r from-profit/10 to-profit/5 rounded-2xl border border-profit/20"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-profit/20 rounded-2xl flex items-center justify-center">
                <Signal className="w-7 h-7 text-profit" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-profit rounded-full animate-pulse" />
                  <span className="text-profit text-sm font-semibold">LIVE SESSION</span>
                </div>
                <h2 className="text-xl font-bold text-cream">{activeSession.name}</h2>
                <p className="text-slate-400">
                  {activeSession.assetSymbol} • {formatTime(new Date(activeSession.startTime))} - {formatTime(new Date(activeSession.endTime))}
                </p>
              </div>
            </div>

            {/* Current Signal */}
            {currentSignal && (
              <div className={`px-6 py-4 rounded-xl border ${
                currentSignal.direction === 'up' 
                  ? 'bg-profit/20 border-profit/30' 
                  : 'bg-loss/20 border-loss/30'
              }`}>
                <p className="text-xs text-slate-400 mb-1">CURRENT SIGNAL</p>
                <div className="flex items-center gap-3">
                  {currentSignal.direction === 'up' ? (
                    <ArrowUp className="w-8 h-8 text-profit" />
                  ) : (
                    <ArrowDown className="w-8 h-8 text-loss" />
                  )}
                  <div>
                    <p className={`text-2xl font-bold ${currentSignal.direction === 'up' ? 'text-profit' : 'text-loss'}`}>
                      {currentSignal.direction.toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-400">
                      Until {formatTime(new Date(currentSignal.endTime))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={copyTelegramMessage}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 text-cream rounded-xl hover:bg-white/20 transition-all"
              >
                {copiedMessage ? (
                  <CheckCircle className="w-4 h-4 text-profit" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedMessage ? 'Copied!' : 'Copy for TG'}
              </button>
              <button
                onClick={() => completeSession(activeSession.id)}
                className="flex items-center gap-2 px-4 py-2 bg-loss/20 text-loss rounded-xl hover:bg-loss/30 transition-all"
              >
                <Pause className="w-4 h-4" />
                End Session
              </button>
            </div>
          </div>

          {/* Signal Timeline */}
          {activeSession.signals.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-slate-400 mb-3">Signal Timeline</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {activeSession.signals.map((signal, index) => {
                  const now = currentTime.getTime();
                  const start = new Date(signal.startTime).getTime();
                  const end = new Date(signal.endTime).getTime();
                  const isPast = now > end;
                  const isCurrent = now >= start && now < end;
                  const isUpcoming = now < start;

                  return (
                    <div
                      key={signal.id}
                      className={`flex-shrink-0 w-20 p-2 rounded-lg border text-center ${
                        isCurrent
                          ? signal.direction === 'up'
                            ? 'bg-profit/20 border-profit/40'
                            : 'bg-loss/20 border-loss/40'
                          : isPast
                          ? 'bg-white/5 border-white/10 opacity-50'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <p className="text-xs text-slate-500">{formatTime(new Date(signal.startTime))}</p>
                      <div className="my-1">
                        {signal.direction === 'up' ? (
                          <ArrowUp className={`w-5 h-5 mx-auto ${isCurrent ? 'text-profit' : 'text-slate-400'}`} />
                        ) : (
                          <ArrowDown className={`w-5 h-5 mx-auto ${isCurrent ? 'text-loss' : 'text-slate-400'}`} />
                        )}
                      </div>
                      <p className={`text-xs font-medium ${
                        isCurrent 
                          ? signal.direction === 'up' ? 'text-profit' : 'text-loss'
                          : 'text-slate-400'
                      }`}>
                        {signal.direction.toUpperCase()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Today\'s Sessions', value: todaySessions.length, icon: Calendar, color: 'text-gold' },
          { label: 'Scheduled', value: scheduledSessions.length, icon: Clock, color: 'text-electric' },
          { label: 'Completed', value: completedSessions.length, icon: CheckCircle, color: 'text-profit' },
          { label: 'Total Signals', value: sessions.reduce((acc, s) => acc + s.signals.length, 0), icon: Signal, color: 'text-loss' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white/5 rounded-2xl border border-white/5"
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-cream mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create New Session */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <h2 className="text-lg font-semibold text-cream mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/admin/sessions/new"
              className="flex items-center gap-4 p-4 bg-loss/10 border border-loss/20 rounded-xl hover:bg-loss/20 transition-all group"
            >
              <div className="w-12 h-12 bg-loss/20 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-loss" />
              </div>
              <div className="flex-1">
                <p className="text-cream font-medium">Create New Session</p>
                <p className="text-sm text-slate-400">Set up signals for the next hour</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-loss group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              href="/admin/sessions"
              className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-cream font-medium">View All Sessions</p>
                <p className="text-sm text-slate-400">Manage scheduled & past sessions</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-gold group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              href="/admin/signals"
              className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-electric/10 rounded-xl flex items-center justify-center">
                <Signal className="w-6 h-6 text-electric" />
              </div>
              <div className="flex-1">
                <p className="text-cream font-medium">Live Signal Monitor</p>
                <p className="text-sm text-slate-400">Watch real-time signal status</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-electric group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>

        {/* Scheduled Sessions */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-cream">Upcoming Sessions</h2>
            <Link href="/admin/sessions" className="text-sm text-gold hover:text-gold/80">
              View all
            </Link>
          </div>
          
          {scheduledSessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No scheduled sessions</p>
              <Link href="/admin/sessions/new" className="text-sm text-loss hover:underline">
                Create one now
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledSessions.slice(0, 3).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-3 bg-white/5 rounded-xl"
                >
                  <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream truncate">{session.name}</p>
                    <p className="text-xs text-slate-500">
                      {session.assetSymbol} • {session.signals.length} signals
                    </p>
                  </div>
                  <button
                    onClick={() => activateSession(session.id)}
                    className="p-2 bg-profit/10 text-profit rounded-lg hover:bg-profit/20 transition-all"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Telegram Message Preview */}
      {activeSession && (
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-electric" />
              <h2 className="text-lg font-semibold text-cream">Telegram Message</h2>
            </div>
            <button
              onClick={copyTelegramMessage}
              className="flex items-center gap-2 px-3 py-1.5 bg-electric/10 text-electric text-sm rounded-lg hover:bg-electric/20 transition-all"
            >
              {copiedMessage ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedMessage ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="p-4 bg-void rounded-xl text-sm text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto">
            {generateTelegramMessage(activeSession)}
          </pre>
        </div>
      )}
    </div>
  );
}
