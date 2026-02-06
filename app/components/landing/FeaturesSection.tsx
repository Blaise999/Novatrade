'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bitcoin, DollarSign, BarChart3, Users, Bot, GraduationCap, Coins, Shield, ArrowRight, Signal, Gem
} from 'lucide-react';

const features = [
  {
    icon: Bitcoin, title: 'Cryptocurrency', desc: '200+ crypto pairs. 24/7 markets, instant execution, zero commission.',
    href: '/dashboard/trade/crypto', gradient: 'from-amber-500/20 to-amber-500/5', accent: 'text-amber-400',
    stat: '200+', statLabel: 'Pairs',
  },
  {
    icon: DollarSign, title: 'Forex Trading', desc: '80+ currency pairs with leverage up to 1:500. Pro-grade tools.',
    href: '/dashboard/trade/fx', gradient: 'from-emerald-500/20 to-emerald-500/5', accent: 'text-emerald-400',
    stat: '1:500', statLabel: 'Leverage',
  },
  {
    icon: BarChart3, title: 'Stock Trading', desc: '5,000+ global stocks & ETFs. Fractional shares from $1.',
    href: '/dashboard/trade/stocks', gradient: 'from-blue-500/20 to-blue-500/5', accent: 'text-blue-400',
    stat: '5K+', statLabel: 'Stocks',
  },
  {
    icon: Users, title: 'DCA & Grid Bots', desc: 'One-click copy top performers. Auto-replicate their trades in real time.',
    href: '/invest/bots', gradient: 'from-purple-500/20 to-purple-500/5', accent: 'text-purple-400',
    stat: '2,847', statLabel: 'Traders',
  },
  {
    icon: Bot, title: 'AI Trading Bots', desc: 'Deploy ML-powered bots. 4 strategies from conservative to aggressive.',
    href: '/invest/bots', gradient: 'from-cyan-500/20 to-cyan-500/5', accent: 'text-cyan-400',
    stat: '24/7', statLabel: 'Automated',
  },
  {
    icon: Coins, title: 'Staking & Earn', desc: 'Earn up to 95% APY staking BTC, ETH, SOL with auto-compound.',
    href: '/invest', gradient: 'from-pink-500/20 to-pink-500/5', accent: 'text-pink-400',
    stat: '95%', statLabel: 'APY',
  },
  {
    icon: Signal, title: 'AI Signals', desc: 'Real-time trading signals with 82% accuracy. Entry, exit & stop-loss.',
    href: '/dashboard', gradient: 'from-orange-500/20 to-orange-500/5', accent: 'text-orange-400',
    stat: '82%', statLabel: 'Accuracy',
  },
  {
    icon: GraduationCap, title: 'Trading Academy', desc: 'Free courses, video tutorials, and live webinars from pro traders.',
    href: '/academy', gradient: 'from-gold/20 to-gold/5', accent: 'text-gold',
    stat: 'Free', statLabel: 'Access',
  },
];

export default function FeaturesSection() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-semibold text-gold uppercase tracking-[0.15em] mb-3">
            Platform Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight"
          >
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent">Succeed</span>
          </motion.h2>
          <p className="text-slate-400 mt-3 max-w-xl mx-auto">One platform for all your trading, investing, and earning needs.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={f.href}
                className={`group block h-full p-5 rounded-xl bg-gradient-to-br ${f.gradient} border border-white/[0.05] hover:border-white/[0.12] transition-all backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <f.icon className={`w-5 h-5 ${f.accent}`} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white font-mono">{f.stat}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">{f.statLabel}</p>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{f.desc}</p>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${f.accent} opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all`}>
                  Explore <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
