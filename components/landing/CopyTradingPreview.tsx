'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Users, Copy, TrendingUp, Trophy } from 'lucide-react';
import { topTraders } from '@/lib/data';

export default function CopyTradingPreview() {
  return (
    <section className="relative py-20 md:py-28 border-y border-white/[0.04] overflow-hidden">
      {/* bg glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
          <div>
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-[0.15em] mb-2">Copy Trading</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Copy Top Traders, Profit Together
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-lg">Automatically replicate trades from verified professionals. When they profit, you profit.</p>
          </div>
          <Link href="/dashboard/copy-trading" className="group flex items-center gap-2 text-sm text-gold hover:text-gold/80 font-medium transition-colors shrink-0">
            Browse All Traders <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Stats row — same pattern as copy-trading page */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Users, label: 'Active Traders', val: '2,847', color: 'bg-gold/10 text-gold' },
            { icon: TrendingUp, label: 'Avg. Return', val: '+127%', color: 'bg-profit/10 text-profit' },
            { icon: Trophy, label: 'Top Win Rate', val: '85.7%', color: 'bg-electric/10 text-electric' },
            { icon: Copy, label: 'Active Copiers', val: '48.2K', color: 'bg-purple-500/10 text-purple-400' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color.split(' ')[0]}`}>
                  <s.icon className={`w-5 h-5 ${s.color.split(' ')[1]}`} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
                  <p className="text-lg font-bold text-white font-mono">{s.val}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trader cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topTraders.slice(0, 3).map((trader, i) => (
            <motion.div
              key={trader.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="group p-5 bg-[#0a0a0f]/80 border border-white/[0.06] rounded-2xl hover:border-white/[0.12] transition-all h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold/30 to-purple-500/30 flex items-center justify-center text-base font-bold text-white shrink-0">
                    {trader.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white truncate">{trader.name}</p>
                      {trader.verified && <CheckCircle className="w-3.5 h-3.5 text-gold shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500">{trader.trades.toLocaleString()} trades · {trader.assets.join(', ')}</p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-4 line-clamp-2 flex-1">{trader.bio}</p>

                {/* Stats — same layout as copy-trading page */}
                <div className="grid grid-cols-3 gap-2.5 p-3 bg-white/[0.02] rounded-xl mb-4">
                  <div className="text-center">
                    <p className="text-base font-bold text-profit font-mono">+{trader.totalReturn}%</p>
                    <p className="text-[9px] text-slate-500 uppercase">Return</p>
                  </div>
                  <div className="text-center border-x border-white/[0.04]">
                    <p className="text-base font-bold text-white font-mono">{trader.winRate}%</p>
                    <p className="text-[9px] text-slate-500 uppercase">Win Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-white font-mono">{(trader.followers / 1000).toFixed(1)}K</p>
                    <p className="text-[9px] text-slate-500 uppercase">Copiers</p>
                  </div>
                </div>

                {/* Risk + CTA */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, si) => (
                      <div key={si} className={`w-1.5 h-4 rounded-full ${si < trader.riskScore ? 'bg-amber-400' : 'bg-white/[0.06]'}`} />
                    ))}
                    <span className="text-[10px] text-slate-500 ml-1.5">Risk {trader.riskScore}/5</span>
                  </div>
                  <Link href="/dashboard/copy-trading" className="text-[11px] text-gold font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Copy <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
