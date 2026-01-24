'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Bitcoin, DollarSign, TrendingUp, Users, ArrowRight, Sparkles } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const markets = [
  {
    id: 'crypto',
    icon: Bitcoin,
    title: 'Cryptocurrency',
    subtitle: '200+ Coins',
    description: 'Trade Bitcoin, Ethereum, and 200+ altcoins with deep liquidity. 24/7 markets, instant execution, and the tightest spreads in the industry.',
    features: ['Zero commission', 'Leverage up to 1:100', 'Cold storage security'],
    gradient: 'from-orange-500 to-yellow-500',
    accentColor: 'text-orange-400',
  },
  {
    id: 'forex',
    icon: DollarSign,
    title: 'Forex Trading',
    subtitle: '80+ Pairs',
    description: 'Access the $6.6 trillion daily forex market. Trade major, minor, and exotic pairs with institutional-grade spreads.',
    features: ['Spreads from 0.0 pips', 'Leverage up to 1:500', 'No requotes'],
    gradient: 'from-emerald-500 to-cyan-500',
    accentColor: 'text-emerald-400',
  },
  {
    id: 'stocks',
    icon: TrendingUp,
    title: 'Stock Trading',
    subtitle: '5,000+ Stocks',
    description: 'Invest in global equities from NYSE, NASDAQ, LSE, and more. Fractional shares available starting from just $1.',
    features: ['Fractional shares', 'No minimum deposit', 'Real-time data'],
    gradient: 'from-blue-500 to-purple-500',
    accentColor: 'text-blue-400',
  },
  {
    id: 'copy',
    icon: Users,
    title: 'Copy Trading',
    subtitle: 'Top Traders',
    description: 'Automatically replicate strategies from proven traders. Set your risk parameters and let the experts trade for you.',
    features: ['1-click copy', 'Full transparency', 'Risk controls'],
    gradient: 'from-purple-500 to-pink-500',
    accentColor: 'text-purple-400',
  },
];

export default function MarketsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate cards on scroll
      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 80%',
              end: 'bottom 20%',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="markets" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.2) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cream/5 border border-cream/10 mb-6">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-cream/70 text-sm">Multiple Markets</span>
          </div>
          
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mb-6">
            One Platform,
            <br />
            <span className="gradient-text-gold">Endless Possibilities</span>
          </h2>
          
          <p className="max-w-2xl mx-auto text-lg text-cream/60">
            Trade across multiple asset classes with a single account. 
            Diversify your portfolio and seize opportunities wherever they arise.
          </p>
        </div>

        {/* Market Cards Grid */}
        <div ref={cardsRef} className="grid md:grid-cols-2 gap-6">
          {markets.map((market) => {
            const Icon = market.icon;
            return (
              <div
                key={market.id}
                className="group card-glow p-8 transition-all duration-500 hover:scale-[1.02]"
              >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${market.gradient} p-0.5 mb-6`}>
                  <div className="w-full h-full rounded-2xl bg-charcoal flex items-center justify-center">
                    <Icon className={`w-6 h-6 ${market.accentColor}`} />
                  </div>
                </div>

                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-2xl text-cream group-hover:text-gold transition-colors">
                      {market.title}
                    </h3>
                    <p className={`text-sm ${market.accentColor}`}>{market.subtitle}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-cream/30 group-hover:text-gold group-hover:translate-x-1 transition-all" />
                </div>

                {/* Description */}
                <p className="text-cream/60 mb-6 leading-relaxed">
                  {market.description}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {market.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 text-xs text-cream/70 bg-cream/5 rounded-full border border-cream/10"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <button className="btn-outline-gold">
            Explore All Markets
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
}
