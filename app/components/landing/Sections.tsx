'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, UserPlus, CreditCard, TrendingUp, ArrowRight, Gift, ShieldCheck } from 'lucide-react';
import { testimonials } from '@/lib/data';

/* ========== TESTIMONIALS ========== */
export function TestimonialsSection() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.15em] mb-3">Testimonials</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Trusted by Traders Worldwide</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="p-6 bg-[#0a0a0f]/80 border border-white/[0.06] rounded-2xl"
            >
              <div className="flex items-center gap-0.5 mb-4">
                {[...Array(t.rating)].map((_, si) => (
                  <Star key={si} className="w-3.5 h-3.5 fill-gold text-gold" />
                ))}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">&ldquo;{t.content}&rdquo;</p>
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-white">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-[10px] text-slate-500">{t.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-profit font-mono">+${t.profit.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-500 uppercase">Profit</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========== HOW IT WORKS ========== */
export function HowItWorksSection() {
  const steps = [
    { step: '01', icon: UserPlus, title: 'Create Account', desc: 'Sign up in 30 seconds with email or Google. Quick KYC takes under 2 minutes.', color: 'from-gold/20 to-gold/5', accent: 'text-gold' },
    { step: '02', icon: CreditCard, title: 'Fund & Unlock', desc: 'Deposit via crypto, card, or bank transfer. Features unlock based on your deposit tier.', color: 'from-emerald-500/20 to-emerald-500/5', accent: 'text-emerald-400' },
    { step: '03', icon: TrendingUp, title: 'Start Trading', desc: 'Trade manually, copy top traders, or deploy AI bots. All markets in one place.', color: 'from-blue-500/20 to-blue-500/5', accent: 'text-blue-400' },
  ];

  return (
    <section className="relative py-20 md:py-28 border-y border-white/[0.04] bg-obsidian/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.15em] mb-3">Getting Started</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Three Steps to Your First Trade</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative text-center"
            >
              <div className="text-7xl font-bold text-white/[0.03] mb-4 select-none font-mono">{s.step}</div>
              <div className={`w-16 h-16 bg-gradient-to-br ${s.color} border border-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-5 -mt-12`}>
                <s.icon className={`w-7 h-7 ${s.accent}`} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-6 w-12">
                  <ArrowRight className="w-5 h-5 text-white/10 mx-auto" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========== FINAL CTA ========== */
export function CTASection() {
  const router = useRouter();

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gold/[0.06] rounded-full blur-[180px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Up to $500 welcome bonus on your first deposit</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5 leading-tight">
            Ready to Trade with{' '}
            <span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent">the Best?</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg mb-10 max-w-xl mx-auto">
            Create your free account in 30 seconds. No credit card required. Start paper trading immediately or fund to go live.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/auth/signup')}
              className="group relative flex items-center justify-center gap-2 px-10 py-4 rounded-xl font-semibold text-black overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-gold via-amber-400 to-gold bg-[length:200%_100%] group-hover:animate-shimmer" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute inset-0 bg-gold/20 blur-xl" />
              </div>
              <span className="relative flex items-center gap-2">
                Create Free Account
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={() => router.push('/pricing')}
              className="flex items-center justify-center gap-2 px-10 py-4 bg-white/[0.03] border border-white/[0.08] text-white font-semibold rounded-xl hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              View All Plans
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4" />
            <span>256-bit SSL · $500M Insurance Fund · Regulated</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
