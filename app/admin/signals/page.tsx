'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Signal,
  Clock,
  Play,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckCircle,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useAdminSessionStore } from '@/lib/admin-store';
import { formatTime, generateTelegramMessage, TradeSignal } from '@/lib/admin-types';

export default function LiveSignalsPage() {
  const { activeSession, sessions, activateSession } = useAdminSessionStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [copiedMessage, setCopiedMessage] = useState(false);

  // ✅ Always treat signals as an array (prevents .length crash)
  const activeSignals = useMemo<TradeSignal[]>(
    () => (Array.isArray(activeSession?.signals) ? activeSession!.signals : []),
    [activeSession]
  );

  const safeSessions = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);

  // Update time every 100ms for smooth countdown
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 100);
    return () => clearInterval(interval);
  }, []);

  // Get current signal
  const getCurrentSignal = (): TradeSignal | null => {
    if (!activeSession) return null;
    const now = currentTime.getTime();
    return (
      activeSignals.find((signal) => {
        const start = new Date(signal.startTime).getTime();
        const end = new Date(signal.endTime).getTime();
        return now >= start && now < end;
      }) || null
    );
  };

  // Get next signal
  const getNextSignal = (): TradeSignal | null => {
    if (!activeSession) return null;
    const now = currentTime.getTime();
    return (
      activeSignals.find((signal) => {
        const start = new Date(signal.startTime).getTime();
        return start > now;
      }) || null
    );
  };

  // Get time until next signal
  const getTimeUntilNext = (): number => {
    const nextSignal = getNextSignal();
    if (!nextSignal) return 0;
    return Math.max(0, (new Date(nextSignal.startTime).getTime() - currentTime.getTime()) / 1000);
  };

  // Get remaining time in current signal
  const getRemainingTime = (): number => {
    const currentSignal = getCurrentSignal();
    if (!currentSignal) return 0;
    return Math.max(0, (new Date(currentSignal.endTime).getTime() - currentTime.getTime()) / 1000);
  };

  // Format seconds to mm:ss
  const formatSeconds = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy telegram message
  const copyTelegramMessage = () => {
    if (!activeSession) return;
    const message = generateTelegramMessage({
      ...activeSession,
      signals: activeSignals, // ✅ guarantee array
    });
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const currentSignal = getCurrentSignal();
  const nextSignal = getNextSignal();
  const remainingTime = getRemainingTime();
  const timeUntilNext = getTimeUntilNext();

  // Get scheduled sessions
  const scheduledSessions = safeSessions.filter((s) => s.status === 'scheduled');

  // Calculate session progress
  const getSessionProgress = (): number => {
    if (!activeSession) return 0;
    const start = new Date(activeSession.startTime).getTime();
    const end = new Date(activeSession.endTime).getTime();
    const now = currentTime.getTime();
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  };

  // Count completed signals
  const completedSignals =
    activeSignals.filter((s) => new Date(s.endTime).getTime() < currentTime.getTime()).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Live Signals</h1>
          <p className="text-slate-400 mt-1">Real-time signal monitoring</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-cream">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        </div>
      </div>

      {activeSession ? (
        <div className="space-y-6">
          {/* Session Info Bar */}
          <div className="p-4 bg-profit/5 border border-profit/20 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-profit rounded-full animate-pulse" />
                <span className="text-profit font-semibold">LIVE:</span>
                <span className="text-cream">{activeSession.name}</span>
                <span className="text-slate-400">({activeSession.assetSymbol})</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-400">
                  {completedSignals}/{activeSignals.length} signals
                </span>
                <span className="text-slate-400">Ends {formatTime(new Date(activeSession.endTime))}</span>
                <button
                  onClick={copyTelegramMessage}
                  className="flex items-center gap-2 px-3 py-1.5 bg-electric/10 text-electric rounded-lg hover:bg-electric/20 transition-all"
                >
                  {copiedMessage ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copy TG
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-profit transition-all duration-300" style={{ width: `${getSessionProgress()}%` }} />
            </div>
          </div>

          {/* Main Signal Display */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Current Signal */}
            <div
              className={`p-8 rounded-3xl border-2 ${
                currentSignal
                  ? currentSignal.direction === 'up'
                    ? 'bg-profit/10 border-profit/40'
                    : 'bg-loss/10 border-loss/40'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {currentSignal ? (
                <motion.div
                  key={currentSignal.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <p className="text-sm text-slate-400 mb-2">CURRENT SIGNAL</p>
                  <div className="flex justify-center mb-4">
                    <div
                      className={`w-24 h-24 rounded-full flex items-center justify-center ${
                        currentSignal.direction === 'up' ? 'bg-profit/20' : 'bg-loss/20'
                      }`}
                    >
                      {currentSignal.direction === 'up' ? (
                        <ArrowUp className="w-12 h-12 text-profit" strokeWidth={3} />
                      ) : (
                        <ArrowDown className="w-12 h-12 text-loss" strokeWidth={3} />
                      )}
                    </div>
                  </div>
                  <p
                    className={`text-5xl font-bold mb-2 ${
                      currentSignal.direction === 'up' ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {currentSignal.direction.toUpperCase()}
                  </p>
                  <p className="text-slate-400 mb-4">{activeSession.assetSymbol}</p>

                  {/* Countdown */}
                  <div className="flex items-center justify-center gap-2 text-2xl font-mono">
                    <Timer className="w-6 h-6 text-slate-400" />
                    <span className={remainingTime <= 30 ? 'text-loss animate-pulse' : 'text-cream'}>
                      {formatSeconds(remainingTime)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">remaining</p>
                </motion.div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No active signal</p>
                  {nextSignal && (
                    <p className="text-sm text-slate-500 mt-2">
                      Next signal in {formatSeconds(timeUntilNext)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Next Signal & Info */}
            <div className="space-y-6">
              {/* Next Signal */}
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-sm text-slate-400 mb-4">NEXT SIGNAL</p>
                {nextSignal ? (
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        nextSignal.direction === 'up' ? 'bg-profit/10' : 'bg-loss/10'
                      }`}
                    >
                      {nextSignal.direction === 'up' ? (
                        <ArrowUp className="w-7 h-7 text-profit" />
                      ) : (
                        <ArrowDown className="w-7 h-7 text-loss" />
                      )}
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${nextSignal.direction === 'up' ? 'text-profit' : 'text-loss'}`}>
                        {nextSignal.direction.toUpperCase()}
                      </p>
                      <p className="text-slate-400">at {formatTime(new Date(nextSignal.startTime))}</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-3xl font-mono font-bold text-cream">{formatSeconds(timeUntilNext)}</p>
                      <p className="text-xs text-slate-500">until start</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No more signals in this session</p>
                )}
              </div>

              {/* Session Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 rounded-xl text-center">
                  <p className="text-2xl font-bold text-profit">
                    {activeSignals.filter((s) => s.direction === 'up').length}
                  </p>
                  <p className="text-xs text-slate-500">UP Signals</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl text-center">
                  <p className="text-2xl font-bold text-loss">
                    {activeSignals.filter((s) => s.direction === 'down').length}
                  </p>
                  <p className="text-xs text-slate-500">DOWN Signals</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl text-center">
                  <p className="text-2xl font-bold text-gold">{activeSignals.length - completedSignals}</p>
                  <p className="text-xs text-slate-500">Remaining</p>
                </div>
              </div>
            </div>
          </div>

          {/* Signal Timeline */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h3 className="text-lg font-semibold text-cream mb-4">Signal Timeline</h3>
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-max">
                {activeSignals.map((signal, index) => {
                  const now = currentTime.getTime();
                  const start = new Date(signal.startTime).getTime();
                  const end = new Date(signal.endTime).getTime();
                  const isPast = now > end;
                  const isCurrent = now >= start && now < end;

                  return (
                    <div
                      key={signal.id}
                      className={`w-24 p-3 rounded-xl border text-center transition-all ${
                        isCurrent
                          ? signal.direction === 'up'
                            ? 'bg-profit/20 border-profit/40 scale-110 shadow-lg shadow-profit/20'
                            : 'bg-loss/20 border-loss/40 scale-110 shadow-lg shadow-loss/20'
                          : isPast
                          ? 'bg-white/5 border-white/10 opacity-40'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <p className="text-xs text-slate-400 mb-2">#{index + 1}</p>
                      <p className="text-xs text-slate-500 mb-1">{formatTime(new Date(signal.startTime))}</p>
                      <div className="flex justify-center">
                        {signal.direction === 'up' ? (
                          <ArrowUp
                            className={`w-6 h-6 ${
                              isCurrent ? 'text-profit' : isPast ? 'text-slate-500' : 'text-profit/60'
                            }`}
                          />
                        ) : (
                          <ArrowDown
                            className={`w-6 h-6 ${
                              isCurrent ? 'text-loss' : isPast ? 'text-slate-500' : 'text-loss/60'
                            }`}
                          />
                        )}
                      </div>
                      <p
                        className={`text-xs font-medium mt-1 ${
                          isCurrent
                            ? signal.direction === 'up'
                              ? 'text-profit'
                              : 'text-loss'
                            : isPast
                            ? 'text-slate-500'
                            : signal.direction === 'up'
                            ? 'text-profit/60'
                            : 'text-loss/60'
                        }`}
                      >
                        {signal.direction.toUpperCase()}
                      </p>
                      {isCurrent && (
                        <div className="mt-2">
                          <span className="px-2 py-0.5 text-xs bg-gold text-void rounded-full">NOW</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5">
            <Signal className="w-20 h-20 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-cream mb-2">No Active Session</h2>
            <p className="text-slate-400 mb-6">Start a session to begin broadcasting signals</p>
            <Link
              href="/admin/sessions/new"
              className="inline-flex items-center gap-2 px-8 py-4 bg-loss text-white font-bold rounded-xl hover:bg-loss/90 transition-all"
            >
              <TrendingUp className="w-5 h-5" />
              Create New Session
            </Link>
          </div>

          {/* Scheduled Sessions */}
          {scheduledSessions.length > 0 && (
            <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
              <h3 className="text-lg font-semibold text-cream mb-4">Scheduled Sessions</h3>
              <div className="space-y-3">
                {scheduledSessions.map((session) => {
                  const sSignals = Array.isArray(session.signals) ? session.signals : [];
                  return (
                    <div key={session.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                      <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-gold" />
                      </div>
                      <div className="flex-1">
                        <p className="text-cream font-medium">{session.name}</p>
                        <p className="text-sm text-slate-400">
                          {session.assetSymbol} • {sSignals.length} signals • {formatTime(new Date(session.startTime))}
                        </p>
                      </div>
                      <button
                        onClick={() => activateSession(session.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-profit text-void font-semibold rounded-xl hover:bg-profit/90 transition-all"
                      >
                        <Play className="w-4 h-4" />
                        Go Live
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
