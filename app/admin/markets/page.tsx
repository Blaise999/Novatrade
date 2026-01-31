'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Play,
  Pause,
  CandlestickChart,
  Zap,
  AlertTriangle,
  CheckCircle,
  X,
  BookOpen,
  Edit3,
} from 'lucide-react';
import { useAdminMarketStore, CustomPair } from '@/lib/admin-markets';

const patternOptions = [
  { id: 'bull-flag', name: 'Bull Flag', description: 'Strong move up, consolidation, breakout' },
  { id: 'head-shoulders', name: 'Head & Shoulders', description: 'Reversal pattern with breakdown' },
  { id: 'double-bottom', name: 'Double Bottom', description: 'Support test and rally' },
  { id: 'breakout-up', name: 'Bullish Breakout', description: 'Consolidation then upward break' },
  { id: 'breakout-down', name: 'Bearish Breakout', description: 'Consolidation then downward break' },
];

export default function AdminMarketsPage() {
  const {
    customPairs,
    candles,
    currentPrices,
    isPaused,
    setCurrentPrice,
    pauseTrading,
    resumeTrading,
    addCandle,
    generateBullFlag,
    generateHeadAndShoulders,
    generateDoubleBottom,
    generateBreakout,
  } = useAdminMarketStore();

  const [selectedPair, setSelectedPair] = useState<CustomPair>(customPairs[0]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showCandleModal, setShowCandleModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New price inputs
  const [newBid, setNewBid] = useState('');
  const [newAsk, setNewAsk] = useState('');

  // New candle inputs
  const [candleOpen, setCandleOpen] = useState('');
  const [candleHigh, setCandleHigh] = useState('');
  const [candleLow, setCandleLow] = useState('');
  const [candleClose, setCandleClose] = useState('');
  const [candleVolume, setCandleVolume] = useState('1000');

  // Selected pattern
  const [selectedPattern, setSelectedPattern] = useState(patternOptions[0].id);
  const [patternBasePrice, setPatternBasePrice] = useState('1.0000');

  const currentPrice = currentPrices[selectedPair.id];
  const pairCandles = candles[selectedPair.id] || [];
  const isTradingPaused = isPaused[selectedPair.id] || false;

  // ✅ FIX: CustomPair has no `spread`. Derive it from currentPrices, fallback to 0.0002
  const effectiveSpread =
    currentPrice && typeof currentPrice.ask === 'number' && typeof currentPrice.bid === 'number'
      ? Math.max(currentPrice.ask - currentPrice.bid, 0)
      : 0.0002;

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSetPrice = () => {
    const bid = parseFloat(newBid);
    const ask = parseFloat(newAsk);

    if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) {
      showNotification('error', 'Invalid price values');
      return;
    }
    if (ask <= bid) {
      showNotification('error', 'Ask must be greater than Bid');
      return;
    }

    setCurrentPrice(selectedPair.id, bid, ask);
    showNotification('success', `Price updated to ${bid.toFixed(5)} / ${ask.toFixed(5)}`);
    setShowPriceModal(false);
    setNewBid('');
    setNewAsk('');
  };

  const handleAddCandle = () => {
    const open = parseFloat(candleOpen);
    const high = parseFloat(candleHigh);
    const low = parseFloat(candleLow);
    const close = parseFloat(candleClose);
    const volume = parseFloat(candleVolume);

    if ([open, high, low, close].some(isNaN) || [open, high, low, close].some((v) => v <= 0)) {
      showNotification('error', 'Invalid candle values');
      return;
    }
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      showNotification('error', 'High must be >= max(open,close), Low must be <= min(open,close)');
      return;
    }

    // ✅ FIX 1: Remove `pairId` from the candle payload (your type doesn’t have it)
    addCandle(selectedPair.id, {
      timestamp: new Date(),
      open,
      high,
      low,
      close,
      volume,
    
      createdBy: 'admin',
    });

    // ✅ FIX 2: Use derived spread, not selectedPair.spread
    setCurrentPrice(selectedPair.id, close, close + effectiveSpread);

    showNotification('success', 'Candle added successfully');
    setShowCandleModal(false);
    setCandleOpen('');
    setCandleHigh('');
    setCandleLow('');
    setCandleClose('');
  };

  const handleGeneratePattern = () => {
    const basePrice = parseFloat(patternBasePrice);
    if (isNaN(basePrice) || basePrice <= 0) {
      showNotification('error', 'Invalid base price');
      return;
    }

    switch (selectedPattern) {
      case 'bull-flag':
        generateBullFlag(selectedPair.id, basePrice);
        break;
      case 'head-shoulders':
        generateHeadAndShoulders(selectedPair.id, basePrice);
        break;
      case 'double-bottom':
        generateDoubleBottom(selectedPair.id, basePrice);
        break;
      case 'breakout-up':
        generateBreakout(selectedPair.id, basePrice, 'up');
        break;
      case 'breakout-down':
        generateBreakout(selectedPair.id, basePrice, 'down');
        break;
    }

    showNotification(
      'success',
      `Generated ${patternOptions.find((p) => p.id === selectedPattern)?.name} pattern`
    );
    setShowPatternModal(false);
  };

  const toggleTrading = () => {
    if (isTradingPaused) {
      resumeTrading(selectedPair.id);
      showNotification('success', `Trading resumed for ${selectedPair.symbol}`);
    } else {
      pauseTrading(selectedPair.id);
      showNotification('success', `Trading paused for ${selectedPair.symbol}`);
    }
  };

  const quickPriceAdjust = (direction: 'up' | 'down', amount: number) => {
    const current = currentPrice?.bid || 1;
    const change = direction === 'up' ? amount : -amount;
    const newBidPrice = current + change;

    // ✅ FIX: use derived spread
    setCurrentPrice(selectedPair.id, newBidPrice, newBidPrice + effectiveSpread);

    showNotification(
      'success',
      `Price adjusted ${direction === 'up' ? '+' : ''}${(change * 10000).toFixed(1)} pips`
    );
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-cream">Educational Markets Control</h1>
        <p className="text-slate-400 mt-1">Manage custom pairs for student education</p>
      </div>

      {/* Pair Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {customPairs.map((pair) => {
          const price = currentPrices[pair.id];
          const paused = isPaused[pair.id];

          return (
            <button
              key={pair.id}
              onClick={() => setSelectedPair(pair)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedPair.id === pair.id
                  ? 'bg-purple-500/20 border-purple-500/50'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <span className="font-semibold text-cream">{pair.symbol}</span>
                </div>
                {paused && <span className="px-2 py-0.5 bg-loss/20 text-loss text-xs rounded">PAUSED</span>}
              </div>
              <p className="text-sm text-cream/50">{pair.name}</p>
              {price && (
                <p className="text-lg font-mono text-cream mt-2">
                  {price.bid.toFixed(5)} / {price.ask.toFixed(5)}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Pair Controls */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Price Control Panel */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-cream">{selectedPair.symbol}</h2>
                <p className="text-sm text-cream/50">Price Control</p>
              </div>
            </div>
            <button
              onClick={toggleTrading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                isTradingPaused ? 'bg-profit text-void hover:bg-profit/90' : 'bg-loss text-white hover:bg-loss/90'
              }`}
            >
              {isTradingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isTradingPaused ? 'Resume' : 'Pause'}
            </button>
          </div>

          {/* Current Price Display */}
          <div className="p-4 bg-charcoal rounded-xl mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-cream/50 mb-1">Bid Price</p>
                <p className="text-2xl font-mono text-loss">{currentPrice?.bid.toFixed(5) || '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-cream/50 mb-1">Ask Price</p>
                <p className="text-2xl font-mono text-profit">{currentPrice?.ask.toFixed(5) || '—'}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 text-center">
              <p className="text-xs text-cream/50">Spread: {(effectiveSpread * 10000).toFixed(1)} pips</p>
            </div>
          </div>

          {/* Quick Price Adjustments */}
          <div className="mb-4">
            <p className="text-xs text-cream/50 mb-2">Quick Adjust (pips)</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 25].map((pips) => (
                <div key={pips} className="flex gap-1">
                  <button
                    onClick={() => quickPriceAdjust('down', pips * 0.0001)}
                    className="flex-1 py-2 bg-loss/20 text-loss text-sm font-medium rounded-lg hover:bg-loss/30"
                  >
                    -{pips}
                  </button>
                  <button
                    onClick={() => quickPriceAdjust('up', pips * 0.0001)}
                    className="flex-1 py-2 bg-profit/20 text-profit text-sm font-medium rounded-lg hover:bg-profit/30"
                  >
                    +{pips}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setNewBid(currentPrice?.bid.toFixed(5) || '');
                setNewAsk(currentPrice?.ask.toFixed(5) || '');
                setShowPriceModal(true);
              }}
              className="flex items-center justify-center gap-2 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90"
            >
              <Edit3 className="w-4 h-4" />
              Set Price
            </button>
            <button
              onClick={() => {
                const mid = currentPrice ? (currentPrice.bid + currentPrice.ask) / 2 : 1;

                setCandleOpen(mid.toFixed(5));
                setCandleHigh((mid + 0.001).toFixed(5));
                setCandleLow((mid - 0.001).toFixed(5));
                setCandleClose(mid.toFixed(5));
                setShowCandleModal(true);
              }}
              className="flex items-center justify-center gap-2 py-3 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20"
            >
              <CandlestickChart className="w-4 h-4" />
              Add Candle
            </button>
          </div>
        </div>

        {/* Pattern Generator */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-cream">Pattern Generator</h2>
              <p className="text-sm text-cream/50">Create educational chart patterns</p>
            </div>
          </div>

          <div className="space-y-4">
            {patternOptions.map((pattern) => (
              <button
                key={pattern.id}
                onClick={() => {
                  setSelectedPattern(pattern.id);
                  setPatternBasePrice((currentPrice?.bid || 1).toFixed(4));
                  setShowPatternModal(true);
                }}
                className="w-full p-4 bg-charcoal rounded-xl border border-white/10 text-left hover:border-gold/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-cream">{pattern.name}</p>
                    <p className="text-sm text-cream/50">{pattern.description}</p>
                  </div>
                  <Zap className="w-5 h-5 text-gold" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Candles */}
      <div className="mt-6 bg-white/5 rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cream">Recent Candles ({pairCandles.length})</h2>
          <button className="text-sm text-gold hover:text-gold/80">View All</button>
        </div>

        {pairCandles.length === 0 ? (
          <div className="text-center py-8 text-cream/50">
            <CandlestickChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No candles yet. Add candles or generate a pattern.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream/50 border-b border-white/10">
                  <th className="text-left pb-3">Time</th>
                  <th className="text-right pb-3">Open</th>
                  <th className="text-right pb-3">High</th>
                  <th className="text-right pb-3">Low</th>
                  <th className="text-right pb-3">Close</th>
                  <th className="text-right pb-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {pairCandles
                  .slice(-10)
                  .reverse()
                  .map((candle: any) => {
                    const isGreen = candle.close >= candle.open;
                    return (
                      <tr key={candle.id} className="border-b border-white/5">
                        <td className="py-2 text-cream/70">{new Date(candle.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 text-right font-mono text-cream">{candle.open.toFixed(5)}</td>
                        <td className="py-2 text-right font-mono text-profit">{candle.high.toFixed(5)}</td>
                        <td className="py-2 text-right font-mono text-loss">{candle.low.toFixed(5)}</td>
                        <td className="py-2 text-right font-mono text-cream">{candle.close.toFixed(5)}</td>
                        <td className="py-2 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              isGreen ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                            }`}
                          >
                            {isGreen ? 'BULL' : 'BEAR'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Set Price Modal */}
      <AnimatePresence>
        {showPriceModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPriceModal(false)}
              className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-obsidian rounded-2xl p-6 border border-gold/20 z-50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream">Set Price</h3>
                <button onClick={() => setShowPriceModal(false)}>
                  <X className="w-5 h-5 text-cream/50" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-cream/50 mb-2">Bid Price</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={newBid}
                    onChange={(e) => setNewBid(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                    placeholder="1.00000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cream/50 mb-2">Ask Price</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={newAsk}
                    onChange={(e) => setNewAsk(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                    placeholder="1.00020"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPriceModal(false)}
                  className="flex-1 py-3 bg-white/5 text-cream rounded-xl hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPrice}
                  className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90"
                >
                  Set Price
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Candle Modal */}
      <AnimatePresence>
        {showCandleModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCandleModal(false)}
              className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-obsidian rounded-2xl p-6 border border-gold/20 z-50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream">Add Candle</h3>
                <button onClick={() => setShowCandleModal(false)}>
                  <X className="w-5 h-5 text-cream/50" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-cream/50 mb-2">Open</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={candleOpen}
                    onChange={(e) => setCandleOpen(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cream/50 mb-2">High</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={candleHigh}
                    onChange={(e) => setCandleHigh(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-profit"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cream/50 mb-2">Low</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={candleLow}
                    onChange={(e) => setCandleLow(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-loss"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cream/50 mb-2">Close</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={candleClose}
                    onChange={(e) => setCandleClose(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCandleModal(false)}
                  className="flex-1 py-3 bg-white/5 text-cream rounded-xl hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCandle}
                  className="flex-1 py-3 bg-profit text-void font-semibold rounded-xl hover:bg-profit/90"
                >
                  Add Candle
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Generate Pattern Modal */}
      <AnimatePresence>
        {showPatternModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPatternModal(false)}
              className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-obsidian rounded-2xl p-6 border border-gold/20 z-50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream">Generate Pattern</h3>
                <button onClick={() => setShowPatternModal(false)}>
                  <X className="w-5 h-5 text-cream/50" />
                </button>
              </div>

              <div className="p-4 bg-gold/10 border border-gold/20 rounded-xl mb-4">
                <p className="font-medium text-cream">{patternOptions.find((p) => p.id === selectedPattern)?.name}</p>
                <p className="text-sm text-cream/50">
                  {patternOptions.find((p) => p.id === selectedPattern)?.description}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-cream/50 mb-2">Base Price</label>
                <input
                  type="number"
                  step="0.0001"
                  value={patternBasePrice}
                  onChange={(e) => setPatternBasePrice(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                />
                <p className="text-xs text-cream/40 mt-2">Pattern will be generated around this price level</p>
              </div>

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-500/80">
                  This will add 30-50 candles to create the pattern. Current price will be updated.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPatternModal(false)}
                  className="flex-1 py-3 bg-white/5 text-cream rounded-xl hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGeneratePattern}
                  className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90"
                >
                  Generate
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
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 ${
              notification.type === 'success' ? 'bg-profit text-void' : 'bg-loss text-white'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
