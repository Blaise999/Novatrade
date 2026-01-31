'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Bitcoin,
  Globe,
  Plus,
  ArrowDownLeft,
  Clock,
  Eye,
  EyeOff,
  Activity,
  ChevronRight,
  LineChart,
  PieChart,
  History,
  BookOpen,
  HelpCircle,
  Users
} from 'lucide-react';
import { useStore } from '@/lib/store-supabase';

// ============================================
// WORKING CHART COMPONENT
// ============================================
const PortfolioChart = ({ data, height = 200 }: { data: number[]; height?: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (data.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <LineChart className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No trading history yet</p>
          <p className="text-xs text-slate-600 mt-1">Start trading to see your chart</p>
        </div>
      </div>
    );
  }

  const padding = 16;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - minVal) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${padding + chartHeight} ${points} ${padding + chartWidth},${padding + chartHeight}`;
  const isPositive = data[data.length - 1] >= data[0];

  return (
    <div ref={containerRef} style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#chartGradient)" />
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#10B981' : '#EF4444'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// ============================================
// MINI SPARKLINE CHART
// ============================================
const SparklineChart = ({ data, positive }: { data: number[]; positive: boolean }) => {
  if (data.length < 2) return <div className="w-14 h-7 bg-white/5 rounded" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 56;
    const y = 24 - ((val - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 56 28" className="w-14 h-7">
      <polyline points={points} fill="none" stroke={positive ? '#10B981' : '#EF4444'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// ============================================
// QUICK ACTION BUTTON
// ============================================
const QuickAction = ({ href, icon: Icon, label, color }: { href: string; icon: any; label: string; color: string }) => (
  <Link href={href}>
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-1.5 p-2 sm:p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      <span className="text-[10px] sm:text-xs text-cream/70 text-center">{label}</span>
    </motion.div>
  </Link>
);

// ============================================
// MARKET ITEM
// ============================================
const MarketItem = ({ symbol, name, price, change, type }: { symbol: string; name: string; price: number; change: number; type: 'crypto' | 'forex' | 'stock' }) => {
  const href = type === 'crypto' ? '/dashboard/trade/crypto' : type === 'forex' ? '/dashboard/trade/fx' : '/dashboard/trade/stocks';
  const sparkData = Array.from({ length: 8 }, (_, i) => price + (change >= 0 ? i : -i) * 0.5 + (Math.random() - 0.5) * (price * 0.01));

  return (
    <Link href={href}>
      <motion.div whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl cursor-pointer">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${type === 'crypto' ? 'bg-orange-500/20' : type === 'forex' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
          {type === 'crypto' && <Bitcoin className="w-4 h-4 text-orange-500" />}
          {type === 'forex' && <Globe className="w-4 h-4 text-blue-500" />}
          {type === 'stock' && <BarChart3 className="w-4 h-4 text-green-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-cream truncate">{symbol}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden sm:block">{name}</p>
        </div>
        <div className="hidden md:block"><SparklineChart data={sparkData} positive={change >= 0} /></div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs sm:text-sm font-mono text-cream">${price < 1 ? price.toFixed(4) : price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className={`text-[10px] sm:text-xs font-medium ${change >= 0 ? 'text-profit' : 'text-loss'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</p>
        </div>
      </motion.div>
    </Link>
  );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ icon: Icon, title, description, action, actionHref }: { icon: any; title: string; description: string; action: string; actionHref: string }) => (
  <div className="text-center py-6 sm:py-8 px-4">
    <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-2 sm:mb-3" />
    <h3 className="text-sm sm:text-base text-cream font-medium mb-1">{title}</h3>
    <p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">{description}</p>
    <Link href={actionHref} className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-gold/10 text-gold text-xs sm:text-sm font-medium rounded-lg hover:bg-gold/20 transition-all">
      {action}<ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
    </Link>
  </div>
);

// ============================================
// MAIN DASHBOARD
// ============================================
export default function DashboardPage() {
  const { user, trades, deposits, loadTrades, loadDeposits, refreshUser, isAuthenticated } = useStore();
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        await Promise.all([loadTrades(), loadDeposits(), refreshUser()]);
      } catch (e) {
        console.error('Failed to load data:', e);
      }
      setIsLoading(false);
    };
    loadData();
  }, [isAuthenticated, loadTrades, loadDeposits, refreshUser]);

  // Calculate from REAL data only
  const balance = user?.balance || 0;
  const bonusBalance = user?.bonusBalance || 0;
  const totalBalance = balance + bonusBalance;
  const totalDeposited = user?.totalDeposited || 0;
  
  const openTrades = (trades || []).filter(t => t.status === 'open');
  const closedTrades = (trades || []).filter(t => t.status === 'closed');
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const unrealizedPnL = openTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const pendingDeposits = (deposits || []).filter(d => d.status === 'pending');

  // Portfolio history from REAL closed trades only
  const portfolioHistory = closedTrades.length > 0 
    ? closedTrades.map((_, i) => totalDeposited + closedTrades.slice(0, i + 1).reduce((s, x) => s + (x.pnl || 0), 0))
    : [];

  const markets = [
    { symbol: 'BTC/USD', name: 'Bitcoin', price: 67234.50, change: 2.45, type: 'crypto' as const },
    { symbol: 'ETH/USD', name: 'Ethereum', price: 3456.78, change: -1.23, type: 'crypto' as const },
    { symbol: 'EUR/USD', name: 'Euro', price: 1.0847, change: 0.15, type: 'forex' as const },
    { symbol: 'GBP/USD', name: 'Pound', price: 1.2634, change: -0.32, type: 'forex' as const },
    { symbol: 'AAPL', name: 'Apple', price: 178.45, change: 1.89, type: 'stock' as const },
    { symbol: 'TSLA', name: 'Tesla', price: 248.50, change: 3.21, type: 'stock' as const },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-3 sm:mb-4" />
          <p className="text-sm text-cream/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 pb-24 lg:pb-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-display font-bold text-cream">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
        <Link href="/dashboard/wallet" className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-gold to-gold/80 text-void text-xs sm:text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all">
          <Plus className="w-4 h-4" />Add Funds
        </Link>
      </div>

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-gold/20 via-gold/10 to-transparent rounded-xl sm:rounded-2xl border border-gold/20">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm text-slate-400">Total Balance</p>
          <button onClick={() => setShowBalance(!showBalance)} className="p-1 sm:p-1.5 text-slate-400 hover:text-cream rounded-lg hover:bg-white/5">
            {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-cream mb-2 sm:mb-3">
          {showBalance ? `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
        </p>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Available', value: balance, color: 'text-cream' },
            { label: 'Deposited', value: totalDeposited, color: 'text-cream' },
            { label: 'Realized P&L', value: totalPnL, color: totalPnL >= 0 ? 'text-profit' : 'text-loss', prefix: totalPnL >= 0 ? '+' : '' },
            { label: 'Unrealized', value: unrealizedPnL, color: unrealizedPnL >= 0 ? 'text-profit' : 'text-loss', prefix: unrealizedPnL >= 0 ? '+' : '' },
          ].map((item) => (
            <div key={item.label} className="p-2 sm:p-2.5 bg-white/5 rounded-lg">
              <p className="text-[10px] sm:text-xs text-slate-500">{item.label}</p>
              <p className={`text-xs sm:text-sm font-medium ${item.color}`}>
                {showBalance ? `${item.prefix || ''}$${Math.abs(item.value).toFixed(2)}` : '••••'}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Pending Deposits Alert */}
      {pendingDeposits.length > 0 && (
        <div className="p-2.5 sm:p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-2 sm:gap-3">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-yellow-500 font-medium flex-1">
            {pendingDeposits.length} pending deposit{pendingDeposits.length > 1 ? 's' : ''}
          </p>
          <Link href="/dashboard/wallet" className="text-xs text-yellow-500 hover:underline">View</Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2 lg:gap-3">
        <QuickAction href="/dashboard/trade/crypto" icon={Bitcoin} label="Crypto" color="bg-orange-500" />
        <QuickAction href="/dashboard/trade/fx" icon={Globe} label="Forex" color="bg-blue-500" />
        <QuickAction href="/dashboard/trade/stocks" icon={BarChart3} label="Stocks" color="bg-green-500" />
        <QuickAction href="/dashboard/wallet" icon={Wallet} label="Deposit" color="bg-gold" />
        <QuickAction href="/dashboard/copy-trading" icon={Users} label="Copy" color="bg-purple-500" />
        <QuickAction href="/dashboard/portfolio" icon={PieChart} label="Portfolio" color="bg-pink-500" />
        <QuickAction href="/dashboard/history" icon={History} label="History" color="bg-slate-500" />
        <QuickAction href="/academy" icon={BookOpen} label="Learn" color="bg-electric" />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Portfolio Chart */}
        <div className="lg:col-span-2 bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-cream">Portfolio</h2>
            <Link href="/dashboard/history" className="text-[10px] sm:text-xs text-gold hover:underline">View History</Link>
          </div>
          <div className="h-36 sm:h-44 lg:h-52">
            <PortfolioChart data={portfolioHistory} height={typeof window !== 'undefined' ? (window.innerWidth < 640 ? 144 : window.innerWidth < 1024 ? 176 : 208) : 176} />
          </div>
        </div>

        {/* Open Positions */}
        <div className="bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-cream">Open Positions</h2>
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/10 rounded-full text-cream/60">{openTrades.length}</span>
          </div>
          
          {openTrades.length === 0 ? (
            <EmptyState icon={Activity} title="No open trades" description="Start trading to see positions" action="Open Trade" actionHref="/dashboard/trade/crypto" />
          ) : (
            <div className="space-y-2 max-h-48 sm:max-h-56 lg:max-h-64 overflow-y-auto">
              {openTrades.slice(0, 5).map((trade) => (
                <div key={trade.id} className="p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs sm:text-sm font-medium text-cream">{trade.pair}</span>
                    <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded ${trade.side === 'long' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-slate-500">${trade.amount.toFixed(2)}</span>
                    <span className={trade.pnl >= 0 ? 'text-profit' : 'text-loss'}>{trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Markets */}
      <div className="bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-cream">Markets</h2>
          <Link href="/markets" className="text-[10px] sm:text-xs text-gold hover:underline flex items-center gap-1">View All<ChevronRight className="w-3 h-3" /></Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0.5 sm:gap-1">
          {markets.map((m) => <MarketItem key={m.symbol} {...m} />)}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-cream">Recent Activity</h2>
          <Link href="/dashboard/history" className="text-[10px] sm:text-xs text-gold hover:underline">View All</Link>
        </div>

        {closedTrades.length === 0 && (deposits || []).length === 0 ? (
          <EmptyState icon={History} title="No activity yet" description="Your history will appear here" action="Make First Deposit" actionHref="/dashboard/wallet" />
        ) : (
          <div className="space-y-1.5 sm:space-y-2">
            {[...(deposits || []).slice(0, 3), ...closedTrades.slice(0, 3)]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 5)
              .map((item, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl">
                  {'orderId' in item ? (
                    <>
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-profit/20 flex items-center justify-center flex-shrink-0">
                        <ArrowDownLeft className="w-3 h-3 sm:w-4 sm:h-4 text-profit" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-cream">Deposit</p>
                        <p className="text-[10px] sm:text-xs text-slate-500 truncate">{item.methodName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs sm:text-sm text-profit">+${item.amount.toFixed(2)}</p>
                        <p className={`text-[10px] sm:text-xs ${item.status === 'confirmed' ? 'text-profit' : item.status === 'pending' ? 'text-yellow-500' : 'text-loss'}`}>{item.status}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.pnl >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
                        {item.pnl >= 0 ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-profit" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-loss" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-cream">{item.pair}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500">{item.side} · Closed</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs sm:text-sm ${item.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Help Card */}
      <div className="bg-gradient-to-r from-electric/10 to-purple-500/10 rounded-xl sm:rounded-2xl border border-electric/20 p-3 sm:p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-electric/20 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-electric" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-cream">Need Help?</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Visit Academy to learn trading basics</p>
          </div>
          <div className="flex gap-2">
            <Link href="/academy" className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-electric text-void text-xs sm:text-sm font-medium rounded-lg text-center hover:bg-electric/90">Academy</Link>
            <Link href="/dashboard/help" className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 text-cream text-xs sm:text-sm font-medium rounded-lg text-center hover:bg-white/20">Support</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
