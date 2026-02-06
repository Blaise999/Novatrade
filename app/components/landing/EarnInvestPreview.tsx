'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Coins, Trophy, Gift, ArrowRight, Shield, BarChart3, Zap, Activity, Users } from 'lucide-react';

const cards = [
  {
    icon: Bot,
    tag: 'AI Bots',
    title: 'Auto-Trading Bots',
    desc: '4 AI strategies from conservative to aggressive. Runs 24/7, auto stop-loss, ML-powered signals.',
    href: '/invest/bots',
    gradient: 'from-cyan-500/10 to-cyan-500/5',
    accent: 'text-cyan-400',
    borderAccent: 'hover:border-cyan-500/20',
    stats: [
      { label: 'Safe Trader', val: '5-8%/mo', icon: Shield },
      { label: 'Alpha Hunter', val: '20-35%/mo', icon: Zap },
    ],
  },
  {
    icon: Coins,
    tag: 'Staking',
    title: 'Stake & Earn',
    desc: 'Earn passive income staking BTC, ETH, SOL, and NOVA token. Auto-compounding with flexible locks.',
    href: '/invest',
    gradient: 'from-pink-500/10 to-pink-500/5',
    accent: 'text-pink-400',
    borderAccent: 'hover:border-pink-500/20',
    stats: [
      { label: 'NOVA Token', val: 'Up to 95% APY', icon: Activity },
      { label: 'Bitcoin', val: 'Up to 12% APY', icon: BarChart3 },
    ],
  },
  {
    icon: Trophy,
    tag: 'Competitions',
    title: 'Trading Tournaments',
    desc: 'Compete against other traders for cash prizes. Weekly forex, monthly crypto, and seasonal championships.',
    href: '/earn/competitions',
    gradient: 'from-gold/10 to-gold/5',
    accent: 'text-gold',
    borderAccent: 'hover:border-gold/20',
    stats: [
      { label: 'Prize Pools', val: '$100K+/mo', icon: Trophy },
      { label: 'Participants', val: '10K+', icon: Users },
    ],
  },
  {
    icon: Gift,
    tag: 'Referral',
    title: 'Earn with Referrals',
    desc: 'Invite friends and earn up to 30% commission. 5 tiers from Bronze to Diamond with escalating rewards.',
    href: '/earn',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
    accent: 'text-emerald-400',
    borderAccent: 'hover:border-emerald-500/20',
    stats: [
      { label: 'Commission', val: 'Up to 30%', icon: Gift },
      { label: 'Top Earner', val: '$42,350', icon: BarChart3 },
    ],
  },
];

export default function EarnInvestPreview() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-cyan-400 uppercase tracking-[0.15em] mb-3">Earn & Invest</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Multiple Ways to{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-gold bg-clip-text text-transparent">Grow Your Money</span>
          </h2>
          <p className="text-sm text-slate-400 mt-3 max-w-lg mx-auto">Beyond trading — stake, compete, refer, and let AI bots work for you.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={c.href}
                className={`group block p-6 bg-gradient-to-br ${c.gradient} border border-white/[0.05] ${c.borderAccent} rounded-2xl transition-all h-full`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <c.icon className={`w-5 h-5 ${c.accent}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${c.accent}`}>{c.tag}</span>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${c.accent} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
                </div>

                <h3 className="text-lg font-bold text-white mb-1.5">{c.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-5">{c.desc}</p>

                <div className="grid grid-cols-2 gap-2.5">
                  {c.stats.map((s, si) => (
                    <div key={si} className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <s.icon className={`w-3 h-3 ${c.accent}`} />
                        <span className="text-[10px] text-slate-500">{s.label}</span>
                      </div>
                      <p className="text-sm font-bold text-white font-mono">{s.val}</p>
                    </div>
                  ))}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
