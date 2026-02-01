'use client';

/**
 * TradingView Chart Component
 * 
 * Uses the TradingView Charting Library with our custom Binance datafeed.
 * Supports both live trading and educational mode.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createBinanceDatafeed, EducationalPriceGenerator, EduScenario } from '@/lib/services/tradingview-datafeed';

// ==========================================
// TYPES
// ==========================================

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  height?: number | string;
  autosize?: boolean;
  isEducational?: boolean;
  eduScenario?: EduScenario;
  eduBasePrice?: number;
  onPriceUpdate?: (price: number) => void;
  onChartReady?: () => void;
}

// ==========================================
// LIGHTWEIGHT FALLBACK CHART
// ==========================================
// For when TradingView is not available, we use a custom chart

const FallbackChart: React.FC<{
  symbol: string;
  height: number | string;
  priceData: { time: number; price: number }[];
  currentPrice: number;
  priceChange: number;
}> = ({ symbol, height, priceData, currentPrice, priceChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceData.length < 2) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const width = rect.width;
    const canvasHeight = rect.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = canvasHeight - padding * 2;
    
    // Find min/max
    const prices = priceData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, canvasHeight);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      // Price label
      const price = max - (range / 4) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), padding - 5, y + 3);
    }
    
    // Draw line chart
    const isPositive = priceChange >= 0;
    const color = isPositive ? '#10B981' : '#EF4444';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    priceData.forEach((d, i) => {
      const x = padding + (i / (priceData.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((d.price - min) / range) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
    gradient.addColorStop(0, isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, isPositive ? 'rgba(16, 185, 129, 0)' : 'rgba(239, 68, 68, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);
    priceData.forEach((d, i) => {
      const x = padding + (i / (priceData.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((d.price - min) / range) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width - padding, padding + chartHeight);
    ctx.closePath();
    ctx.fill();
    
    // Current price indicator
    const lastY = padding + chartHeight - ((currentPrice - min) / range) * chartHeight;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(width - padding, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Price label
    ctx.fillStyle = color;
    ctx.fillRect(width - padding + 5, lastY - 10, 70, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`$${currentPrice.toLocaleString()}`, width - padding + 10, lastY + 4);
    
  }, [priceData, currentPrice, priceChange]);
  
  return (
    <div className="relative w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      
      {/* Symbol Badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="text-lg font-bold text-cream">{symbol}</span>
        <span className={`text-sm font-medium px-2 py-0.5 rounded ${
          priceChange >= 0 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
        }`}>
          {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  interval = '1',
  theme = 'dark',
  height = 400,
  autosize = true,
  isEducational = false,
  eduScenario,
  eduBasePrice,
  onPriceUpdate,
  onChartReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const datafeedRef = useRef<any>(null);
  const eduGeneratorRef = useRef<EducationalPriceGenerator | null>(null);
  
  const [useFallback, setUseFallback] = useState(true);
  const [priceData, setPriceData] = useState<{ time: number; price: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  
  // Initialize educational generator if needed
  useEffect(() => {
    if (isEducational && eduScenario && eduBasePrice) {
      if (!eduGeneratorRef.current) {
        eduGeneratorRef.current = new EducationalPriceGenerator();
      }
      eduGeneratorRef.current.setScenario(eduScenario, eduBasePrice);
    }
    
    return () => {
      if (eduGeneratorRef.current) {
        eduGeneratorRef.current.stop();
      }
    };
  }, [isEducational, eduScenario, eduBasePrice]);
  
  // Fetch initial data and subscribe to updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    const loadData = async () => {
      try {
        // Dynamically import binance service to avoid SSR issues
        const { binanceService } = await import('@/lib/services/binance');
        
        // Fetch historical data
        const klines = await binanceService.getKlines(symbol, '1m', 100);
        
        if (klines.length > 0) {
          const data = klines.map(k => ({
            time: k.time,
            price: k.close,
          }));
          
          setPriceData(data);
          
          const latest = klines[klines.length - 1];
          const first = klines[0];
          const change = ((latest.close - first.close) / first.close) * 100;
          
          setCurrentPrice(latest.close);
          setPriceChange(change);
          
          if (onPriceUpdate) {
            onPriceUpdate(latest.close);
          }
        }
        
        // Subscribe to live updates
        unsubscribe = binanceService.subscribeToTicker(symbol, (ticker) => {
          setCurrentPrice(ticker.price);
          setPriceChange(ticker.priceChangePercent);
          
          setPriceData(prev => {
            const newData = [...prev, { time: ticker.lastUpdate, price: ticker.price }];
            return newData.slice(-100);
          });
          
          if (onPriceUpdate) {
            onPriceUpdate(ticker.price);
          }
        });
      } catch (error) {
        console.error('Error loading chart data:', error);
      }
    };
    
    loadData();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [symbol, onPriceUpdate]);
  
  // Try to load TradingView library
  useEffect(() => {
    // Check if TradingView is available
    if (typeof window !== 'undefined' && (window as any).TradingView) {
      setUseFallback(false);
    }
    
    // Also try to load from CDN
    const loadTradingView = async () => {
      if ((window as any).TradingView) {
        setUseFallback(false);
        return;
      }
      
      // TradingView Charting Library requires a license
      // For now, we'll use our fallback chart
      // In production, you would load the library here
      console.log('Using fallback chart - TradingView library not available');
    };
    
    loadTradingView();
  }, []);
  
  // Create TradingView widget when available
  useEffect(() => {
    if (useFallback || !containerRef.current) return;
    
    const TradingView = (window as any).TradingView;
    if (!TradingView) return;
    
    // Create datafeed
    datafeedRef.current = createBinanceDatafeed(
      isEducational,
      eduGeneratorRef.current
    );
    
    // Create widget
    widgetRef.current = new TradingView.widget({
      container: containerRef.current,
      datafeed: datafeedRef.current,
      symbol: symbol,
      interval: interval,
      library_path: '/tradingview/',
      locale: 'en',
      theme: theme === 'dark' ? 'Dark' : 'Light',
      autosize: autosize,
      height: typeof height === 'number' ? height : undefined,
      timezone: 'Etc/UTC',
      style: '1', // Candlestick
      toolbar_bg: theme === 'dark' ? '#0a0a0f' : '#ffffff',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      studies_overrides: {},
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#10B981',
        'mainSeriesProperties.candleStyle.downColor': '#EF4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#10B981',
        'mainSeriesProperties.candleStyle.borderDownColor': '#EF4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#10B981',
        'mainSeriesProperties.candleStyle.wickDownColor': '#EF4444',
        'paneProperties.background': theme === 'dark' ? '#0a0a0f' : '#ffffff',
        'paneProperties.vertGridProperties.color': theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        'paneProperties.horzGridProperties.color': theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        'scalesProperties.textColor': theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      },
      disabled_features: [
        'use_localstorage_for_settings',
        'volume_force_overlay',
        'header_symbol_search',
        'header_compare',
      ],
      enabled_features: [
        'hide_left_toolbar_by_default',
        'move_logo_to_main_pane',
      ],
    });
    
    widgetRef.current.onChartReady(() => {
      if (onChartReady) {
        onChartReady();
      }
    });
    
    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [useFallback, symbol, interval, theme, height, autosize, isEducational, onChartReady]);
  
  // Update symbol when it changes
  useEffect(() => {
    if (widgetRef.current && !useFallback) {
      widgetRef.current.setSymbol(symbol, interval, () => {});
    }
  }, [symbol, interval, useFallback]);
  
  return (
    <div 
      ref={containerRef} 
      className="w-full bg-void rounded-xl overflow-hidden"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {useFallback && (
        <FallbackChart
          symbol={symbol}
          height={height}
          priceData={priceData}
          currentPrice={currentPrice}
          priceChange={priceChange}
        />
      )}
    </div>
  );
};

// ==========================================
// SIMPLE MINI CHART
// ==========================================

export const MiniChart: React.FC<{
  data: number[];
  positive: boolean;
  height?: number;
  className?: string;
}> = ({ data, positive, height = 40, className = '' }) => {
  if (data.length < 2) {
    return <div className={`w-full bg-white/5 rounded animate-pulse ${className}`} style={{ height }} />;
  }
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `0,${height} ${points} 100,${height}`;
  const color = positive ? '#10B981' : '#EF4444';
  
  return (
    <svg viewBox={`0 0 100 ${height}`} className={`w-full ${className}`} style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`chartFill-${positive}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#chartFill-${positive})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export default TradingViewChart;
