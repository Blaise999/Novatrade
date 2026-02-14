'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Target,
  Wallet,
  Activity,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  ShieldCheck,
  ShieldOff,
  Lock,
  Unlock
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useSpotTradingStore } from '@/lib/spot-trading-store';
import type { SpotPosition } from '@/lib/spot-trading-types';

interface OpenTrade {
  id: string;
  symbol: string;  // mapped from pair
  market_type: 'fx' | 'stocks';
  direction: string;  // mapped from type
  amount: number;
  quantity: number | null;
  entry_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  leverage: number | null;
  profit_loss: number;  // mapped from pnl
  status: string;
  created_at: string;
}

// ============================================
// CRYPTO ASSETS DATA (for icons)
// ============================================

const cryptoIcons: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  BNB: '◆',
  SOL: '◎',
  XRP: '✕',
  ADA: '₳',
  DOGE: 'Ð',
  AVAX: '🔺',
  DOT: '●',
  LINK: '⬡',
};

// ============================================
// SHIELD STATUS BADGE
// ============================================

const ShieldStatusBadge = ({ 
  position, 
  onToggle 
}: { 
  position: SpotPosition; 
  onToggle: () => void;
}) => {
  const priceChange = position.shieldEnabled && position.shieldSnapPrice 
    ? position.currentPrice - position.shieldSnapPrice 
    : 0;
  const priceChangePercent = position.shieldSnapPrice 
    ? (priceChange / position.shieldSnapPrice) * 100 
    : 0;
  
  // Calculate protected/missed amount
  const currentValue = position.quantity * position.currentPrice;
  const shieldedValue = position.shieldSnapValue || 0;
  const protectedAmount = shieldedValue - currentValue;

  return (
    <div className="flex items-center gap-2">
      {position.shieldEnabled ? (
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Protected
          </span>
          {protectedAmount !== 0 && (
            <span className={`text-xs ${protectedAmount > 0 ? 'text-profit' : 'text-loss'}`}>
              {protectedAmount > 0 ? 'Saved' : 'Missed'}: ${Math.abs(protectedAmount).toFixed(2)}
            </span>
          )}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex items-center gap-1.5 px-2 py-1 bg-white/5 text-slate-400 rounded-lg text-xs font-medium hover:bg-white/10 transition-all border border-white/10"
        >
          <Shield className="w-3.5 h-3.5" />
          Shield
        </button>
      )}
    </div>
  );
};

// ============================================
// POSITION ROW COMPONENT
// ============================================

const PositionRow = ({ 
  position, 
  onToggleShield 
}: { 
  position: SpotPosition; 
  onToggleShield: () => void;
}) => {
  const liveValue = position.quantity * position.currentPrice;
  const displayValue = position.displayValue;
  const displayPnL = position.displayPnL;
  const displayPnLPercent = position.displayPnLPercent;

  return (
    <tr className={`hover:bg-white/5 transition-colors ${position.shieldEnabled ? 'bg-blue-500/5' : ''}`}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
            position.shieldEnabled 
              ? 'bg-blue-500/20 border border-blue-500/30' 
              : 'bg-orange-500/10'
          }`}>
            {cryptoIcons[position.symbol] || position.symbol[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-cream">{position.symbol}</p>
              {position.shieldEnabled && (
                <Lock className="w-3 h-3 text-blue-400" />
              )}
            </div>
            <p className="text-xs text-slate-500">{position.name}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-sm text-cream font-mono">
          {position.quantity.toFixed(6)}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="text-right">
          <span className="text-sm text-slate-400 font-mono">
            ${position.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="text-right">
          {position.shieldEnabled && position.shieldSnapPrice ? (
            <div className="space-y-0.5">
              <span className="text-sm text-blue-400 font-mono flex items-center justify-end gap-1">
                <Lock className="w-3 h-3" />
                ${position.shieldSnapPrice.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Live: ${position.currentPrice.toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-sm text-cream font-mono">
              ${position.currentPrice.toLocaleString()}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="text-right">
          <span className={`text-sm font-semibold ${position.shieldEnabled ? 'text-blue-400' : 'text-cream'}`}>
            ${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          {position.shieldEnabled && (
            <p className="text-xs text-slate-500">
              Live: ${liveValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="text-right">
          <span className={`text-sm font-semibold ${displayPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(2)}
          </span>
          <p className={`text-xs ${displayPnLPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
            {displayPnLPercent >= 0 ? '+' : ''}{displayPnLPercent.toFixed(2)}%
          </p>
        </div>
      </td>
      <td className="px-5 py-4">
        <ShieldStatusBadge position={position} onToggle={onToggleShield} />
      </td>
    </tr>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function PortfolioPage() {
  const { user } = useStore();
  const { 
    positions, 
    account,
    tradeHistory,
    toggleShield,
    enableAllShields,
    disableAllShields,
    isGlobalShieldActive,
    getShieldSummary,
    getTotalUnrealizedPnL,
    getDisplayPortfolioValue,
  } = useSpotTradingStore();

  const [shieldTierOk, setShieldTierOk] = useState(false);
  const [shieldMsg, setShieldMsg] = useState('');
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  // Fetch open FX/stock trades via API (service key, no client auth needed)
  useEffect(() => {
    if (!user?.id) return;
    const loadOpenTrades = async () => {
      try {
        const res = await fetch(`/api/user/trades?userId=${user.id}&status=open&pageSize=50`, {
          headers: { 'x-user-id': user.id },
          cache: 'no-store',
        });
        if (!res.ok) { setTradesLoading(false); return; }
        const json = await res.json();
        if (!json.success) { setTradesLoading(false); return; }

        const mapped: OpenTrade[] = (json.trades || [])
          .filter((t: any) => ['fx', 'stocks'].includes(t.market_type))
          .map((t: any) => ({
            id: t.id,
            symbol: t.pair || t.symbol || 'Unknown',
            market_type: t.market_type,
            direction: t.type || t.direction || 'buy',
            amount: Number(t.amount || 0),
            quantity: t.quantity,
            entry_price: Number(t.entry_price || 0),
            current_price: t.current_price ? Number(t.current_price) : null,
            stop_loss: t.stop_loss,
            take_profit: t.take_profit,
            leverage: t.leverage,
            profit_loss: Number(t.pnl || t.profit_loss || 0),
            status: t.status,
            created_at: t.created_at,
          }));
        setOpenTrades(mapped);
      } catch {
        // Network error — silent
      } finally {
        setTradesLoading(false);
      }
    };
    loadOpenTrades();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const checkShieldTier = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import('@/lib/supabase/client');
        if (!isSupabaseConfigured()) { setShieldTierOk(true); return; }
        const { data } = await supabase
          .from('users')
          .select('tier_level, tier_active')
          .eq('id', user.id)
          .maybeSingle();
        const tl = Number(data?.tier_level ?? 0);
        const ta = Boolean(data?.tier_active);
        setShieldTierOk(ta && tl >= 1);
      } catch { setShieldTierOk(false); }
    };
    checkShieldTier();
  }, [user?.id]);

  const handleToggleShield = (positionId: string) => {
    if (!shieldTierOk) {
      setShieldMsg('Shield Protection requires Starter Tier ($500) or higher. Upgrade in Tiers & Plans.');
      setTimeout(() => setShieldMsg(''), 4000);
      return;
    }
    toggleShield(positionId);
  };

  const handleEnableAllShields = () => {
    if (!shieldTierOk) {
      setShieldMsg('Shield Protection requires Starter Tier ($500) or higher.');
      setTimeout(() => setShieldMsg(''), 4000);
      return;
    }
    enableAllShields();
  };
  
  const [selectedPeriod, setSelectedPeriod] = useState<'1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');
  const globalShieldOn = isGlobalShieldActive();

  // Calculate stats
  const totalValue = getDisplayPortfolioValue();
  const totalPnL = getTotalUnrealizedPnL();
  const cashBalance = user?.balance || 0;
  const fxValue = openTrades.filter(t => t.market_type === 'fx').reduce((sum, t) => sum + (t.amount || 0), 0);
  const stocksValue = openTrades.filter(t => t.market_type === 'stocks').reduce((sum, t) => sum + (t.amount || 0), 0);
  const tradePnL = openTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
  const totalEquity = cashBalance + totalValue + fxValue + stocksValue;
  const shieldSummary = getShieldSummary();

  // Calculate allocation
  const allocation = [
    { 
      asset: 'Crypto', 
      value: totalEquity > 0 ? (totalValue / totalEquity) * 100 : 0, 
      color: '#F59E0B',
      amount: totalValue
    },
    { 
      asset: 'Forex', 
      value: totalEquity > 0 ? (fxValue / totalEquity) * 100 : 0, 
      color: '#3B82F6',
      amount: fxValue
    },
    { 
      asset: 'Stocks', 
      value: totalEquity > 0 ? (stocksValue / totalEquity) * 100 : 0, 
      color: '#8B5CF6',
      amount: stocksValue
    },
    { 
      asset: 'Cash', 
      value: totalEquity > 0 ? (cashBalance / totalEquity) * 100 : 100, 
      color: '#64748B',
      amount: cashBalance
    },
  ].filter(a => a.value > 0);

  // Recent trades from history
  const recentTrades = tradeHistory.slice(0, 5);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Shield Tier Warning */}
      {shieldMsg && (
        <div className="mb-4 p-3 bg-gold/10 border border-gold/30 rounded-xl flex items-center gap-3">
          <Lock className="w-4 h-4 text-gold shrink-0" />
          <p className="text-sm text-gold">{shieldMsg}</p>
          <Link href="/dashboard/tier" className="ml-auto text-xs text-electric hover:underline whitespace-nowrap">Upgrade →</Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Portfolio</h1>
          <p className="text-slate-400 mt-1">Track your holdings and active positions</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Global Shield Toggle */}
          {positions.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg border border-white/5">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${globalShieldOn ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className="text-sm text-cream font-medium">Shield Mode</span>
              </div>
              <button
                onClick={() => globalShieldOn ? disableAllShields() : handleEnableAllShields()}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  globalShieldOn ? 'bg-blue-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    globalShieldOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
          {shieldSummary.activeShields > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400">
                {shieldSummary.activeShields} Shield{shieldSummary.activeShields > 1 ? 's' : ''} Active
              </span>
              <span className="text-xs text-blue-400/70">
                (${shieldSummary.totalShielded.toLocaleString()} protected)
              </span>
            </div>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-400 hover:text-cream transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-gradient-to-br from-gold/10 to-gold/5 rounded-2xl border border-gold/20"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Total Equity</p>
            <Wallet className="w-5 h-5 text-gold" />
          </div>
          <p className="text-3xl font-bold text-cream">
            ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-slate-500 mt-2">Cash + Crypto</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Portfolio Value</p>
            <Activity className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-cream">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-slate-500 mt-2">{positions.length} position{positions.length !== 1 ? 's' : ''}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Unrealized P&L</p>
            {(totalPnL + tradePnL) >= 0 ? (
              <TrendingUp className="w-5 h-5 text-profit" />
            ) : (
              <TrendingDown className="w-5 h-5 text-loss" />
            )}
          </div>
          <p className={`text-3xl font-bold ${(totalPnL + tradePnL) >= 0 ? 'text-profit' : 'text-loss'}`}>
            {(totalPnL + tradePnL) >= 0 ? '+' : ''}${(totalPnL + tradePnL).toFixed(2)}
          </p>
          <p className="text-sm text-slate-500 mt-2">{positions.length + openTrades.length} position{(positions.length + openTrades.length) !== 1 ? 's' : ''}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`p-5 rounded-2xl border ${
            shieldSummary.activeShields > 0 
              ? 'bg-blue-500/5 border-blue-500/20' 
              : 'bg-white/5 border-white/5'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Protected</p>
            <ShieldCheck className={`w-5 h-5 ${shieldSummary.activeShields > 0 ? 'text-blue-400' : 'text-slate-500'}`} />
          </div>
          <p className={`text-3xl font-bold ${shieldSummary.activeShields > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
            ${shieldSummary.totalShielded.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {shieldSummary.activeShields} shield{shieldSummary.activeShields !== 1 ? 's' : ''} active
          </p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Portfolio Allocation */}
        <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-cream">Your Holdings</h2>
              <Link
                href="/dashboard/trade/crypto"
                className="flex items-center gap-1 text-sm text-gold hover:text-gold/80 transition-colors"
              >
                Trade
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-semibold text-cream mb-2">No Holdings Yet</h3>
              <p className="text-slate-400 mb-4">Start building your crypto portfolio</p>
              <Link
                href="/dashboard/trade/crypto"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold rounded-lg hover:bg-gold/20 transition-all"
              >
                Buy Crypto
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Asset
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Avg Cost
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      P&L
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Shield
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {positions.map((position) => (
                    <PositionRow 
                      key={position.id} 
                      position={position}
                      onToggleShield={() => handleToggleShield(position.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">

          {/* Active FX/Stock Trades - compact */}
          {openTrades.length > 0 && (
            <div className="mb-6 pb-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-cream mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-electric" />
                Active Trades ({openTrades.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {openTrades.map((trade) => {
                  const pnl = trade.profit_loss || 0;
                  const isProfit = pnl >= 0;
                  return (
                    <div key={trade.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          trade.direction === 'buy' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
                        }`}>
                          {trade.direction}
                        </span>
                        <span className="text-sm font-medium text-cream">{trade.symbol}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{trade.market_type}</span>
                        {trade.leverage && <span className="text-[10px] text-slate-500">×{trade.leverage}</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${isProfit ? 'text-profit' : 'text-loss'}`}>
                          {isProfit ? '+' : ''}{pnl.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">${trade.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {tradePnL !== 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Unrealized P&L</span>
                  <span className={`text-xs font-semibold ${tradePnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {tradePnL >= 0 ? '+' : ''}${tradePnL.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <h2 className="text-lg font-semibold text-cream mb-4">Allocation</h2>
          
          {/* Simple pie chart representation */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {allocation.reduce((acc, item, i) => {
                const startOffset = acc.offset;
                const dashArray = item.value;
                acc.elements.push(
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="20"
                    strokeDasharray={`${dashArray} ${100 - dashArray}`}
                    strokeDashoffset={-startOffset}
                  />
                );
                acc.offset += item.value;
                return acc;
              }, { elements: [] as JSX.Element[], offset: 0 }).elements}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-cream">
                  ${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {allocation.map((item) => (
              <div key={item.asset} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-400">{item.asset}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-cream">{item.value.toFixed(1)}%</span>
                  <p className="text-xs text-slate-500">${item.amount.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Shield Summary */}
          {shieldSummary.activeShields > 0 && (
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Shield Summary</span>
              </div>
              <div className="space-y-2">
                {shieldSummary.positions.map((p) => (
                  <div key={p.symbol} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{p.symbol}</span>
                    <div className="text-right">
                      <span className="text-blue-400">${p.snapValue.toLocaleString()}</span>
                      <span className={`ml-2 ${p.priceChangePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {p.priceChangePercent >= 0 ? '↑' : '↓'}{Math.abs(p.priceChangePercent).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {recentTrades.length > 0 && (
        <div className="mt-6 bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-cream">Recent Activity</h2>
              <Link
                href="/dashboard/history"
                className="flex items-center gap-1 text-sm text-gold hover:text-gold/80 transition-colors"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    trade.side === 'buy' ? 'bg-profit/10' : 'bg-loss/10'
                  }`}>
                    {trade.side === 'buy' ? (
                      <ArrowUpRight className="w-4 h-4 text-profit" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-loss" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">
                      {trade.side === 'buy' ? 'Bought' : 'Sold'} {trade.symbol}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trade.quantity.toFixed(6)} @ ${trade.price.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-cream">
                    ${trade.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(trade.executedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="mt-6 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-400 mb-1">About Shield Mode</h3>
            <p className="text-sm text-blue-400/80">
              Shield Mode lets you lock your portfolio value at the current price. While active, 
              the live price continues to move, but your displayed value stays frozen. This is a 
              "synthetic pause" - use it to protect gains or wait out volatility. Toggle it on any 
              position from the Holdings table above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
