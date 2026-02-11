'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Play, Pause, Square, Trash2, Plus, Clock, Settings, X,
  TrendingUp, TrendingDown, DollarSign, BarChart3, Activity,
  ChevronDown, ChevronUp, Grid3X3, AlertTriangle,
  Loader2, RefreshCw, Key, Lock, Unlock, CheckCircle,
  ExternalLink, HelpCircle, Sparkles,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import {
  useBotEngine,
  type CreateDCAParams,
  type CreateGridParams,
} from '@/lib/services/bot-trading-engine';
import {
  type TradingBot, type DCAFrequency, type GridType, type GridStrategy,
  frequencyLabel, generateArithmeticGrid, generateGeometricGrid,
  calculateGridProfitPerCycle,
} from '@/lib/bot-trading-types';

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT',
  'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT',
];
const FREQUENCIES: DCAFrequency[] = ['1m','5m','15m','1h','4h','12h','daily','weekly','monthly'];

export default function DashboardBotsPage() {
  const { user } = useStore();
  const { bots, loading, fetchBots, startBot, pauseBot, stopBot, deleteBot, createDCABot, createGridBot } = useBotEngine();

  const [botAccess, setBotAccess] = useState<{ dca: boolean; grid: boolean }>({ dca: false, grid: false });
  const [accessLoading, setAccessLoading] = useState(true);
  const [tierLevel, setTierLevel] = useState(0);
  const [tierActive, setTierActive] = useState(false);
  const [showActivate, setShowActivate] = useState<'dca' | 'grid' | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<'dca' | 'grid' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    checkAccess();
    fetchBots(user.id);
  }, [user?.id]);

  const checkAccess = async () => {
    if (!user?.id) return;
    setAccessLoading(true);
    try {
      // Check activation keys
      const res = await fetch(`/api/bots/keys?action=check&userId=${user.id}`);
      const data = await res.json();
      if (data.success) setBotAccess(data.access);

      // Check tier level from Supabase
      if (isSupabaseConfigured()) {
        const { data: userData } = await supabase
          .from('users')
          .select('tier_level, tier_active')
          .eq('id', user.id)
          .maybeSingle();

        const tl = Number(userData?.tier_level ?? 0);
        const ta = Boolean(userData?.tier_active);
        setTierLevel(tl);
        setTierActive(ta);
      }
    } catch {}
    setAccessLoading(false);
  };

  // DCA requires tier >= 2, Grid requires tier >= 3
  const dcaTierOk = tierActive && tierLevel >= 2;
  const gridTierOk = tierActive && tierLevel >= 3;

  // Access = tier check AND (activation key OR tier grants it automatically)
  const dcaAllowed = dcaTierOk && botAccess.dca;
  const gridAllowed = gridTierOk && botAccess.grid;

  const hasAnyAccess = dcaAllowed || gridAllowed;
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalPnl = bots.reduce((s, b) => s + (b.total_pnl ?? 0), 0);
  const totalInvested = bots.reduce((s, b) => s + (b.invested_amount ?? 0), 0);

  const onActivated = (botType: 'dca' | 'grid') => {
    setBotAccess(prev => ({ ...prev, [botType]: true }));
    setShowActivate(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream">Trading Bots</h1>
          <p className="text-sm text-cream/50">Automated DCA & Grid strategies</p>
        </div>
        {hasAnyAccess && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-electric text-void rounded-xl font-semibold hover:bg-electric/90 transition-all">
            <Plus className="w-4 h-4" /> New Bot
          </button>
        )}
      </div>

      {/* Activation Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <ActivationCard botType="dca" name="DCA Master"
          description={!dcaTierOk ? `Requires Trader Tier (Tier 2) — Current: ${['Basic','Starter','Trader','Professional','Elite'][tierLevel] || 'Basic'}` : "Dollar-cost averaging with safety orders, trailing take-profit, and automatic dip-buying"}
          icon={Clock} activated={dcaAllowed} loading={accessLoading} color="purple"
          onActivate={() => dcaTierOk ? setShowActivate('dca') : {}}
          tierLocked={!dcaTierOk} />
        <ActivationCard botType="grid" name="Grid Warrior"
          description={!gridTierOk ? `Requires Professional Tier (Tier 3) — Current: ${['Basic','Starter','Trader','Professional','Elite'][tierLevel] || 'Basic'}` : "Automated buy-low sell-high grid strategy — profits from price oscillation in any range"}
          icon={Grid3X3} activated={gridAllowed} loading={accessLoading} color="orange"
          onActivate={() => gridTierOk ? setShowActivate('grid') : {}}
          tierLocked={!gridTierOk} />
      </div>

      {/* Stats + Bot List (only if has access) */}
      {hasAnyAccess && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Bots', value: bots.length, icon: Bot, color: 'text-electric' },
              { label: 'Active', value: activeBots, icon: Activity, color: 'text-profit' },
              { label: 'Total P&L', value: `$${totalPnl.toFixed(2)}`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, color: totalPnl >= 0 ? 'text-profit' : 'text-loss' },
              { label: 'Invested', value: `$${totalInvested.toFixed(2)}`, icon: DollarSign, color: 'text-gold' },
            ].map((s, i) => (
              <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-cream/50">{s.label}</span>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-electric animate-spin" />
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
              <Bot className="w-12 h-12 text-cream/20 mx-auto mb-3" />
              <p className="text-cream/40 mb-4">No bots created yet</p>
              <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-electric text-void rounded-xl font-semibold text-sm">
                Create Your First Bot
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bots.map(bot => (
                <BotCard key={bot.id} bot={bot} expanded={expanded === bot.id}
                  onToggle={() => setExpanded(expanded === bot.id ? null : bot.id)}
                  onStart={() => startBot(bot.id)} onPause={() => pauseBot(bot.id)} onStop={() => stopBot(bot.id)}
                  onDelete={() => { if (confirm('Delete this bot?')) deleteBot(bot.id); }} />
              ))}
            </div>
          )}
        </>
      )}

      {!accessLoading && !hasAnyAccess && (
        <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
          <Lock className="w-10 h-10 text-cream/20 mx-auto mb-3" />
          {(!dcaTierOk && !gridTierOk) ? (
            <>
              <h3 className="text-lg font-semibold text-cream mb-2">Tier Upgrade Required</h3>
              <p className="text-sm text-cream/40 max-w-md mx-auto mb-2">
                DCA Bots require <span className="text-electric font-semibold">Trader Tier ($1,000)</span> and
                Grid Warriors require <span className="text-gold font-semibold">Professional Tier ($3,000)</span>.
              </p>
              <p className="text-xs text-cream/30 max-w-md mx-auto mb-6">
                {tierLevel === 0 ? 'You need to purchase a tier first.' : `Your current tier: ${['Basic','Starter','Trader','Professional','Elite'][tierLevel] || 'Basic'}`}
              </p>
              <Link href="/dashboard/tier"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-void rounded-xl font-semibold text-sm hover:bg-gold/90 transition-all">
                <ExternalLink className="w-4 h-4" /> Upgrade Tier
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-cream mb-2">Activate a Bot to Get Started</h3>
              <p className="text-sm text-cream/40 max-w-md mx-auto mb-6">
                Your tier grants bot access! Purchase an activation key from our team, enter it above, and start running automated strategies.
              </p>
              <Link href="/invest/bots/contact?bot=dca"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-electric text-void rounded-xl font-semibold text-sm hover:bg-electric/90 transition-all">
                <ExternalLink className="w-4 h-4" /> Contact Sales
              </Link>
            </>
          )}
        </div>
      )}

      {/* Activation Modal */}
      <AnimatePresence>
        {showActivate && <ActivationModal botType={showActivate} userId={user?.id ?? ''} onClose={() => setShowActivate(null)} onSuccess={onActivated} />}
      </AnimatePresence>

      {/* Create Bot Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateBotModal onClose={() => { setShowCreate(false); setCreateType(null); }}
            createType={createType} setCreateType={setCreateType} userId={user?.id ?? ''}
            botAccess={{ dca: dcaAllowed, grid: gridAllowed }}
            onCreateDCA={async (p) => { await createDCABot(p); setShowCreate(false); setCreateType(null); }}
            onCreateGrid={async (p) => { await createGridBot(p); setShowCreate(false); setCreateType(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================
   ACTIVATION CARD
   ============================================ */
function ActivationCard({ botType, name, description, icon: Icon, activated, loading, color, onActivate, tierLocked }: {
  botType: 'dca' | 'grid'; name: string; description: string; icon: any;
  activated: boolean; loading: boolean; color: 'purple' | 'orange'; onActivate: () => void; tierLocked?: boolean;
}) {
  const c = color === 'purple'
    ? { bg: 'from-purple-500/15 to-purple-500/5', border: 'border-purple-500/20', aBorder: 'border-purple-400/40', text: 'text-purple-400', btn: 'bg-purple-500 hover:bg-purple-400' }
    : { bg: 'from-orange-500/15 to-orange-500/5', border: 'border-orange-500/20', aBorder: 'border-orange-400/40', text: 'text-orange-400', btn: 'bg-orange-500 hover:bg-orange-400' };

  return (
    <div className={`p-5 bg-gradient-to-br ${c.bg} rounded-xl border ${activated ? c.aBorder : c.border} transition-all ${tierLocked ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 ${activated ? 'ring-2 ring-profit/30' : ''}`}>
          <Icon className={`w-6 h-6 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-cream">{name}</h3>
            {loading ? (
              <Loader2 className="w-4 h-4 text-cream/30 animate-spin" />
            ) : activated ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-profit/20 text-profit text-[10px] font-bold rounded-full">
                <CheckCircle className="w-3 h-3" /> ACTIVE
              </span>
            ) : tierLocked ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gold/20 text-gold text-[10px] font-bold rounded-full">
                <Lock className="w-3 h-3" /> TIER REQUIRED
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-cream/40 text-[10px] font-bold rounded-full">
                <Lock className="w-3 h-3" /> LOCKED
              </span>
            )}
          </div>
          <p className="text-xs text-cream/50 mb-3">{description}</p>
          {!loading && tierLocked && (
            <Link href="/dashboard/tier"
              className="flex items-center gap-2 px-4 py-2 bg-gold/80 hover:bg-gold text-void font-semibold text-sm rounded-lg transition-all w-fit">
              <Sparkles className="w-4 h-4" /> Upgrade Tier
            </Link>
          )}
          {!loading && !activated && !tierLocked && (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={onActivate}
                className={`flex items-center gap-2 px-4 py-2 ${c.btn} text-white font-semibold text-sm rounded-lg transition-all`}>
                <Key className="w-4 h-4" /> Activate {botType.toUpperCase()}
              </button>
              <Link href={`/invest/bots/contact?bot=${botType}`}
                className="flex items-center gap-1.5 text-xs text-cream/40 hover:text-cream/60 transition-colors">
                <HelpCircle className="w-3.5 h-3.5" /> Don't have a key? Click here
              </Link>
            </div>
          )}
          {!loading && activated && (
            <p className="flex items-center gap-1.5 text-xs text-profit/70">
              <Unlock className="w-3.5 h-3.5" /> Bot unlocked — create bots below
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   ACTIVATION MODAL (key input)
   ============================================ */
function ActivationModal({ botType, userId, onClose, onSuccess }: {
  botType: 'dca' | 'grid'; userId: string; onClose: () => void; onSuccess: (t: 'dca' | 'grid') => void;
}) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { setError('Please enter your activation key'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/bots/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', key: key.trim(), userId }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => onSuccess(botType), 1800);
      } else {
        setError(data.error || 'Invalid key');
      }
    } catch { setError('Network error. Please try again.'); }
    setSubmitting(false);
  };

  const ac = botType === 'dca'
    ? { text: 'text-purple-400', btn: 'bg-purple-500 hover:bg-purple-400' }
    : { text: 'text-orange-400', btn: 'bg-orange-500 hover:bg-orange-400' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-[#0f1118] border border-white/10 rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-10 text-center">
            <div className="w-16 h-16 bg-profit/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-profit" />
            </div>
            <h3 className="text-xl font-bold text-cream mb-2">Bot Activated!</h3>
            <p className="text-sm text-cream/60">Your {botType.toUpperCase()} bot is now unlocked.</p>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-cream flex items-center gap-2">
                <Key className={`w-5 h-5 ${ac.text}`} />
                Activate {botType === 'dca' ? 'DCA Master' : 'Grid Warrior'}
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-cream/50" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-cream/50 mb-2">Activation Key</label>
                <input type="text" value={key}
                  onChange={e => { setKey(e.target.value.toUpperCase()); setError(''); }}
                  placeholder={botType === 'dca' ? 'DCA-XXXX-XXXX-XXXX' : 'GRID-XXXX-XXXX-XXXX'}
                  className={`w-full px-4 py-3 bg-white/5 border ${error ? 'border-loss/50' : 'border-white/10'} rounded-xl text-cream font-mono text-center text-lg tracking-wider outline-none focus:border-electric/50 transition-colors`}
                  autoFocus />
                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-loss flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                  </motion.p>
                )}
              </div>
              <button type="submit" disabled={submitting || !key.trim()}
                className={`w-full flex items-center justify-center gap-2 py-3 ${ac.btn} text-white font-bold rounded-xl transition-all disabled:opacity-50`}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                Activate Bot
              </button>
              <div className="text-center pt-2 border-t border-white/5">
                <Link href={`/invest/bots/contact?bot=${botType}`}
                  className="inline-flex items-center gap-1.5 text-xs text-cream/40 hover:text-electric transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" /> Don't have an activation key? Click here to contact us
                </Link>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ============================================
   BOT CARD
   ============================================ */
function BotCard({ bot, expanded, onToggle, onStart, onPause, onStop, onDelete }: {
  bot: TradingBot; expanded: boolean;
  onToggle: () => void; onStart: () => void; onPause: () => void; onStop: () => void; onDelete: () => void;
}) {
  const pnl = bot.total_pnl ?? 0;
  const isDCA = bot.bot_type === 'dca';
  const isRunning = bot.status === 'running';
  const isPaused = bot.status === 'paused';

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]" onClick={onToggle}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDCA ? 'bg-purple-500/20' : 'bg-orange-500/20'}`}>
          {isDCA ? <Clock className="w-5 h-5 text-purple-400" /> : <Grid3X3 className="w-5 h-5 text-orange-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-cream truncate">{bot.name}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${isDCA ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'}`}>
              {bot.bot_type.toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-cream/40">{bot.pair} • {bot.total_trades} trades</span>
        </div>
        <div className="text-right mr-2 hidden sm:block">
          <p className={`font-bold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</p>
          <p className="text-xs text-cream/40">${(bot.invested_amount ?? 0).toFixed(0)} invested</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isRunning ? 'bg-profit/20 text-profit' : isPaused ? 'bg-gold/20 text-gold' : 'bg-white/10 text-cream/40'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-profit animate-pulse' : isPaused ? 'bg-gold' : 'bg-cream/30'}`} />
          {bot.status}
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {!isRunning && <button onClick={onStart} className="p-1.5 hover:bg-profit/20 rounded-lg" title="Start"><Play className="w-4 h-4 text-profit" /></button>}
          {isRunning && <button onClick={onPause} className="p-1.5 hover:bg-gold/20 rounded-lg" title="Pause"><Pause className="w-4 h-4 text-gold" /></button>}
          {(isRunning || isPaused) && <button onClick={onStop} className="p-1.5 hover:bg-loss/20 rounded-lg" title="Stop"><Square className="w-4 h-4 text-loss" /></button>}
          {!isRunning && !isPaused && <button onClick={onDelete} className="p-1.5 hover:bg-loss/20 rounded-lg" title="Delete"><Trash2 className="w-4 h-4 text-loss/60" /></button>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-cream/30" /> : <ChevronDown className="w-4 h-4 text-cream/30" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
              {isDCA && bot.dca_config && <DCADetail cfg={bot.dca_config} />}
              {!isDCA && bot.grid_config && <GridDetail cfg={bot.grid_config} levels={bot.grid_levels ?? []} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DCADetail({ cfg }: { cfg: NonNullable<TradingBot['dca_config']> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <Stat label="Order Amount" value={`$${cfg.order_amount}`} />
      <Stat label="Frequency" value={frequencyLabel(cfg.frequency)} />
      <Stat label="Take Profit" value={`${cfg.take_profit_pct}%`} />
      <Stat label="Stop Loss" value={cfg.stop_loss_pct ? `${cfg.stop_loss_pct}%` : '—'} />
      <Stat label="Avg Price" value={cfg.current_avg_price > 0 ? `$${cfg.current_avg_price.toFixed(2)}` : '—'} />
      <Stat label="Base Held" value={cfg.total_base_bought.toFixed(6)} />
      <Stat label="Quote Spent" value={`$${cfg.total_quote_spent.toFixed(2)}`} />
      <Stat label="Deals Closed" value={cfg.deal_count} />
      {cfg.safety_orders_enabled && (
        <>
          <Stat label="Safety Orders" value={`${cfg.active_safety_count} / ${cfg.max_safety_orders}`} />
          <Stat label="SO Size" value={`$${cfg.safety_order_size}`} />
          <Stat label="SO Step" value={`${cfg.safety_order_step_pct}%`} />
          <Stat label="Vol Scale" value={`${cfg.safety_order_volume_scale}×`} />
        </>
      )}
      {cfg.trailing_tp_enabled && <Stat label="Peak Profit" value={`${cfg.peak_profit_pct.toFixed(2)}%`} />}
    </div>
  );
}

function GridDetail({ cfg, levels }: { cfg: NonNullable<TradingBot['grid_config']>; levels: any[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat label="Range" value={`$${cfg.lower_price} – $${cfg.upper_price}`} />
        <Stat label="Grids" value={cfg.grid_count} />
        <Stat label="Type" value={cfg.grid_type} />
        <Stat label="Strategy" value={cfg.strategy} />
        <Stat label="Grid Profit" value={`$${cfg.grid_profit.toFixed(2)}`} />
        <Stat label="Float P&L" value={`$${cfg.float_pnl.toFixed(2)}`} />
        <Stat label="Cycles" value={cfg.completed_cycles} />
        <Stat label="Per Grid" value={`$${cfg.per_grid_amount.toFixed(2)}`} />
      </div>
      {levels.length > 0 && (
        <div className="flex gap-0.5 h-6">
          {levels.map((lv: any, i: number) => (
            <div key={i} className={`flex-1 rounded-sm ${
              lv.buy_filled && lv.sell_filled ? 'bg-profit/40' : lv.buy_filled ? 'bg-electric/40' : lv.sell_filled ? 'bg-gold/40' : 'bg-white/10'
            }`} title={`#${lv.level_index} $${lv.price}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-2 bg-white/5 rounded-lg">
      <p className="text-cream/40 text-[10px]">{label}</p>
      <p className="text-cream font-medium">{value}</p>
    </div>
  );
}

/* ============================================
   CREATE MODAL
   ============================================ */
function CreateBotModal({ onClose, createType, setCreateType, userId, botAccess, onCreateDCA, onCreateGrid }: {
  onClose: () => void; createType: 'dca' | 'grid' | null; setCreateType: (t: 'dca' | 'grid' | null) => void;
  userId: string; botAccess: { dca: boolean; grid: boolean };
  onCreateDCA: (p: CreateDCAParams) => Promise<void>; onCreateGrid: (p: CreateGridParams) => Promise<void>;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0f1118] border border-white/10 rounded-2xl p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-cream">
            {createType === null ? 'Choose Bot Type' : createType === 'dca' ? 'New DCA Bot' : 'New Grid Bot'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-cream/50" /></button>
        </div>
        {createType === null && (
          <div className="grid grid-cols-2 gap-4">
            {botAccess.dca && (
              <button onClick={() => setCreateType('dca')} className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-left hover:border-purple-400/40 transition-all">
                <Clock className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="font-semibold text-cream mb-1">DCA Bot</h3>
                <p className="text-xs text-cream/50">Dollar-cost averaging with safety orders</p>
              </button>
            )}
            {botAccess.grid && (
              <button onClick={() => setCreateType('grid')} className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-left hover:border-orange-400/40 transition-all">
                <Grid3X3 className="w-8 h-8 text-orange-400 mb-3" />
                <h3 className="font-semibold text-cream mb-1">Grid Bot</h3>
                <p className="text-xs text-cream/50">Buy-low sell-high in a price range</p>
              </button>
            )}
          </div>
        )}
        {createType === 'dca' && botAccess.dca && <DCAForm userId={userId} onSubmit={onCreateDCA} />}
        {createType === 'grid' && botAccess.grid && <GridForm userId={userId} onSubmit={onCreateGrid} />}
      </motion.div>
    </motion.div>
  );
}

/* ============================================
   DCA FORM
   ============================================ */
function DCAForm({ userId, onSubmit }: { userId: string; onSubmit: (p: CreateDCAParams) => Promise<void> }) {
  const [pair, setPair] = useState('BTC/USDT');
  const [amount, setAmount] = useState(25);
  const [freq, setFreq] = useState<DCAFrequency>('4h');
  const [tp, setTp] = useState(3);
  const [sl, setSl] = useState<number | ''>('');
  const [trail, setTrail] = useState(false);
  const [trailDev, setTrailDev] = useState(1);
  const [soEnabled, setSoEnabled] = useState(false);
  const [maxSo, setMaxSo] = useState(5);
  const [soSize, setSoSize] = useState(25);
  const [soStep, setSoStep] = useState(2);
  const [soVolScale, setSoVolScale] = useState(1.5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit({
      userId, name: `DCA ${pair}`, pair, orderAmount: amount, frequency: freq,
      takeProfitPct: tp, stopLossPct: sl === '' ? undefined : sl,
      trailingTpEnabled: trail, trailingTpDeviation: trailDev,
      safetyOrdersEnabled: soEnabled, maxSafetyOrders: maxSo,
      safetyOrderSize: soSize, safetyOrderStepPct: soStep,
      safetyOrderStepScale: 1, safetyOrderVolumeScale: soVolScale,
    });
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Trading Pair"><select value={pair} onChange={e => setPair(e.target.value)} className="input-dark">{PAIRS.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Buy Amount ($)"><input type="number" value={amount} onChange={e => setAmount(+e.target.value)} className="input-dark" min={1} /></Field>
        <Field label="Frequency"><select value={freq} onChange={e => setFreq(e.target.value as DCAFrequency)} className="input-dark">{FREQUENCIES.map(f => <option key={f} value={f}>{frequencyLabel(f)}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Take Profit (%)"><input type="number" value={tp} onChange={e => setTp(+e.target.value)} className="input-dark" step={0.5} min={0.1} /></Field>
        <Field label="Stop Loss (%)"><input type="number" value={sl} onChange={e => setSl(e.target.value === '' ? '' : +e.target.value)} className="input-dark" placeholder="Optional" step={0.5} /></Field>
      </div>
      <Toggle label="Trailing Take Profit" checked={trail} onChange={setTrail} />
      {trail && <Field label="Trailing Deviation (%)"><input type="number" value={trailDev} onChange={e => setTrailDev(+e.target.value)} className="input-dark" step={0.1} min={0.1} /></Field>}
      <Toggle label="Safety Orders (Dip Buying)" checked={soEnabled} onChange={setSoEnabled} />
      {soEnabled && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl">
          <Field label="Max Orders"><input type="number" value={maxSo} onChange={e => setMaxSo(+e.target.value)} className="input-dark" min={1} max={25} /></Field>
          <Field label="SO Size ($)"><input type="number" value={soSize} onChange={e => setSoSize(+e.target.value)} className="input-dark" min={1} /></Field>
          <Field label="Step (%)"><input type="number" value={soStep} onChange={e => setSoStep(+e.target.value)} className="input-dark" step={0.5} min={0.5} /></Field>
          <Field label="Vol Scale (×)"><input type="number" value={soVolScale} onChange={e => setSoVolScale(+e.target.value)} className="input-dark" step={0.1} min={1} /></Field>
        </div>
      )}
      <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Create DCA Bot
      </button>
    </div>
  );
}

/* ============================================
   GRID FORM
   ============================================ */
function GridForm({ userId, onSubmit }: { userId: string; onSubmit: (p: CreateGridParams) => Promise<void> }) {
  const [pair, setPair] = useState('BTC/USDT');
  const [upper, setUpper] = useState(105000);
  const [lower, setLower] = useState(90000);
  const [count, setCount] = useState(15);
  const [type, setType] = useState<GridType>('arithmetic');
  const [invest, setInvest] = useState(1000);
  const [strategy, setStrategy] = useState<GridStrategy>('neutral');
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    if (lower >= upper || count < 3) return null;
    const levels = type === 'geometric' ? generateGeometricGrid(lower, upper, count) : generateArithmeticGrid(lower, upper, count);
    const perGrid = invest / count;
    const spread = ((levels[1] - levels[0]) / levels[0]) * 100;
    const estProfit = calculateGridProfitPerCycle(levels[0], levels[1], perGrid / levels[0]);
    return { perGrid, spread, estProfit };
  }, [lower, upper, count, type, invest]);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit({
      userId, name: `Grid ${pair}`, pair, upperPrice: upper, lowerPrice: lower,
      gridCount: count, gridType: type, totalInvestment: invest, strategy,
    });
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <Field label="Trading Pair"><select value={pair} onChange={e => setPair(e.target.value)} className="input-dark">{PAIRS.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lower Price ($)"><input type="number" value={lower} onChange={e => setLower(+e.target.value)} className="input-dark" /></Field>
        <Field label="Upper Price ($)"><input type="number" value={upper} onChange={e => setUpper(+e.target.value)} className="input-dark" /></Field>
      </div>
      <Field label={`Grid Count: ${count}`}>
        <input type="range" min={3} max={100} value={count} onChange={e => setCount(+e.target.value)} className="w-full accent-orange-500" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grid Type">
          <select value={type} onChange={e => setType(e.target.value as GridType)} className="input-dark">
            <option value="arithmetic">Arithmetic ($)</option>
            <option value="geometric">Geometric (%)</option>
          </select>
        </Field>
        <Field label="Investment ($)"><input type="number" value={invest} onChange={e => setInvest(+e.target.value)} className="input-dark" min={10} /></Field>
      </div>
      <Field label="Strategy">
        <div className="flex gap-2">
          {(['neutral','long','short'] as GridStrategy[]).map(s => (
            <button key={s} onClick={() => setStrategy(s)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${strategy === s ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-cream/40'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </Field>
      {preview && (
        <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl grid grid-cols-3 gap-2 text-xs">
          <div><span className="text-cream/40">Per Grid</span><p className="text-cream font-medium">${preview.perGrid.toFixed(2)}</p></div>
          <div><span className="text-cream/40">Spread</span><p className="text-cream font-medium">{preview.spread.toFixed(2)}%</p></div>
          <div><span className="text-cream/40">Est./Cycle</span><p className="text-profit font-medium">${preview.estProfit.toFixed(4)}</p></div>
        </div>
      )}
      <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Create Grid Bot
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-cream/50 mb-1">{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between w-full p-3 bg-white/5 rounded-xl border border-white/10">
      <span className="text-sm text-cream">{label}</span>
      <div className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-electric' : 'bg-white/20'} relative`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}
