'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Save,
  Play,
  Copy,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  RefreshCw,
  MessageCircle
} from 'lucide-react';
import { useAdminAuthStore, useAdminSessionStore } from '@/lib/admin-store';
import { marketAssets } from '@/lib/data';
import { generateTimeSlots, formatTime, generateTelegramMessage, TradingSession } from '@/lib/admin-types';

// Get forex assets for trading
const forexAssets = marketAssets.filter(a => a.type === 'forex');

// Duration options
const tradeDurations = [
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '15 minutes', value: 900 },
];

export default function NewSessionPage() {
  const router = useRouter();
  const { admin } = useAdminAuthStore();
  const { createQuickSession, updateSession, activateSession } = useAdminSessionStore();
  
  const [sessionName, setSessionName] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(forexAssets[0]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [sessionDuration, setSessionDuration] = useState(55); // minutes
  const [tradeDuration, setTradeDuration] = useState(300); // seconds (5 min)
  const [signals, setSignals] = useState<Array<{ time: Date; direction: 'up' | 'down' }>>([]);
  const [createdSession, setCreatedSession] = useState<TradingSession | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [error, setError] = useState('');

  // Initialize start time to next 5-minute mark
  useEffect(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextFiveMin = Math.ceil((minutes + 1) / 5) * 5;
    now.setMinutes(nextFiveMin);
    now.setSeconds(0);
    now.setMilliseconds(0);
    
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setStartTime(timeStr);
    
    // Generate default session name
    setSessionName(`${selectedAsset.symbol} Trading Session`);
  }, [selectedAsset]);

  // Generate time slots when parameters change
  useEffect(() => {
    if (!startTime) return;
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);
    
    const end = new Date(start.getTime() + sessionDuration * 60 * 1000);
    const slots = generateTimeSlots(start, end, tradeDuration);
    
    setSignals(slots.map(slot => ({
      time: slot.start,
      direction: 'up' as const, // Default to UP, admin will change
    })));
  }, [startTime, sessionDuration, tradeDuration]);

  // Toggle signal direction
  const toggleSignalDirection = (index: number) => {
    setSignals(prev => prev.map((sig, i) => 
      i === index 
        ? { ...sig, direction: sig.direction === 'up' ? 'down' : 'up' }
        : sig
    ));
  };

  // Set all signals to one direction
  const setAllSignals = (direction: 'up' | 'down') => {
    setSignals(prev => prev.map(sig => ({ ...sig, direction })));
  };

  // Randomize signals
  const randomizeSignals = () => {
    setSignals(prev => prev.map(sig => ({
      ...sig,
      direction: Math.random() > 0.5 ? 'up' : 'down',
    })));
  };

  // Create pattern (alternating, etc.)
  const createPattern = (pattern: 'alternate' | 'double') => {
    if (pattern === 'alternate') {
      setSignals(prev => prev.map((sig, i) => ({
        ...sig,
        direction: i % 2 === 0 ? 'up' : 'down',
      })));
    } else if (pattern === 'double') {
      setSignals(prev => prev.map((sig, i) => ({
        ...sig,
        direction: Math.floor(i / 2) % 2 === 0 ? 'up' : 'down',
      })));
    }
  };

  // Create the session
  const handleCreateSession = () => {
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }
    if (!startTime) {
      setError('Please select a start time');
      return;
    }
    if (signals.length === 0) {
      setError('No signals to create');
      return;
    }

    const [hours, minutes] = startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);

    const session = createQuickSession(
      selectedAsset.id,
      selectedAsset.symbol,
      selectedAsset.name,
      start,
      sessionDuration,
      tradeDuration,
      admin?.id || 'admin'
    );

    // Update signals with user's directions
    signals.forEach((sig, index) => {
      if (session.signals[index]) {
        session.signals[index].direction = sig.direction;
      }
    });

    updateSession(session.id, { 
      name: sessionName,
      signals: session.signals,
      status: 'scheduled' 
    });

    setCreatedSession({ ...session, name: sessionName, signals: session.signals, status: 'scheduled' });
    setError('');
  };

  // Activate and go live
  const handleGoLive = () => {
    if (createdSession) {
      activateSession(createdSession.id);
      router.push('/admin');
    }
  };

  // Copy telegram message
  const copyTelegramMessage = () => {
    if (!createdSession) return;
    const message = generateTelegramMessage(createdSession);
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  // Count signals by direction
  const upCount = signals.filter(s => s.direction === 'up').length;
  const downCount = signals.filter(s => s.direction === 'down').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-cream">Create Trading Session</h1>
        <p className="text-slate-400 mt-1">Set up signals for your community</p>
      </div>

      {createdSession ? (
        /* Session Created View */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Success Banner */}
          <div className="p-6 bg-profit/10 border border-profit/20 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-profit" />
              <h2 className="text-xl font-bold text-cream">Session Created!</h2>
            </div>
            <p className="text-slate-400">{createdSession.name}</p>
          </div>

          {/* Session Summary */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h3 className="text-lg font-semibold text-cream mb-4">Session Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500">Asset</p>
                <p className="text-cream font-medium">{createdSession.assetSymbol}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500">Start Time</p>
                <p className="text-cream font-medium">{formatTime(new Date(createdSession.startTime))}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500">End Time</p>
                <p className="text-cream font-medium">{formatTime(new Date(createdSession.endTime))}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500">Total Signals</p>
                <p className="text-cream font-medium">{createdSession.signals.length}</p>
              </div>
            </div>

            {/* Signal List */}
            <div className="space-y-2">
              <p className="text-sm text-slate-400">Signals ({upCount} UP / {downCount} DOWN)</p>
              <div className="flex flex-wrap gap-2">
                {createdSession.signals.map((signal, index) => (
                  <div
                    key={signal.id}
                    className={`px-3 py-2 rounded-lg border ${
                      signal.direction === 'up'
                        ? 'bg-profit/10 border-profit/20'
                        : 'bg-loss/10 border-loss/20'
                    }`}
                  >
                    <p className="text-xs text-slate-400">{formatTime(new Date(signal.startTime))}</p>
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

          {/* Telegram Message */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-electric" />
                <h3 className="text-lg font-semibold text-cream">Telegram Message</h3>
              </div>
              <button
                onClick={copyTelegramMessage}
                className="flex items-center gap-2 px-4 py-2 bg-electric/10 text-electric rounded-lg hover:bg-electric/20 transition-all"
              >
                {copiedMessage ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedMessage ? 'Copied!' : 'Copy Message'}
              </button>
            </div>
            <pre className="p-4 bg-void rounded-xl text-sm text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto">
              {generateTelegramMessage(createdSession)}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleGoLive}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-profit to-profit/80 text-void font-bold rounded-xl hover:shadow-lg hover:shadow-profit/20 transition-all"
            >
              <Play className="w-5 h-5" />
              Go Live Now
            </button>
            <button
              onClick={() => router.push('/admin/sessions')}
              className="px-6 py-4 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
            >
              View Sessions
            </button>
          </div>
        </motion.div>
      ) : (
        /* Session Creation Form */
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h3 className="text-lg font-semibold text-cream mb-4">Session Settings</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Session Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-loss/50"
                  placeholder="e.g., EUR/USD Power Hour"
                />
              </div>

              {/* Asset Selection */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Trading Asset
                </label>
                <button
                  onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream hover:bg-white/10 transition-all"
                >
                  <span>{selectedAsset.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
                
                {showAssetDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-charcoal border border-white/10 rounded-xl shadow-2xl z-10 overflow-hidden">
                    {forexAssets.map(asset => (
                      <button
                        key={asset.id}
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowAssetDropdown(false);
                          setSessionName(`${asset.symbol} Trading Session`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <span className="text-cream">{asset.symbol}</span>
                        <span className="text-xs text-slate-500">{asset.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Start Time */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-loss/50"
                />
              </div>

              {/* Session Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Session Duration (minutes)
                </label>
                <input
                  type="number"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(parseInt(e.target.value) || 55)}
                  min={5}
                  max={240}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-loss/50"
                />
              </div>

              {/* Trade Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Each Trade Duration
                </label>
                <select
                  value={tradeDuration}
                  onChange={(e) => setTradeDuration(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-loss/50"
                >
                  {tradeDurations.map(d => (
                    <option key={d.value} value={d.value} className="bg-charcoal">
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Signal Configuration */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-cream">Configure Signals</h3>
                <p className="text-sm text-slate-400">{signals.length} trades • Click to toggle direction</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-profit/10 text-profit rounded">↑ {upCount}</span>
                <span className="px-2 py-1 bg-loss/10 text-loss rounded">↓ {downCount}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/5">
              <button
                onClick={() => setAllSignals('up')}
                className="flex items-center gap-1 px-3 py-1.5 bg-profit/10 text-profit text-sm rounded-lg hover:bg-profit/20 transition-all"
              >
                <ArrowUp className="w-4 h-4" />
                All UP
              </button>
              <button
                onClick={() => setAllSignals('down')}
                className="flex items-center gap-1 px-3 py-1.5 bg-loss/10 text-loss text-sm rounded-lg hover:bg-loss/20 transition-all"
              >
                <ArrowDown className="w-4 h-4" />
                All DOWN
              </button>
              <button
                onClick={() => createPattern('alternate')}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-slate-300 text-sm rounded-lg hover:bg-white/10 transition-all"
              >
                Alternate
              </button>
              <button
                onClick={() => createPattern('double')}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-slate-300 text-sm rounded-lg hover:bg-white/10 transition-all"
              >
                Double Pattern
              </button>
              <button
                onClick={randomizeSignals}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-slate-300 text-sm rounded-lg hover:bg-white/10 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Randomize
              </button>
            </div>

            {/* Signal Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {signals.map((signal, index) => (
                <button
                  key={index}
                  onClick={() => toggleSignalDirection(index)}
                  className={`p-3 rounded-xl border transition-all hover:scale-105 ${
                    signal.direction === 'up'
                      ? 'bg-profit/10 border-profit/30 hover:bg-profit/20'
                      : 'bg-loss/10 border-loss/30 hover:bg-loss/20'
                  }`}
                >
                  <p className="text-xs text-slate-400 mb-1">
                    {formatTime(signal.time)}
                  </p>
                  <div className="flex items-center justify-center">
                    {signal.direction === 'up' ? (
                      <ArrowUp className="w-6 h-6 text-profit" />
                    ) : (
                      <ArrowDown className="w-6 h-6 text-loss" />
                    )}
                  </div>
                  <p className={`text-xs font-medium mt-1 ${
                    signal.direction === 'up' ? 'text-profit' : 'text-loss'
                  }`}>
                    {signal.direction.toUpperCase()}
                  </p>
                </button>
              ))}
            </div>

            {signals.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Configure start time and duration to generate time slots</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-loss/10 border border-loss/20 rounded-xl text-loss">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreateSession}
            disabled={signals.length === 0}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-loss to-loss/80 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-loss/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            Create Session ({signals.length} signals)
          </button>
        </div>
      )}
    </div>
  );
}
