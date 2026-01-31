'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Clock,
  DollarSign,
  Plus,
  Minus,
  Search,
  Star,
  StarOff,
  CheckCircle,
  AlertCircle,
  CandlestickChart,
  LineChart as LineChartIcon,
  Building2,
  X,
  Activity,
  Wallet
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useTradingAccountStore } from '@/lib/trading-store';
import { marketAssets } from '@/lib/data';
import { StockPosition } from '@/lib/trading-types';

// Filter stock assets
const stockAssets = marketAssets.filter(a => a.type === 'stock');

// Stock company info with icons
const stockInfo: Record<string, { emoji: string; color: string; sector: string }> = {
  'AAPL': { emoji: '🍎', color: 'from-gray-400 to-gray-500', sector: 'Technology' },
  'NVDA': { emoji: '🟢', color: 'from-green-500 to-green-600', sector: 'Technology' },
  'TSLA': { emoji: '⚡', color: 'from-red-500 to-red-600', sector: 'Automotive' },
  'MSFT': { emoji: '🪟', color: 'from-blue-500 to-blue-600', sector: 'Technology' },
  'GOOGL': { emoji: '🔍', color: 'from-yellow-500 to-red-500', sector: 'Technology' },
  'AMZN': { emoji: '📦', color: 'from-orange-500 to-orange-600', sector: 'Consumer' },
  'META': { emoji: '👤', color: 'from-blue-600 to-blue-700', sector: 'Technology' },
};

// Chart timeframes
const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D'];

// Mobile tabs
type MobileTab = 'chart' | 'trade' | 'portfolio';

export default function StockTradingPage() {
  const { user } = useAuthStore();
  const { 
    spotAccount, 
    stockPositions, 
    executeStockBuy, 
    executeStockSell, 
    updateStockPositionPrice 
  } = useTradingAccountStore();
  
  // Stocks are FREE for all users - no tier restrictions
  
  // State
  const [selectedAsset, setSelectedAsset] = useState(stockAssets[0]);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['AAPL', 'NVDA', 'TSLA']);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartTimeframe, setChartTimeframe] = useState('15m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  
  // Trading state
  const [orderMode, setOrderMode] = useState<'shares' | 'dollars'>('shares');
  const [shareQty, setShareQty] = useState(1);
  const [dollarAmount, setDollarAmount] = useState(100);
  
  // Price state
  const [currentPrice, setCurrentPrice] = useState(selectedAsset.price);
  const [bidPrice, setBidPrice] = useState(selectedAsset.price * 0.9999);
  const [askPrice, setAskPrice] = useState(selectedAsset.price * 1.0001);
  
  // UI state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [positionToSell, setPositionToSell] = useState<StockPosition | null>(null);
  const [sellQty, setSellQty] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  
  // Chart ref and dimensions for responsive chart
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 300, height: 250 });
  
  // Stocks are free for ALL users - no restrictions
  const canTrade = true;
  
  // Filter assets
  const filteredAssets = stockAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Update prices effect
  useEffect(() => {
    const interval = setInterval(() => {
      const basePrice = selectedAsset.price;
      const volatility = 0.002;
      const change = (Math.random() - 0.5) * basePrice * volatility;
      const newPrice = Math.max(0.01, currentPrice + change);
      
      setCurrentPrice(newPrice);
      setBidPrice(newPrice * 0.9999);
      setAskPrice(newPrice * 1.0001);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [selectedAsset, currentPrice]);

  // Update position prices
  useEffect(() => {
    stockPositions.forEach(pos => {
      if (pos.symbol === selectedAsset.symbol) {
        updateStockPositionPrice(pos.symbol, currentPrice);
      }
    });
  }, [currentPrice, stockPositions, selectedAsset.symbol, updateStockPositionPrice]);

  // Update chart dimensions with ResizeObserver for better mobile support
  useEffect(() => {
    const updateDimensions = () => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        const width = Math.max(rect.width || 300, 280);
        const height = Math.max(rect.height || 250, 200);
        setChartDimensions({ width, height });
      }
    };

    updateDimensions();
    const initialTimeout = setTimeout(updateDimensions, 100);
    const secondTimeout = setTimeout(updateDimensions, 300);

    let resizeObserver: ResizeObserver | null = null;
    if (chartRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setChartDimensions({
            width: Math.max(width || 300, 280),
            height: Math.max(height || 250, 200),
          });
        }
      });
      resizeObserver.observe(chartRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [mobileTab]);

  // Calculate order values
  const effectiveShares = orderMode === 'shares' 
    ? shareQty 
    : Math.floor(dollarAmount / askPrice);
  const orderValue = effectiveShares * askPrice;
  const commission = Math.max(0.99, orderValue * 0.001);
  const totalCost = orderValue + commission;

  // Account values
  const cashBalance = spotAccount?.balance || 10000;
  const portfolioValue = stockPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
  const totalEquity = cashBalance + portfolioValue;
  const unrealizedPnL = stockPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);

  // Market status
  const getMarketStatus = () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    
    if (day === 0 || day === 6) return { status: 'Closed', color: 'text-loss' };
    if (hour >= 14 && hour < 21) return { status: 'Open', color: 'text-profit' };
    if (hour >= 9 && hour < 14) return { status: 'Pre-Market', color: 'text-gold' };
    if (hour >= 21 && hour < 25) return { status: 'After Hours', color: 'text-electric' };
    return { status: 'Closed', color: 'text-loss' };
  };
  const marketStatus = getMarketStatus();

  // Handle buy
  const handleBuy = () => {
    if (!canTrade) {
      setNotification({ type: 'error', message: 'Upgrade your membership to trade' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    if (totalCost > cashBalance) {
      setNotification({ type: 'error', message: 'Insufficient funds' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    const result = executeStockBuy(
      selectedAsset.symbol,
      selectedAsset.name,
      effectiveShares,
      askPrice,
      commission
    );
    
    if (result.success) {
      setNotification({ 
        type: 'success', 
        message: `Bought ${effectiveShares} ${selectedAsset.symbol} @ $${askPrice.toFixed(2)}` 
      });
    } else {
      setNotification({ type: 'error', message: result.error || 'Trade failed' });
    }
    
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle sell
  const handleSell = () => {
    if (!positionToSell || sellQty <= 0) return;
    
    const sellCommission = Math.max(0.99, (sellQty * bidPrice) * 0.001);
    const result = executeStockSell(positionToSell.id, sellQty, bidPrice, sellCommission);
    
    if (result.success) {
      const pnl = result.realizedPnL || 0;
      setNotification({ 
        type: 'success', 
        message: `Sold ${sellQty} ${positionToSell.symbol} for ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` 
      });
    } else {
      setNotification({ type: 'error', message: result.error || 'Sell failed' });
    }
    
    setShowSellModal(false);
    setPositionToSell(null);
    setSellQty(0);
    setTimeout(() => setNotification(null), 3000);
  };

  // Toggle favorite
  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const info = stockInfo[selectedAsset.symbol] || { emoji: '📈', color: 'from-gray-500 to-gray-600', sector: 'Other' };

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] flex flex-col bg-void overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-b border-white/10 bg-obsidian">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Asset Selector */}
          <button
            onClick={() => setShowAssetSelector(true)}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors min-w-0"
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-lg sm:text-xl">{info.emoji}</span>
              <div className="text-left">
                <p className="text-sm sm:text-base font-semibold text-cream truncate">{selectedAsset.symbol}</p>
                <p className="text-xs text-cream/50 hidden sm:block">{selectedAsset.name}</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-cream/50 flex-shrink-0" />
          </button>
          
          {/* Price Display */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-mono font-bold text-cream">${currentPrice.toFixed(2)}</p>
              <p className={`text-xs ${selectedAsset.changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                {selectedAsset.changePercent >= 0 ? '+' : ''}{selectedAsset.changePercent.toFixed(2)}%
              </p>
            </div>
          </div>
          
          {/* Market Status */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            marketStatus.status === 'Open' ? 'bg-profit/10' : 'bg-white/5'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              marketStatus.status === 'Open' ? 'bg-profit animate-pulse' : 'bg-slate-500'
            }`} />
            <span className={`text-sm font-medium ${marketStatus.color}`}>{marketStatus.status}</span>
          </div>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden flex-shrink-0 flex border-b border-white/10 bg-obsidian">
        {(['chart', 'trade', 'portfolio'] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileTab === tab 
                ? 'text-gold border-b-2 border-gold bg-gold/5' 
                : 'text-cream/50'
            }`}
          >
            {tab === 'chart' && 'Chart'}
            {tab === 'trade' && 'Trade'}
            {tab === 'portfolio' && `Portfolio (${stockPositions.length})`}
          </button>
        ))}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Chart Section */}
        <div className={`${mobileTab === 'chart' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-h-0 h-full`}>
          {/* Chart Controls */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10 bg-charcoal/50">
            <div className="flex items-center gap-1 overflow-x-auto">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    chartTimeframe === tf 
                      ? 'bg-gold text-void' 
                      : 'text-cream/50 hover:text-cream hover:bg-white/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartType('candle')}
                className={`p-1.5 rounded-lg ${chartType === 'candle' ? 'bg-white/10 text-cream' : 'text-cream/40'}`}
              >
                <CandlestickChart className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-lg ${chartType === 'line' ? 'bg-white/10 text-cream' : 'text-cream/40'}`}
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Chart Area - RESPONSIVE */}
          <div 
            ref={chartRef} 
            className="flex-1 relative bg-charcoal/30 w-full overflow-hidden"
            style={{ minHeight: '250px', height: 'calc(100% - 48px)' }}
          >
            <svg 
              className="w-full h-full block" 
              viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`} 
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block' }}
            >
              <defs>
                <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={selectedAsset.changePercent >= 0 ? 'rgb(0, 217, 165)' : 'rgb(239, 68, 68)'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={selectedAsset.changePercent >= 0 ? 'rgb(0, 217, 165)' : 'rgb(239, 68, 68)'} stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Grid - Responsive */}
              {[...Array(10)].map((_, i) => (
                <line key={`h-${i}`} x1="0" y1={i * (chartDimensions.height / 10)} x2={chartDimensions.width} y2={i * (chartDimensions.height / 10)} stroke="rgba(255,255,255,0.05)" />
              ))}
              {[...Array(20)].map((_, i) => (
                <line key={`v-${i}`} x1={i * (chartDimensions.width / 20)} y1="0" x2={i * (chartDimensions.width / 20)} y2={chartDimensions.height} stroke="rgba(255,255,255,0.05)" />
              ))}
              
              {/* Candlesticks - Responsive */}
              {chartType === 'candle' && (() => {
                const isMobile = chartDimensions.width < 400;
                const numCandles = isMobile ? 25 : 40;
                const padding = { left: isMobile ? 10 : 20, right: isMobile ? 50 : 70 };
                const chartWidth = chartDimensions.width - padding.left - padding.right;
                const candleSpacing = chartWidth / numCandles;
                const candleWidth = Math.max(candleSpacing * 0.6, isMobile ? 4 : 6);
                const chartMidY = chartDimensions.height / 2;
                const amplitude = chartDimensions.height * 0.15;
                
                return [...Array(numCandles)].map((_, i) => {
                  const x = padding.left + i * candleSpacing + candleSpacing / 2;
                  const baseY = chartMidY + Math.sin(i * 0.2) * amplitude + (Math.random() - 0.5) * (amplitude * 0.5);
                  const height = 10 + Math.random() * 20;
                  const isGreen = Math.random() > 0.45;
                  
                  return (
                    <g key={i}>
                      <line x1={x} y1={baseY - height/2 - 6} x2={x} y2={baseY + height/2 + 6} stroke={isGreen ? '#00d9a5' : '#ef4444'} strokeWidth="1" />
                      <rect 
                        x={x - candleWidth/2} 
                        y={baseY - height/2} 
                        width={candleWidth} 
                        height={height}
                        fill={isGreen ? '#00d9a5' : '#ef4444'}
                        rx="1"
                      />
                    </g>
                  );
                });
              })()}
              
              {/* Line chart - Responsive */}
              {chartType === 'line' && (() => {
                const isMobile = chartDimensions.width < 400;
                const numPoints = isMobile ? 25 : 40;
                const padding = { left: isMobile ? 10 : 20, right: isMobile ? 50 : 70 };
                const chartWidth = chartDimensions.width - padding.left - padding.right;
                const pointSpacing = chartWidth / numPoints;
                const chartMidY = chartDimensions.height / 2;
                const amplitude = chartDimensions.height * 0.15;
                
                const points = [...Array(numPoints)].map((_, i) => ({
                  x: padding.left + i * pointSpacing,
                  y: chartMidY + Math.sin(i * 0.2) * amplitude
                }));
                
                return (
                  <>
                    <path
                      d={`M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`}
                      fill="none"
                      stroke={selectedAsset.changePercent >= 0 ? '#00d9a5' : '#ef4444'}
                      strokeWidth="2"
                    />
                    <path
                      d={`M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')} L ${points[points.length-1].x} ${chartDimensions.height} L ${points[0].x} ${chartDimensions.height} Z`}
                      fill="url(#stockGradient)"
                    />
                  </>
                );
              })()}
              
              {/* Current price line - Responsive */}
              <line x1="0" y1={chartDimensions.height / 2} x2={chartDimensions.width} y2={chartDimensions.height / 2} stroke="#d4af37" strokeDasharray="4" />
              <rect x={chartDimensions.width - 65} y={chartDimensions.height / 2 - 10} width="60" height="20" fill="#d4af37" rx="3" />
              <text x={chartDimensions.width - 35} y={chartDimensions.height / 2 + 4} textAnchor="middle" fill="#0a0a0f" fontSize="10" fontFamily="monospace">
                ${currentPrice.toFixed(2)}
              </text>
            </svg>
          </div>
        </div>
        
        {/* Trading Panel */}
        <div className={`${mobileTab === 'trade' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 xl:w-96 border-l border-white/10 bg-obsidian overflow-y-auto`}>
          {/* Stocks are FREE for all users! */}
          
          {/* Account Summary */}
          <div className="p-3 border-b border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white/5 rounded-lg">
                <p className="text-xs text-cream/50">Cash</p>
                <p className="text-sm font-semibold text-cream">${cashBalance.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <p className="text-xs text-cream/50">Portfolio</p>
                <p className="text-sm font-semibold text-profit">${portfolioValue.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <p className="text-xs text-cream/50">Total</p>
                <p className="text-sm font-semibold text-cream">${totalEquity.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <p className="text-xs text-cream/50">P&L</p>
                <p className={`text-sm font-semibold ${unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Order Mode Toggle */}
          <div className="p-3 border-b border-white/10">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setOrderMode('shares')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  orderMode === 'shares'
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/50 hover:bg-white/10'
                }`}
              >
                Shares
              </button>
              <button
                onClick={() => setOrderMode('dollars')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  orderMode === 'dollars'
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/50 hover:bg-white/10'
                }`}
              >
                Dollars
              </button>
            </div>
            
            {/* Quantity Input */}
            {orderMode === 'shares' ? (
              <div>
                <label className="text-xs text-cream/50 mb-2 block">Number of Shares</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShareQty(Math.max(1, shareQty - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10"
                  >
                    <Minus className="w-4 h-4 text-cream" />
                  </button>
                  <input
                    type="number"
                    value={shareQty}
                    onChange={(e) => setShareQty(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="flex-1 h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-center text-cream font-mono focus:outline-none focus:border-gold"
                  />
                  <button
                    onClick={() => setShareQty(shareQty + 1)}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10"
                  >
                    <Plus className="w-4 h-4 text-cream" />
                  </button>
                </div>
                <div className="flex gap-1 mt-2">
                  {[1, 5, 10, 25, 50].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setShareQty(qty)}
                      className={`flex-1 py-1 text-xs rounded-lg ${
                        shareQty === qty ? 'bg-gold text-void' : 'bg-white/5 text-cream/50'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-cream/50 mb-2 block">Dollar Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50">$</span>
                  <input
                    type="number"
                    value={dollarAmount}
                    onChange={(e) => setDollarAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                    min="1"
                    className="w-full h-10 pl-7 pr-3 bg-white/5 border border-white/10 rounded-lg text-cream font-mono focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  {[50, 100, 250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setDollarAmount(amt)}
                      className={`flex-1 py-1 text-xs rounded-lg ${
                        dollarAmount === amt ? 'bg-gold text-void' : 'bg-white/5 text-cream/50'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-cream/40 mt-2">
                  ≈ {effectiveShares} shares @ ${askPrice.toFixed(2)}
                </p>
              </div>
            )}
          </div>
          
          {/* Order Summary */}
          <div className="p-3 space-y-4">
            <div className="p-3 bg-white/5 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-cream/50">Shares</span>
                <span className="text-cream">{effectiveShares}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-cream/50">Price</span>
                <span className="text-cream font-mono">${askPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-cream/50">Order Value</span>
                <span className="text-cream">${orderValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-cream/50">Commission</span>
                <span className="text-cream">${commission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                <span className="text-cream font-medium">Total</span>
                <span className="text-gold font-bold">${totalCost.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Buy Button */}
            <button
              onClick={handleBuy}
              disabled={!canTrade || totalCost > cashBalance}
              className="w-full py-4 rounded-xl font-bold text-lg bg-profit text-void hover:bg-profit/90 transition-all disabled:opacity-50"
            >
              Buy {effectiveShares} {effectiveShares === 1 ? 'Share' : 'Shares'}
            </button>
            
            {totalCost > cashBalance && (
              <div className="p-2 bg-loss/10 rounded-lg border border-loss/20 mt-2">
                <p className="text-xs text-loss text-center mb-1">
                  Insufficient funds. Need ${(totalCost - cashBalance).toFixed(2)} more.
                </p>
                <Link
                  href="/dashboard/wallet"
                  className="flex items-center justify-center gap-1 text-xs text-gold hover:text-gold/80 font-medium"
                >
                  <Wallet className="w-3 h-3" />
                  Deposit Funds
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {/* Portfolio Panel - Mobile */}
        <div className={`${mobileTab === 'portfolio' ? 'flex' : 'hidden'} lg:hidden flex-col flex-1 overflow-y-auto bg-obsidian`}>
          <div className="p-3">
            <h3 className="text-sm font-semibold text-cream mb-3">Your Holdings ({stockPositions.length})</h3>
            
            {stockPositions.length === 0 ? (
              <div className="text-center py-8 text-cream/50">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No holdings yet</p>
                <p className="text-xs mt-1">Buy stocks to start building your portfolio</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stockPositions.map((pos) => {
                  const posInfo = stockInfo[pos.symbol] || { emoji: '📈', color: 'from-gray-500 to-gray-600', sector: 'Other' };
                  return (
                    <div key={pos.id} className="p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{posInfo.emoji}</span>
                          <span className="font-semibold text-cream">{pos.symbol}</span>
                        </div>
                        <span className={`font-semibold ${pos.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                        <div>
                          <p className="text-cream/50">Shares</p>
                          <p className="text-cream">{pos.qty}</p>
                        </div>
                        <div>
                          <p className="text-cream/50">Avg Cost</p>
                          <p className="text-cream font-mono">${pos.avgCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-cream/50">Value</p>
                          <p className="text-cream">${pos.marketValue.toFixed(2)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPositionToSell(pos);
                          setSellQty(pos.qty);
                          setShowSellModal(true);
                        }}
                        className="w-full py-2 bg-loss/20 text-loss text-sm font-medium rounded-lg hover:bg-loss/30 transition-colors"
                      >
                        Sell
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Desktop Portfolio Panel */}
      <div className="hidden lg:block flex-shrink-0 h-48 border-t border-white/10 bg-obsidian overflow-y-auto">
        <div className="p-3">
          <h3 className="text-sm font-semibold text-cream mb-3">Holdings ({stockPositions.length})</h3>
          
          {stockPositions.length === 0 ? (
            <div className="text-center py-4 text-cream/50">
              <p className="text-sm">No holdings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-cream/50 text-xs">
                    <th className="text-left pb-2">Symbol</th>
                    <th className="text-right pb-2">Shares</th>
                    <th className="text-right pb-2">Avg Cost</th>
                    <th className="text-right pb-2">Current</th>
                    <th className="text-right pb-2">Value</th>
                    <th className="text-right pb-2">P&L</th>
                    <th className="text-right pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stockPositions.map((pos) => (
                    <tr key={pos.id} className="border-t border-white/5">
                      <td className="py-2 text-cream font-medium">{pos.symbol}</td>
                      <td className="py-2 text-right text-cream">{pos.qty}</td>
                      <td className="py-2 text-right font-mono text-cream">${pos.avgCost.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-cream">${pos.currentPrice.toFixed(2)}</td>
                      <td className="py-2 text-right text-cream">${pos.marketValue.toFixed(2)}</td>
                      <td className={`py-2 text-right font-semibold ${pos.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => {
                            setPositionToSell(pos);
                            setSellQty(pos.qty);
                            setShowSellModal(true);
                          }}
                          className="px-3 py-1 bg-loss/20 text-loss text-xs font-medium rounded hover:bg-loss/30"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Asset Selector Modal */}
      <AnimatePresence>
        {showAssetSelector && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAssetSelector(false)}
              className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-obsidian rounded-2xl border border-white/10 z-50 flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-cream">Select Stock</h3>
                  <button onClick={() => setShowAssetSelector(false)}>
                    <X className="w-5 h-5 text-cream/50" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
                  <input
                    type="text"
                    placeholder="Search stocks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {/* Favorites */}
                {favorites.length > 0 && (
                  <div className="mb-4">
                    <p className="px-2 py-1 text-xs text-gold font-medium">⭐ Watchlist</p>
                    {filteredAssets.filter(a => favorites.includes(a.symbol)).map((asset) => {
                      const assetInfo = stockInfo[asset.symbol] || { emoji: '📈', color: 'from-gray-500 to-gray-600', sector: 'Other' };
                      return (
                        <button
                          key={asset.symbol}
                          onClick={() => {
                            setSelectedAsset(asset);
                            setCurrentPrice(asset.price);
                            setShowAssetSelector(false);
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{assetInfo.emoji}</span>
                            <div className="text-left">
                              <p className="font-medium text-cream">{asset.symbol}</p>
                              <p className="text-xs text-cream/50">{asset.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="font-mono text-cream">${asset.price.toFixed(2)}</p>
                              <p className={`text-xs ${asset.changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.symbol); }}
                              className="p-1"
                            >
                              <Star className="w-4 h-4 text-gold fill-gold" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* All Stocks */}
                <p className="px-2 py-1 text-xs text-cream/50 font-medium">All Stocks</p>
                {filteredAssets.filter(a => !favorites.includes(a.symbol)).map((asset) => {
                  const assetInfo = stockInfo[asset.symbol] || { emoji: '📈', color: 'from-gray-500 to-gray-600', sector: 'Other' };
                  return (
                    <button
                      key={asset.symbol}
                      onClick={() => {
                        setSelectedAsset(asset);
                        setCurrentPrice(asset.price);
                        setShowAssetSelector(false);
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{assetInfo.emoji}</span>
                        <div className="text-left">
                          <p className="font-medium text-cream">{asset.symbol}</p>
                          <p className="text-xs text-cream/50">{asset.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-mono text-cream">${asset.price.toFixed(2)}</p>
                          <p className={`text-xs ${asset.changePercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.symbol); }}
                          className="p-1"
                        >
                          <StarOff className="w-4 h-4 text-cream/30 hover:text-gold" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Sell Modal */}
      <AnimatePresence>
        {showSellModal && positionToSell && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSellModal(false)}
              className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm bg-obsidian rounded-2xl p-4 sm:p-6 border border-gold/20 z-50"
            >
              <h3 className="text-xl font-semibold text-cream mb-4">Sell {positionToSell.symbol}</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm text-cream/50 mb-2 block">Shares to Sell</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                      className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg"
                    >
                      <Minus className="w-4 h-4 text-cream" />
                    </button>
                    <input
                      type="number"
                      value={sellQty}
                      onChange={(e) => setSellQty(Math.min(positionToSell.qty, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="flex-1 h-10 bg-white/5 border border-white/10 rounded-lg text-center text-cream font-mono focus:outline-none focus:border-gold"
                    />
                    <button
                      onClick={() => setSellQty(Math.min(positionToSell.qty, sellQty + 1))}
                      className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg"
                    >
                      <Plus className="w-4 h-4 text-cream" />
                    </button>
                  </div>
                  <button
                    onClick={() => setSellQty(positionToSell.qty)}
                    className="w-full mt-2 py-1 text-xs text-gold bg-gold/10 rounded-lg"
                  >
                    Sell All ({positionToSell.qty} shares)
                  </button>
                </div>
                
                <div className="p-3 bg-white/5 rounded-xl space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cream/50">Avg Cost</span>
                    <span className="text-cream font-mono">${positionToSell.avgCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream/50">Current Price</span>
                    <span className="text-cream font-mono">${bidPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-cream/50">Est. P&L</span>
                    <span className={`font-semibold ${
                      (bidPrice - positionToSell.avgCost) * sellQty >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {(bidPrice - positionToSell.avgCost) * sellQty >= 0 ? '+' : ''}
                      ${((bidPrice - positionToSell.avgCost) * sellQty).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSellModal(false)}
                  className="flex-1 py-3 bg-white/5 text-cream rounded-xl hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSell}
                  className="flex-1 py-3 bg-loss text-white font-semibold rounded-xl hover:bg-loss/90"
                >
                  Sell {sellQty} Shares
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 ${
              notification.type === 'success' ? 'bg-profit text-void' : 'bg-loss text-white'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium text-sm sm:text-base">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
