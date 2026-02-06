'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Star, Activity, Sparkles, Shield, Zap, Award } from 'lucide-react';
import { platformStats } from '@/lib/data';

const ease = [0.22, 1, 0.36, 1];

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* Exact auth-layout background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a12] via-[#080810] to-[#050508]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.12),rgba(0,0,0,0))]" />

      {/* Animated orbs — same as auth layout */}
      <motion.div
        className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gold/15 rounded-full blur-[150px]"
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px]"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-3/4 left-1/2 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px]"
        animate={{ x: ['-50%', '-40%', '-50%'], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grid pattern — same as auth layout */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 border border-gold/20 rounded-full mb-8"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-medium text-gold tracking-wide">Platform v3.0 — AI Engine Now Live</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.05] tracking-tight"
            >
              Trade Smarter,
              <br />
              <span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent">
                Not Harder
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease }}
              className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed"
            >
              Join over {(platformStats.totalUsers / 1e6).toFixed(1)} million traders worldwide. Access global markets with institutional-grade tools, AI-powered signals, and zero commission on crypto.
            </motion.p>

            {/* CTAs — same gold button style as auth pages */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease }}
              className="mt-10 flex flex-col sm:flex-row gap-4"
            >
              <button
                onClick={() => router.push('/auth/signup')}
                className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-black overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gold via-amber-400 to-gold bg-[length:200%_100%] group-hover:animate-shimmer transition-all" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-0 bg-gold/20 blur-xl" />
                </div>
                <span className="relative flex items-center gap-2 text-base">
                  Start Trading Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={() => router.push('/markets')}
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-white/[0.03] border border-white/[0.08] text-white font-semibold rounded-xl hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                Explore Markets
                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-10 flex items-center gap-5"
            >
              <div className="flex -space-x-2.5">
                {['#D4AF37', '#6366F1', '#00D9A5', '#22D3EE'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#050508] flex items-center justify-center text-[10px] font-bold" style={{ background: c, color: '#050508' }}>
                    {['A', 'M', 'S', 'D'][i]}
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-[#050508] bg-white/10 flex items-center justify-center text-[10px] font-medium text-white/60">
                  +2.8M
                </div>
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-gold text-gold" />
                  ))}
                  <span className="text-xs text-slate-500 ml-1.5">4.9/5</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Trusted by {(platformStats.totalUsers / 1e6).toFixed(1)}M+ traders · {platformStats.totalCountries}+ countries</p>
              </div>
            </motion.div>

            {/* Feature badges — same style as auth layout cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease }}
              className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                { icon: Shield, text: '$500M Insured', color: 'from-gold/20 to-gold/5' },
                { icon: Zap, text: '0.001s Exec', color: 'from-emerald-500/20 to-emerald-500/5' },
                { icon: Award, text: '5 Awards', color: 'from-blue-500/20 to-blue-500/5' },
                { icon: Activity, text: '99.99% Uptime', color: 'from-purple-500/20 to-purple-500/5' },
              ].map((b, i) => (
                <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg bg-gradient-to-br ${b.color} border border-white/[0.05]`}>
                  <div className="w-7 h-7 rounded-md bg-white/[0.05] flex items-center justify-center">
                    <b.icon className="w-3.5 h-3.5 text-gold" />
                  </div>
                  <span className="text-[11px] font-medium text-white/80">{b.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Live signals card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease }}
            className="hidden lg:block"
          >
            <div className="relative">
              {/* Card glow — same pattern as auth login card */}
              <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 via-transparent to-emerald-500/20 rounded-3xl blur-xl opacity-40" />
              <div className="relative bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4 text-gold" />
                    </div>
                    <span className="text-sm font-semibold text-white">Live AI Signals</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-profit/10 rounded-full">
                    <div className="w-1.5 h-1.5 bg-profit rounded-full animate-pulse" />
                    <span className="text-[10px] font-semibold text-profit">LIVE</span>
                  </div>
                </div>

                {/* Signals */}
                <div className="p-4 space-y-2">
                  {[
                    { pair: 'BTC/USD', dir: 'LONG', conf: 94, pnl: '+$2,431.50', pnlPct: '+4.2%', up: true },
                    { pair: 'EUR/USD', dir: 'SHORT', conf: 87, pnl: '+$847.20', pnlPct: '+1.7%', up: true },
                    { pair: 'NVDA', dir: 'LONG', conf: 91, pnl: '+$1,205.80', pnlPct: '+3.1%', up: true },
                    { pair: 'XAUUSD', dir: 'LONG', conf: 85, pnl: '+$632.40', pnlPct: '+1.2%', up: true },
                    { pair: 'SOL/USD', dir: 'SHORT', conf: 78, pnl: '-$128.30', pnlPct: '-0.8%', up: false },
                  ].map((sig, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.1, ease }}
                      className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-6 rounded flex items-center justify-center ${sig.up ? 'bg-profit/10' : 'bg-loss/10'}`}>
                          <span className={`text-[9px] font-bold font-mono ${sig.up ? 'text-profit' : 'text-loss'}`}>{sig.dir}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{sig.pair}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="h-1 w-16 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full bg-gold rounded-full" style={{ width: `${sig.conf}%` }} />
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">{sig.conf}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-mono font-semibold ${sig.up ? 'text-profit' : 'text-loss'}`}>{sig.pnl}</p>
                        <p className={`text-[10px] font-mono ${sig.up ? 'text-profit/60' : 'text-loss/60'}`}>{sig.pnlPct}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Today&apos;s P&L</p>
                    <p className="text-xl font-bold text-profit font-mono">+$4,988.60</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Win Rate</p>
                    <p className="text-sm font-bold text-white font-mono">82.4%</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
