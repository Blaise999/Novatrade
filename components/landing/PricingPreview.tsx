'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Zap, Rocket, Crown, Diamond, Users } from 'lucide-react';

const tiers = [
  {
    name: 'Basic', deposit: 'Free', icon: Users,
    color: 'border-slate-500/20', grad: 'from-slate-500 to-slate-600',
    popular: false,
    features: ['View all markets', 'Paper trading', 'Trading Academy', 'Community forum'],
    excluded: ['Live trading', 'Copy trading'],
    cta: 'Get Started', ctaLink: '/auth/signup',
  },
  {
    name: 'Starter', deposit: '$500', icon: Zap,
    color: 'border-blue-500/20', grad: 'from-blue-500 to-blue-600',
    popular: false,
    features: ['Live Crypto/Forex/Stocks', '1:100 leverage', 'Standard spreads', '$50 welcome bonus'],
    excluded: ['Copy trading', 'Trading bots'],
    cta: 'Deposit $500', ctaLink: '/auth/signup?tier=starter',
  },
  {
    name: 'Pro', deposit: '$1,000', icon: Rocket,
    color: 'border-profit/30', grad: 'from-profit to-emerald-600',
    popular: true,
    features: ['1:200 leverage', '10% spread discount', 'Copy trading', 'Basic signals', '$100 bonus'],
    excluded: ['Trading bots'],
    cta: 'Deposit $1,000', ctaLink: '/auth/signup?tier=pro',
  },
  {
    name: 'VIP', deposit: '$5,000+', icon: Diamond,
    color: 'border-purple-500/30', grad: 'from-purple-500 to-pink-600',
    popular: false,
    features: ['Unlimited leverage', '50% spread discount', 'Unlimited bots', 'Personal manager', '$500 bonus'],
    excluded: [],
    cta: 'Deposit $5,000', ctaLink: '/auth/signup?tier=vip',
  },
];

export default function PricingPreview() {
  const router = useRouter();

  return (
    <section className="relative py-20 md:py-28 border-y border-white/[0.04] bg-obsidian/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.15em] mb-3">Deposit-Based Tiers</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Unlock Features with Your{' '}
            <span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent">First Deposit</span>
          </h2>
          <p className="text-sm text-slate-400 mt-3 max-w-lg mx-auto">No monthly fees. Your tier is determined by your deposit amount. Upgrade anytime.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-profit to-emerald-500 rounded-full text-void text-[10px] font-bold uppercase tracking-wider z-10">
                  Most Popular
                </div>
              )}
              <div className={`h-full flex flex-col p-5 bg-[#0a0a0f]/80 border ${t.color} rounded-2xl ${t.popular ? 'ring-1 ring-profit/30' : ''}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.grad} flex items-center justify-center`}>
                    <t.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">Min. Deposit</p>
                  </div>
                </div>

                <p className="text-3xl font-bold text-white font-mono mb-4">{t.deposit}</p>

                <div className="flex-1 space-y-2 mb-5">
                  {t.features.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </div>
                  ))}
                  {t.excluded.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2 opacity-40">
                      <X className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-500">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push(t.ctaLink)}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    t.popular
                      ? 'bg-gradient-to-r from-profit to-emerald-500 text-void hover:shadow-lg hover:shadow-profit/20'
                      : 'bg-white/[0.05] text-white border border-white/[0.08] hover:bg-white/[0.08]'
                  }`}
                >
                  {t.cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/pricing" className="group inline-flex items-center gap-2 text-sm text-gold hover:text-gold/80 font-medium transition-colors">
            Compare all tiers in detail <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
