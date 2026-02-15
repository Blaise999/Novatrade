// app/markets/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  Activity,
  BadgeInfo,
  BarChart3,
  Bot,
  CandlestickChart,
  Coins,
  Clock,
  Flame,
  Gauge,
  Globe,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

type TabKey = 'crypto' | 'fx' | 'stocks' | 'charts' | 'risk' | 'bots' | 'shield';

const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const fmtMoney = (v: number, currency = '$') => {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return `${sign}${currency}${s}`;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function ExploreMarketsPage() {
  const [tab, setTab] = useState<TabKey>('crypto');

  // --- EDUCATIONAL calculators (no network, no trading)
  const [spotQty, setSpotQty] = useState('0.25');
  const [spotEntry, setSpotEntry] = useState('45000');
  const [spotNow, setSpotNow] = useState('47250');

  const [fxDir, setFxDir] = useState<'long' | 'short'>('long');
  const [fxPrice, setFxPrice] = useState('1.0850');
  const [fxUnits, setFxUnits] = useState('10000'); // 10k units
  const [fxLeverage, setFxLeverage] = useState('30');
  const [fxMovePips, setFxMovePips] = useState('18'); // educational

  const spotCalc = useMemo(() => {
    const q = n(spotQty);
    const entry = n(spotEntry);
    const now = n(spotNow);

    const cost = q * entry;
    const value = q * now;
    const pnl = value - cost;
    const pnlPct = entry > 0 ? (now / entry - 1) * 100 : 0;

    return {
      cost,
      value,
      pnl,
      pnlPct,
    };
  }, [spotQty, spotEntry, spotNow]);

  const fxCalc = useMemo(() => {
    const price = n(fxPrice);
    const units = Math.max(0, Math.floor(n(fxUnits)));
    const lev = clamp(n(fxLeverage), 1, 500);
    const pips = n(fxMovePips);

    // Simple educational model:
    // Notional ≈ units * price
    // Margin ≈ notional / leverage
    // P/L ≈ (Δprice) * units (ignoring pip value variations by quote currency)
    const notional = units * price;
    const margin = lev > 0 ? notional / lev : notional;

    const deltaPrice = (pips || 0) * 0.0001; // generic pip size (educational)
    const rawPnl = deltaPrice * units;
    const pnl = fxDir === 'long' ? rawPnl : -rawPnl;

    return {
      notional,
      margin,
      deltaPrice,
      pnl,
      lev,
      units,
    };
  }, [fxPrice, fxUnits, fxLeverage, fxMovePips, fxDir]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background (match auth/landing vibe) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a12] via-[#080810] to-[#050508]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.12),rgba(0,0,0,0))]" />

      {/* Orbs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-[520px] h-[520px] bg-gold/15 rounded-full blur-[160px]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 right-0 w-[420px] h-[420px] bg-emerald-500/10 rounded-full blur-[140px]"
        animate={{ scale: [1.06, 1, 1.06], opacity: [0.28, 0.48, 0.28] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-3/4 left-1/2 w-[320px] h-[320px] bg-blue-500/10 rounded-full blur-[120px]"
        animate={{ x: ['-50%', '-42%', '-50%'], opacity: [0.18, 0.38, 0.18] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        {/* Top hero */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 border border-gold/20 rounded-full"
            >
              <BadgeInfo className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-medium text-gold tracking-wide">
                Explore Markets — educational overview (not trading advice)
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.05, ease }}
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight"
            >
              Understand the markets
              <br />
              <span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent">
                before you enter
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.15, ease }}
              className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed"
            >
              NovaTrade spans <span className="text-white/80">Crypto Spot</span>,{' '}
              <span className="text-white/80">FX Margin</span>, and{' '}
              <span className="text-white/80">Stocks Investing</span> — plus bots and protective controls.
              This page breaks down how each market works, the language traders use, and the math behind P&amp;L.
            </motion.p>

            {/* Mini “what you’ll learn” chips */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.25, ease }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {[
                { icon: CandlestickChart, label: 'Candles & timeframes' },
                { icon: Gauge, label: 'Margin & leverage' },
                { icon: Shield, label: 'Stops, TP, risk' },
                { icon: Bot, label: 'DCA & Grid bots' },
                { icon: Wallet, label: 'Spot holdings & avg price' },
              ].map((x, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08]"
                >
                  <x.icon className="w-3.5 h-3.5 text-gold" />
                  <span className="text-xs text-white/80">{x.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right info card */}
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease }}
            className="relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 via-transparent to-emerald-500/20 rounded-3xl blur-xl opacity-40" />
            <div className="relative bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-gold" />
                  </div>
                  <span className="text-sm font-semibold text-white">Market Map</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  Educational snapshots
                </div>
              </div>

              <div className="p-5 space-y-3">
                {[
                  {
                    icon: Coins,
                    title: 'Crypto (Spot)',
                    sub: '24/7 · buy/hold · high volatility',
                    chips: ['Wallet', 'Avg price', 'Unrealized P/L'],
                  },
                  {
                    icon: Activity,
                    title: 'FX (Margin)',
                    sub: '24/5 · leverage · spread + swaps',
                    chips: ['Long/Short', 'SL/TP', 'Margin'],
                  },
                  {
                    icon: BarChart3,
                    title: 'Stocks (Invest)',
                    sub: 'Market hours · fractional shares · earnings',
                    chips: ['Positions', 'Cost basis', 'Realized P/L'],
                  },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                          <row.icon className="w-5 h-5 text-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{row.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{row.sub}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-white/30" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.chips.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] text-white/70 bg-white/[0.03] border border-white/[0.08] rounded-full px-2 py-1"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-white/70 font-medium">Reminder:</span> prices move fast. Any example P&amp;L here is
                    only to explain mechanics (not a promise of results).
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Market selection cards */}
        <section className="mt-14 md:mt-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Pick a market to study</h2>
              <p className="text-sm text-slate-400 mt-1">
                Each market has different hours, fees, risks, and order behavior.
              </p>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MarketCard
              icon={Coins}
              title="Crypto Spot"
              subtitle="Buy & hold coins, track your average entry, manage volatility."
              bullets={[
                'Trades 24/7 (weekends included)',
                'Core math: value = qty × price',
                'Watch out for slippage on fast moves',
              ]}
              badge="Spot"
            />
            <MarketCard
              icon={Activity}
              title="FX Margin"
              subtitle="Trade currency pairs with leverage, long or short, with SL/TP."
              bullets={[
                'Typically 24/5 (weekdays)',
                'Margin = notional ÷ leverage',
                'P/L depends on price move × units',
              ]}
              badge="Margin"
            />
            <MarketCard
              icon={BarChart3}
              title="Stocks Investing"
              subtitle="Build positions over time, manage earnings risk and market sessions."
              bullets={[
                'Market hours (exchange dependent)',
                'Fractional shares can be supported',
                'Realized P/L only when you sell',
              ]}
              badge="Invest"
            />
            <MarketCard
              icon={CandlestickChart}
              title="Charts & Candles"
              subtitle="Understand OHLC candles, timeframes, and what indicators really mean."
              bullets={[
                'OHLC: open, high, low, close',
                'Timeframe changes “signal noise”',
                'Indicators summarize past price',
              ]}
              badge="Learn"
            />
            <MarketCard
              icon={Shield}
              title="Risk Controls"
              subtitle="Stops, take-profit, sizing, and the #1 rule: protect downside first."
              bullets={[
                'Use SL/TP intentionally (not randomly)',
                'Size positions to survive volatility',
                'Leverage amplifies gains AND losses',
              ]}
              badge="Safety"
            />
            <MarketCard
              icon={Bot}
              title="Bots (DCA / Grid)"
              subtitle="Automation that follows rules: DCA averages in, Grid cycles levels."
              bullets={[
                'Bots reduce emotion, not risk',
                'Needs ranges, budgets, and stop rules',
                'Always understand the strategy first',
              ]}
              badge="Automation"
            />
          </div>
        </section>

        {/* Tabs */}
        <section className="mt-14 md:mt-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Deep dive (NovaTrade-style)</h2>
              <p className="text-sm text-slate-400 mt-1">
                Educational, detailed, and aligned with how your platform is built (Spot, FX, Stocks, Bots, Shield).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === 'crypto'} onClick={() => setTab('crypto')} icon={Coins} label="Crypto" />
              <TabButton active={tab === 'fx'} onClick={() => setTab('fx')} icon={Activity} label="FX" />
              <TabButton active={tab === 'stocks'} onClick={() => setTab('stocks')} icon={BarChart3} label="Stocks" />
              <TabButton active={tab === 'charts'} onClick={() => setTab('charts')} icon={CandlestickChart} label="Charts" />
              <TabButton active={tab === 'risk'} onClick={() => setTab('risk')} icon={Shield} label="Risk" />
              <TabButton active={tab === 'bots'} onClick={() => setTab('bots')} icon={Bot} label="Bots" />
              <TabButton active={tab === 'shield'} onClick={() => setTab('shield')} icon={Sparkles} label="Shield" />
            </div>
          </div>

          <div className="mt-6 relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-gold/15 via-transparent to-emerald-500/15 rounded-3xl blur-xl opacity-35" />
            <div className="relative bg-[#0a0a0f]/75 backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  {tab === 'crypto' && <Coins className="w-4.5 h-4.5 text-gold" />}
                  {tab === 'fx' && <Activity className="w-4.5 h-4.5 text-gold" />}
                  {tab === 'stocks' && <BarChart3 className="w-4.5 h-4.5 text-gold" />}
                  {tab === 'charts' && <CandlestickChart className="w-4.5 h-4.5 text-gold" />}
                  {tab === 'risk' && <Shield className="w-4.5 h-4.5 text-gold" />}
                  {tab === 'bots' && <Bot className="w-4.5 h-4.5 text-gold" />}
                  {tab === 'shield' && <Sparkles className="w-4.5 h-4.5 text-gold" />}
                </div>
                <p className="text-sm font-semibold text-white">
                  {tab === 'crypto' && 'Crypto Spot — Hold & manage volatility'}
                  {tab === 'fx' && 'FX Margin — Leverage, long/short, and margin math'}
                  {tab === 'stocks' && 'Stocks — Invest, track cost basis, and earnings risk'}
                  {tab === 'charts' && 'Charts — Candles, timeframes, and reading price action'}
                  {tab === 'risk' && 'Risk — Stops, sizing, and survival-first mindset'}
                  {tab === 'bots' && 'Bots — DCA & Grid mechanics (rules-based automation)'}
                  {tab === 'shield' && 'Shield Mode — Protective behavior (platform feature)'}
                </p>
              </div>

              <div className="p-5 sm:p-6">
                <AnimatePresence mode="wait">
                  {tab === 'crypto' && (
                    <motion.div
                      key="crypto"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="What “Spot” means"
                          icon={Wallet}
                          points={[
                            'You’re buying the asset itself (e.g., BTC), not a leveraged contract.',
                            'Your portfolio tracks quantity, average entry price, and market value.',
                            'Unrealized P/L changes with price; realized P/L happens when you sell.',
                          ]}
                        />
                        <InfoBlock
                          title="Core portfolio math (NovaTrade-style)"
                          icon={BarChart3}
                          points={[
                            'Market value = quantity × current price',
                            'Cost basis = quantity × average entry price',
                            'Unrealized P/L = (current − avg) × quantity',
                            'Unrealized % = (current/avg − 1) × 100',
                          ]}
                        />
                        <InfoBlock
                          title="What usually surprises new users"
                          icon={Flame}
                          points={[
                            'Volatility: big swings can happen quickly, especially on smaller coins.',
                            'Slippage: fast markets can fill slightly worse than expected.',
                            'Fees/spread: tiny costs add up if you overtrade.',
                          ]}
                        />
                      </div>

                      {/* Calculator */}
                      <div className="space-y-4">
                        <CalcCard title="Spot P/L demo" subtitle="Educational calculator (no orders)">
                          <Field label="Quantity">
                            <Input value={spotQty} onChange={setSpotQty} placeholder="e.g., 0.25" />
                          </Field>
                          <Field label="Average entry price">
                            <Input value={spotEntry} onChange={setSpotEntry} placeholder="e.g., 45000" />
                          </Field>
                          <Field label="Current price">
                            <Input value={spotNow} onChange={setSpotNow} placeholder="e.g., 47250" />
                          </Field>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <MiniStat label="Cost basis" value={fmtMoney(spotCalc.cost)} />
                            <MiniStat label="Market value" value={fmtMoney(spotCalc.value)} />
                            <MiniStat
                              label="Unrealized P/L"
                              value={fmtMoney(spotCalc.pnl)}
                              tone={spotCalc.pnl >= 0 ? 'profit' : 'loss'}
                            />
                            <MiniStat
                              label="Unrealized %"
                              value={`${spotCalc.pnlPct.toFixed(2)}%`}
                              tone={spotCalc.pnlPct >= 0 ? 'profit' : 'loss'}
                            />
                          </div>

                          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
                            Tip: if you “average in” (buy multiple times), your avg entry changes using a weighted average.
                          </p>
                        </CalcCard>
                      </div>
                    </motion.div>
                  )}

                  {tab === 'fx' && (
                    <motion.div
                      key="fx"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="How FX pairs work"
                          icon={Globe}
                          points={[
                            'Pairs look like EUR/USD: base/quote. Price means 1 EUR costs X USD.',
                            'Going LONG means you benefit if price rises. SHORT means benefit if price falls.',
                            'FX is commonly traded on margin (leverage) which amplifies outcomes.',
                          ]}
                        />
                        <InfoBlock
                          title="Margin-style math (simplified)"
                          icon={Gauge}
                          points={[
                            'Notional ≈ units × price',
                            'Margin used ≈ notional ÷ leverage',
                            'Floating P/L depends on price movement × units (direction matters)',
                            'Equity ≈ balance + floating P/L; free margin ≈ equity − used margin',
                          ]}
                        />
                        <InfoBlock
                          title="Costs & realities (expected)"
                          icon={TrendingDown}
                          points={[
                            'Spread: difference between buy and sell price.',
                            'Overnight fees (swaps) can apply on held positions.',
                            'Stop-loss isn’t a “guarantee” in extreme volatility, but it’s still a key control.',
                          ]}
                        />
                      </div>

                      <div className="space-y-4">
                        <CalcCard title="FX Margin & P/L demo" subtitle="Educational calculator (pip model simplified)">
                          <Field label="Direction">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setFxDir('long')}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                  fxDir === 'long'
                                    ? 'bg-profit/10 border-profit/30 text-profit'
                                    : 'bg-white/[0.02] border-white/[0.08] text-white/80 hover:bg-white/[0.04]'
                                }`}
                              >
                                LONG
                              </button>
                              <button
                                onClick={() => setFxDir('short')}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                  fxDir === 'short'
                                    ? 'bg-loss/10 border-loss/30 text-loss'
                                    : 'bg-white/[0.02] border-white/[0.08] text-white/80 hover:bg-white/[0.04]'
                                }`}
                              >
                                SHORT
                              </button>
                            </div>
                          </Field>

                          <Field label="Price (e.g., EUR/USD)">
                            <Input value={fxPrice} onChange={setFxPrice} placeholder="e.g., 1.0850" />
                          </Field>
                          <Field label="Units (position size)">
                            <Input value={fxUnits} onChange={setFxUnits} placeholder="e.g., 10000" />
                          </Field>
                          <Field label="Leverage">
                            <Input value={fxLeverage} onChange={setFxLeverage} placeholder="e.g., 30" />
                          </Field>
                          <Field label="Move (pips)">
                            <Input value={fxMovePips} onChange={setFxMovePips} placeholder="e.g., 18" />
                          </Field>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <MiniStat label="Notional" value={fmtMoney(fxCalc.notional)} />
                            <MiniStat label="Margin used" value={fmtMoney(fxCalc.margin)} />
                            <MiniStat
                              label="Est. P/L"
                              value={fmtMoney(fxCalc.pnl)}
                              tone={fxCalc.pnl >= 0 ? 'profit' : 'loss'}
                            />
                            <MiniStat label="Leverage" value={`${fxCalc.lev.toFixed(0)}×`} />
                          </div>

                          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
                            Note: pip value varies by pair/account currency. This calculator is a simplified teaching model.
                          </p>
                        </CalcCard>
                      </div>
                    </motion.div>
                  )}

                  {tab === 'stocks' && (
                    <motion.div
                      key="stocks"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="Stocks on NovaTrade = invest/hold model"
                          icon={BarChart3}
                          points={[
                            'You track positions (shares), average entry, market value, and P/L.',
                            'Fractional shares can be supported (e.g., 0.3 share of NVDA).',
                            'Market hours matter: prices can gap at open after news.',
                          ]}
                        />
                        <InfoBlock
                          title="Key calculations (same logic as spot)"
                          icon={TrendingUp}
                          points={[
                            'Market value = shares × price',
                            'Cost basis = shares × average entry',
                            'Unrealized P/L = (price − avg) × shares',
                            'Realized P/L is recorded when you sell (average cost method is common)',
                          ]}
                        />
                        <InfoBlock
                          title="What drives stock moves"
                          icon={Activity}
                          points={[
                            'Earnings reports, guidance, and macro news.',
                            'Liquidity varies: large caps move differently from small caps.',
                            'Session dynamics: pre-market/after-hours can be thin.',
                          ]}
                        />
                      </div>

                      <div className="space-y-4">
                        <CalloutCard
                          title="Common order types"
                          subtitle="Educational overview"
                          rows={[
                            { k: 'Market', v: 'Executes at best available price now.' },
                            { k: 'Limit', v: 'Executes at your price or better.' },
                            { k: 'Stop', v: 'Triggers a market/limit when a level is hit.' },
                            { k: 'SL / TP', v: 'Controls downside/upside once in a position.' },
                          ]}
                        />
                        <CalloutCard
                          title="Market hours mindset"
                          subtitle="Why timing changes risk"
                          rows={[
                            { k: 'Open', v: 'Volatile, news gets priced fast.' },
                            { k: 'Midday', v: 'Often calmer, but can trend.' },
                            { k: 'Close', v: 'Positioning, rebalancing, spikes.' },
                            { k: 'Overnight', v: 'Risk of gaps on next open.' },
                          ]}
                        />
                      </div>
                    </motion.div>
                  )}

                  {tab === 'charts' && (
                    <motion.div
                      key="charts"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="Candlesticks (OHLC) explained"
                          icon={CandlestickChart}
                          points={[
                            'Open: first traded price in the timeframe.',
                            'High/Low: extremes during the timeframe.',
                            'Close: last traded price in the timeframe.',
                            'A candle is just a summary of many ticks/trades inside that window.',
                          ]}
                        />
                        <InfoBlock
                          title="Timeframes change what you see"
                          icon={Clock}
                          points={[
                            '1m/5m: noisy, good for execution detail, not “truth.”',
                            '15m/1h: balances structure and speed.',
                            '4h/1D: more stable structure, fewer false signals.',
                          ]}
                        />
                        <InfoBlock
                          title="Indicators (keep it real)"
                          icon={BadgeInfo}
                          points={[
                            'Indicators summarize past price; they don’t predict the future.',
                            'Use them to measure context (trend, momentum, volatility) — not as magic buttons.',
                            'Best practice: combine structure (levels) + risk rules + a simple confirmation.',
                          ]}
                        />
                      </div>

                      <div className="space-y-4">
                        <CalloutCard
                          title="Candle building (mental model)"
                          subtitle="How ticks become candles"
                          rows={[
                            { k: 'Ticks', v: 'Individual price updates over time.' },
                            { k: 'Bucket', v: 'Group ticks into a timeframe (e.g., 1 minute).' },
                            { k: 'Compute', v: 'Open/High/Low/Close from that bucket.' },
                            { k: 'Repeat', v: 'Next bucket forms the next candle.' },
                          ]}
                        />
                        <CalloutCard
                          title="Execution basics"
                          subtitle="Why your fill can differ"
                          rows={[
                            { k: 'Spread', v: 'Buy price > sell price.' },
                            { k: 'Slippage', v: 'Fast move changes fill price.' },
                            { k: 'Liquidity', v: 'Thin markets jump more.' },
                            { k: 'Volatility', v: 'News spikes increase risk.' },
                          ]}
                        />
                      </div>
                    </motion.div>
                  )}

                  {tab === 'risk' && (
                    <motion.div
                      key="risk"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="Survival-first rules"
                          icon={Shield}
                          points={[
                            'Risk control beats prediction. Protect downside before chasing upside.',
                            'Leverage increases speed of wins and losses — size smaller when leveraged.',
                            'Plan exits: stop-loss (invalidates idea) and take-profit (captures result).',
                          ]}
                        />
                        <InfoBlock
                          title="Position sizing (simple framework)"
                          icon={Gauge}
                          points={[
                            'Pick a max loss you can accept for a trade (e.g., 0.5%–1% of account).',
                            'Set a stop level based on structure (not emotion).',
                            'Size the position so that if the stop hits, loss ≈ your max loss.',
                          ]}
                        />
                        <InfoBlock
                          title="Avoid the 3 classic blow-ups"
                          icon={TrendingDown}
                          points={[
                            'Revenge trading (doubling down after loss).',
                            'No stop-loss + leverage (one spike can wipe margin).',
                            'Overtrading (fees + bad entries = slow bleed).',
                          ]}
                        />
                      </div>

                      <div className="space-y-4">
                        <RiskLadder />
                        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-gold" />
                            <p className="text-sm font-semibold text-white">Quick checklist</p>
                          </div>
                          <ul className="mt-3 space-y-2 text-[12px] text-slate-300">
                            {[
                              'Do I know why I’m entering (setup)?',
                              'Do I know where I’m wrong (stop)?',
                              'Is my size small enough to survive a surprise spike?',
                              'Am I trading because of a plan — or because I feel something?',
                            ].map((t) => (
                              <li key={t} className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold/70" />
                                <span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {tab === 'bots' && (
                    <motion.div
                      key="bots"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="Bots = rules, not miracles"
                          icon={Bot}
                          points={[
                            'A bot automates a strategy you already understand.',
                            'It reduces emotion and increases consistency — but can’t remove market risk.',
                            'You still need budgets, stop rules, and a plan for bad ranges.',
                          ]}
                        />
                        <InfoBlock
                          title="DCA bot (averaging in)"
                          icon={Wallet}
                          points={[
                            'Buys at a frequency or on dips (safety orders).',
                            'Average entry improves if price keeps dropping — but exposure grows.',
                            'Good for long-term belief assets; dangerous if you ignore stop rules.',
                          ]}
                        />
                        <InfoBlock
                          title="Grid bot (range cycling)"
                          icon={BarChart3}
                          points={[
                            'Creates buy levels below and sell levels above in a range.',
                            'Profits come from repeated oscillations (buy low, sell higher).',
                            'Range breaks can hurt — you need a stop or pause condition.',
                          ]}
                        />
                      </div>

                      <div className="space-y-4">
                        <CalloutCard
                          title="When bots fit"
                          subtitle="Good use-cases"
                          rows={[
                            { k: 'DCA', v: 'Accumulating over time with controlled sizing.' },
                            { k: 'Grid', v: 'Sideways markets with repeated swings.' },
                            { k: 'Both', v: 'When you have clear budgets + rules.' },
                          ]}
                        />
                        <CalloutCard
                          title="When bots don’t fit"
                          subtitle="Red flags"
                          rows={[
                            { k: 'No plan', v: 'You can’t explain why the bot is buying/selling.' },
                            { k: 'No limit', v: 'No max exposure or stop condition.' },
                            { k: 'Chasing', v: 'Turning on bots because of FOMO.' },
                          ]}
                        />
                      </div>
                    </motion.div>
                  )}

                  {tab === 'shield' && (
                    <motion.div
                      key="shield"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      className="grid lg:grid-cols-3 gap-5"
                    >
                      <div className="lg:col-span-2 space-y-4">
                        <InfoBlock
                          title="Shield Mode (platform concept)"
                          icon={Sparkles}
                          points={[
                            'Shield Mode is designed to reduce downside during rapid dips.',
                            'It can pause new risk, tighten rules, or switch behavior to more defensive settings.',
                            'It’s a protective layer — not a guarantee against losses.',
                          ]}
                        />
                        <InfoBlock
                          title="What Shield can reasonably do"
                          icon={Shield}
                          points={[
                            'Reduce exposure (smaller orders, slower frequency).',
                            'Trigger risk actions (alerts, stop rules, bot pause).',
                            'Help enforce discipline when volatility spikes.',
                          ]}
                        />
                        <InfoBlock
                          title="What Shield cannot do"
                          icon={TrendingDown}
                          points={[
                            'It cannot control the market or prevent gaps/spikes.',
                            'It cannot always exit at a perfect price (slippage exists).',
                            'It cannot replace proper position sizing.',
                          ]}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-gold" />
                            <p className="text-sm font-semibold text-white">Example Shield playbook</p>
                          </div>
                          <div className="mt-3 space-y-2">
                            {[
                              { t: 'Volatility detected', d: 'Spread widens / fast candles appear.' },
                              { t: 'Auto slow-down', d: 'Reduce bot frequency and/or order sizes.' },
                              { t: 'Protection checks', d: 'If SL/TP conditions hit, close or pause.' },
                              { t: 'Return to normal', d: 'When volatility stabilizes, restore settings.' },
                            ].map((x) => (
                              <div
                                key={x.t}
                                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                              >
                                <p className="text-[12px] font-semibold text-white/90">{x.t}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{x.d}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-gold/5 border border-gold/15 p-4">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-gold" />
                            <p className="text-sm font-semibold text-white">Best combo</p>
                          </div>
                          <p className="mt-2 text-[12px] text-slate-300 leading-relaxed">
                            Shield Mode works best when paired with: conservative sizing, clear stop rules, and strategies that
                            expect volatility (instead of being surprised by it).
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* Footer disclaimer */}
        <section className="mt-14 md:mt-16">
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <BadgeInfo className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Educational notice</p>
                <p className="mt-1 text-[12px] text-slate-400 leading-relaxed">
                  This page explains concepts (candles, margin, P&amp;L, bots, and risk controls). It is not financial advice,
                  not a recommendation to trade, and not a guarantee of any result. Markets carry risk — especially leveraged
                  trading.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------------------------- UI building blocks --------------------------- */

function MarketCard({
  icon: Icon,
  title,
  subtitle,
  bullets,
  badge,
}: {
  icon: any;
  title: string;
  subtitle: string;
  bullets: string[];
  badge: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, ease }}
      className="relative"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-gold/10 via-transparent to-emerald-500/10 rounded-3xl blur-xl opacity-30" />
      <div className="relative h-full p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.03] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <Icon className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 rounded-full px-2 py-1">
            {badge}
          </span>
        </div>

        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2 text-[12px] text-slate-300">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold/70" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
        active
          ? 'bg-gold/10 border-gold/25 text-gold'
          : 'bg-white/[0.02] border-white/[0.08] text-white/80 hover:bg-white/[0.04] hover:border-white/[0.12]'
      }`}
      type="button"
    >
      <Icon className={`w-4 h-4 ${active ? 'text-gold' : 'text-white/60'}`} />
      {label}
    </button>
  );
}

function InfoBlock({
  title,
  icon: Icon,
  points,
}: {
  title: string;
  icon: any;
  points: string[];
}) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-gold" />
        </div>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {points.map((t) => (
          <li key={t} className="flex gap-2 text-[12px] text-slate-300 leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold/70" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalcCard({ title, subtitle, children }: { title: string; subtitle: string; children: any }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] text-white/60 bg-white/[0.03] border border-white/[0.08] rounded-full px-2 py-1">
          Demo
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 text-sm outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10"
      inputMode="decimal"
    />
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
}) {
  const toneCls =
    tone === 'profit'
      ? 'text-profit bg-profit/10 border-profit/20'
      : tone === 'loss'
      ? 'text-loss bg-loss/10 border-loss/20'
      : 'text-white/80 bg-white/[0.03] border-white/[0.08]';

  return (
    <div className={`rounded-xl border p-3 ${toneCls}`}>
      <p className="text-[10px] opacity-80">{label}</p>
      <p className="mt-1 text-sm font-mono font-semibold">{value}</p>
    </div>
  );
}

function CalloutCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { k: string; v: string }[];
}) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.k} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <p className="text-[12px] font-semibold text-white/85">{r.k}</p>
            <p className="text-[11px] text-slate-400 text-right leading-relaxed">{r.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskLadder() {
  const rows = [
    { label: 'Lowest risk (usually)', desc: 'Unleveraged spot holdings (small sizing).', icon: Wallet },
    { label: 'Medium', desc: 'Stocks investing (earnings/news gaps).', icon: BarChart3 },
    { label: 'Higher', desc: 'FX with leverage (margin + fast moves).', icon: Activity },
    { label: 'Highest (common)', desc: 'Over-leveraging + no stop rules.', icon: TrendingDown },
  ];

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-gold" />
        <p className="text-sm font-semibold text-white">Risk ladder</p>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <r.icon className="w-4.5 h-4.5 text-gold" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-white/90">{r.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
        The goal isn’t “never risk” — it’s “risk small enough to stay in the game.”
      </p>
    </div>
  );
}
