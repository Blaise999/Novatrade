'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { topTraders, formatPercent } from '@/lib/data';
import { formatCompactNumber } from '@/lib/utils';
import { Users, TrendingUp, Shield, Copy, CheckCircle, Star, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const riskLabels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
const riskColors = ['text-emerald-400', 'text-green-400', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

export default function CopyTradingSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const tradersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = tradersRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: tradersRef.current,
              start: 'top 85%',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="copy-trading" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-void via-charcoal to-void" />
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* Accent Glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(0, 217, 165, 0.3) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-profit/10 border border-profit/20 mb-6">
              <Copy className="w-4 h-4 text-profit" />
              <span className="text-profit text-sm">Copy Trading</span>
            </div>
            
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mb-6">
              Copy the
              <br />
              <span className="gradient-text-profit">Best Traders</span>
            </h2>
            
            <p className="text-lg text-cream/60 mb-8 leading-relaxed">
              Don&apos;t have time to trade? Let our top performers do it for you. 
              Automatically mirror their trades with customizable risk settings.
            </p>

            {/* Features */}
            <div className="space-y-4">
              {[
                { icon: Users, text: '500+ verified traders to follow' },
                { icon: Shield, text: 'Set your own risk limits' },
                { icon: TrendingUp, text: 'Real-time performance tracking' },
              ].map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-profit/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-profit" />
                    </div>
                    <span className="text-cream/80">{feature.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Card */}
          <div className="card-glow p-8">
            <h3 className="text-cream/50 text-sm uppercase tracking-wider mb-6">Platform Statistics</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="font-display text-4xl text-cream mb-1">$2.4B</div>
                <div className="text-cream/50 text-sm">Total Copied Volume</div>
              </div>
              <div>
                <div className="font-display text-4xl text-profit mb-1">847%</div>
                <div className="text-cream/50 text-sm">Top Trader Return</div>
              </div>
              <div>
                <div className="font-display text-4xl text-cream mb-1">520K</div>
                <div className="text-cream/50 text-sm">Active Copiers</div>
              </div>
              <div>
                <div className="font-display text-4xl text-gold mb-1">78%</div>
                <div className="text-cream/50 text-sm">Avg Win Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Traders Grid */}
        <div className="mb-8">
          <h3 className="font-display text-2xl text-cream mb-2">Top Performing Traders</h3>
          <p className="text-cream/50">This month&apos;s best performers</p>
        </div>

        <div ref={tradersRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topTraders.slice(0, 3).map((trader) => (
            <div
              key={trader.id}
              className="group card-dark p-6 transition-all duration-500 hover:border-gold/30"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="relative">
                  <Image
                    src={trader.avatar}
                    alt={trader.name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                  {trader.verified && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-profit rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-void" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-cream group-hover:text-gold transition-colors">
                    {trader.name}
                  </h4>
                  <div className="flex items-center gap-1 text-sm text-cream/50">
                    <Users className="w-3 h-3" />
                    <span>{formatCompactNumber(trader.followers)} followers</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-cream/10">
                <div>
                  <div className="text-2xl font-semibold text-profit">
                    +{trader.totalReturn.toFixed(1)}%
                  </div>
                  <div className="text-xs text-cream/40">Total Return</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-cream">
                    {trader.winRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-cream/40">Win Rate</div>
                </div>
                <div>
                  <div className={`text-2xl font-semibold ${riskColors[trader.riskScore - 1]}`}>
                    {trader.riskScore}/5
                  </div>
                  <div className="text-xs text-cream/40">Risk</div>
                </div>
              </div>

              {/* Assets */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cream/40">Trading:</span>
                  <div className="flex gap-1">
                    {trader.assets.map((asset) => (
                      <span
                        key={asset}
                        className="px-2 py-0.5 text-xs bg-cream/5 rounded text-cream/70"
                      >
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bio */}
              <p className="text-sm text-cream/50 mb-6 line-clamp-2">
                {trader.bio}
              </p>

              {/* CTA */}
              <button className="w-full btn-outline-gold text-sm">
                <Copy className="w-4 h-4 mr-2" />
                Copy Trader
              </button>
            </div>
          ))}
        </div>

        {/* View All */}
        <div className="text-center mt-12">
          <button className="btn-secondary">
            View All Traders
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
}
