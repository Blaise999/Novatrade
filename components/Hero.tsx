'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Shield, Zap, TrendingUp } from 'lucide-react';
import { gsap } from 'gsap';
import { platformStats } from '@/lib/data';
import { formatCompactNumber } from '@/lib/utils';

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial states
      gsap.set([titleRef.current, subtitleRef.current, ctaRef.current, statsRef.current], {
        opacity: 0,
        y: 60,
      });

      gsap.set(glowRef.current, {
        scale: 0.8,
        opacity: 0,
      });

      // Animation timeline
      const tl = gsap.timeline({ delay: 0.3 });

      // Glow animation
      tl.to(glowRef.current, {
        scale: 1,
        opacity: 1,
        duration: 1.5,
        ease: 'power2.out',
      });

      // Title animation
      tl.to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
      }, '-=1');

      // Subtitle animation
      tl.to(subtitleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.6');

      // CTA animation
      tl.to(ctaRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.4');

      // Stats animation
      tl.to(statsRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.4');

      // Floating glow animation
      gsap.to(glowRef.current, {
        y: -20,
        duration: 4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

    }, heroRef);

    return () => ctx.revert();
  }, []);

  const stats = [
    { label: 'Active Traders', value: formatCompactNumber(platformStats.totalUsers), suffix: '+' },
    { label: 'Trading Volume', value: '$847B', suffix: '+' },
    { label: 'Countries', value: '180', suffix: '+' },
    { label: 'Uptime', value: '99.99', suffix: '%' },
  ];

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-void" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      
      {/* Gradient Orbs */}
      <div 
        ref={glowRef}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 40%, transparent 70%)',
        }}
      />
      
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
        }}
      />
      
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(0, 217, 165, 0.3) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-8 animate-fade-in">
            <div className="pulse-dot" />
            <span className="text-gold text-sm font-medium">Live Markets • 24/7 Trading</span>
          </div>

          {/* Main Title */}
          <h1 
            ref={titleRef}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-cream leading-[0.95] mb-8"
          >
            Trade Without
            <br />
            <span className="gradient-text-gold">Limits</span>
          </h1>

          {/* Subtitle */}
          <p 
            ref={subtitleRef}
            className="max-w-2xl mx-auto text-xl md:text-2xl text-cream/60 leading-relaxed mb-12"
          >
            Access global markets with institutional-grade tools. 
            Crypto, Forex, Stocks — all in one powerful platform.
          </p>

          {/* CTA Buttons */}
          <div ref={ctaRef} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/auth/signup" className="btn-primary group">
              <span className="flex items-center gap-2">
                Start Trading Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            
            <Link href="/academy" className="btn-secondary group flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                <Play className="w-4 h-4 text-gold ml-0.5" />
              </div>
              Watch Demo
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 mb-16">
            <div className="flex items-center gap-2 text-cream/50">
              <Shield className="w-5 h-5 text-profit" />
              <span className="text-sm">Bank-grade Security</span>
            </div>
            <div className="flex items-center gap-2 text-cream/50">
              <Zap className="w-5 h-5 text-gold" />
              <span className="text-sm">0.001s Execution</span>
            </div>
            <div className="flex items-center gap-2 text-cream/50">
              <TrendingUp className="w-5 h-5 text-electric" />
              <span className="text-sm">200+ Assets</span>
            </div>
          </div>

          {/* Stats */}
          <div 
            ref={statsRef}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <div 
                key={stat.label}
                className="text-center"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="stat-value">
                  {stat.value}
                  <span className="text-gold">{stat.suffix}</span>
                </div>
                <div className="text-cream/50 text-sm mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-void to-transparent" />
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: '1.5s' }}>
        <span className="text-cream/30 text-xs uppercase tracking-widest">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-gold to-transparent" />
      </div>
    </section>
  );
}
