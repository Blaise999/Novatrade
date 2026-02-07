'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gift, Sparkles, ArrowRight, Coins, Clock, Users } from 'lucide-react';

export default function AirdropBanner() {
  return (
    <section className="relative py-16 md:py-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-gold/10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[120px]" />
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/earn/airdrops" className="block group">
            <div className="relative p-6 sm:p-10 bg-gradient-to-br from-purple-500/10 via-transparent to-gold/10 rounded-3xl border border-purple-500/20 hover:border-gold/30 transition-all overflow-hidden">
              {/* Floating particles */}
              <div className="absolute top-4 right-10 w-2 h-2 bg-gold/40 rounded-full animate-pulse" />
              <div className="absolute top-12 right-24 w-1.5 h-1.5 bg-purple-400/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-8 left-16 w-2 h-2 bg-electric/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

              <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Left */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-full border border-gold/20 mb-4">
                    <Sparkles className="w-3.5 h-3.5 text-gold" />
                    <span className="text-xs font-bold text-gold uppercase tracking-wider">Live Airdrop</span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                    NOVA Token <span className="bg-gradient-to-r from-purple-400 to-gold bg-clip-text text-transparent">Airdrop</span>
                  </h2>
                  <p className="text-sm text-slate-400 max-w-md mb-6">
                    Claim your share of 10,000,000 NOVA tokens + 100 BNB. Complete simple tasks and claim your allocation before the pool runs out.
                  </p>

                  <div className="flex items-center justify-center lg:justify-start gap-2">
                    <span className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-500 to-gold text-white font-bold rounded-xl group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-all">
                      Claim Airdrop
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="px-4 py-3 bg-white/5 text-cream/60 text-sm font-medium rounded-xl border border-white/5">
                      Only $0.10 fee
                    </span>
                  </div>
                </div>

                {/* Right — Stats */}
                <div className="grid grid-cols-3 gap-3 lg:gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <Coins className="w-5 h-5 text-gold mx-auto mb-2" />
                    <p className="text-xl font-bold text-white font-mono">10M</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">NOVA Tokens</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <Gift className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                    <p className="text-xl font-bold text-white font-mono">100</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">BNB Prize</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <Users className="w-5 h-5 text-electric mx-auto mb-2" />
                    <p className="text-xl font-bold text-white font-mono">47K+</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Claimed</p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
