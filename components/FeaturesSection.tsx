'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { 
  Zap, Shield, BarChart3, Smartphone, 
  Clock, Globe, Headphones, Lock,
  ChevronRight
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Zap,
    title: 'Lightning Execution',
    description: 'Execute trades in under 0.001 seconds with our cutting-edge infrastructure.',
    stat: '0.001s',
    statLabel: 'Avg execution',
  },
  {
    icon: Shield,
    title: 'Bank-Grade Security',
    description: 'Your funds are protected with military-grade encryption and cold storage.',
    stat: '$500M',
    statLabel: 'Insurance coverage',
  },
  {
    icon: BarChart3,
    title: 'Advanced Charts',
    description: 'Professional TradingView charts with 100+ indicators and drawing tools.',
    stat: '100+',
    statLabel: 'Indicators',
  },
  {
    icon: Smartphone,
    title: 'Trade Anywhere',
    description: 'Full-featured mobile apps for iOS and Android. Never miss an opportunity.',
    stat: '4.9★',
    statLabel: 'App Store rating',
  },
  {
    icon: Clock,
    title: '24/7 Markets',
    description: 'Crypto markets never sleep. Trade any time, day or night, 365 days a year.',
    stat: '24/7',
    statLabel: 'Trading hours',
  },
  {
    icon: Globe,
    title: 'Global Access',
    description: 'Available in 180+ countries with multi-language support and local payments.',
    stat: '180+',
    statLabel: 'Countries',
  },
  {
    icon: Headphones,
    title: 'Expert Support',
    description: 'Dedicated account managers and 24/7 multilingual customer support.',
    stat: '<2min',
    statLabel: 'Response time',
  },
  {
    icon: Lock,
    title: 'Regulated Platform',
    description: 'Licensed and regulated in multiple jurisdictions for your peace of mind.',
    stat: '5',
    statLabel: 'Licenses',
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const items = featuresRef.current?.children;
      if (items) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: featuresRef.current,
              start: 'top 85%',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Accent */}
      <div className="absolute bottom-0 left-1/4 w-[800px] h-[400px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(ellipse, rgba(99, 102, 241, 0.3) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-electric/10 border border-electric/20 mb-6">
            <Zap className="w-4 h-4 text-electric" />
            <span className="text-electric text-sm">Platform Features</span>
          </div>
          
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mb-6">
            Built for
            <br />
            <span className="text-electric">Performance</span>
          </h2>
          
          <p className="max-w-2xl mx-auto text-lg text-cream/60">
            Every feature designed to give you an edge in the markets. 
            Professional tools made accessible for everyone.
          </p>
        </div>

        {/* Features Grid */}
        <div ref={featuresRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group card-dark p-6 transition-all duration-300 hover:border-cream/20"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-cream/5 flex items-center justify-center mb-4 group-hover:bg-gold/10 transition-colors">
                  <Icon className="w-6 h-6 text-cream/70 group-hover:text-gold transition-colors" />
                </div>

                {/* Content */}
                <h3 className="font-semibold text-cream mb-2 group-hover:text-gold transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-cream/50 mb-4 leading-relaxed">
                  {feature.description}
                </p>

                {/* Stat */}
                <div className="pt-4 border-t border-cream/10">
                  <div className="text-2xl font-display text-gold">{feature.stat}</div>
                  <div className="text-xs text-cream/40">{feature.statLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="mt-20 card-glow p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-display text-3xl md:text-4xl text-cream mb-4">
                Ready to experience the difference?
              </h3>
              <p className="text-cream/60 mb-6">
                Join over 2.8 million traders who trust NOVATrADE for their trading needs.
              </p>
              <button className="btn-primary">
                <span className="flex items-center gap-2">
                  Open Free Account
                  <ChevronRight className="w-5 h-5" />
                </span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center p-4">
                <div className="font-display text-4xl text-gold mb-1">$0</div>
                <div className="text-sm text-cream/50">Account opening</div>
              </div>
              <div className="text-center p-4">
                <div className="font-display text-4xl text-profit mb-1">$1</div>
                <div className="text-sm text-cream/50">Minimum trade</div>
              </div>
              <div className="text-center p-4">
                <div className="font-display text-4xl text-cream mb-1">0%</div>
                <div className="text-sm text-cream/50">Commission crypto</div>
              </div>
              <div className="text-center p-4">
                <div className="font-display text-4xl text-electric mb-1">5min</div>
                <div className="text-sm text-cream/50">To get started</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
