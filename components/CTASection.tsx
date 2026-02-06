'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Gift, Zap, Users } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function CTASection() {
  const router = useRouter();
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 40, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
    } else {
      router.push('/auth/signup');
    }
  };

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-void" />
      
      {/* Grid */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 60%)',
        }}
      />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 217, 165, 0.1) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={contentRef}
          className="relative bg-gradient-to-br from-charcoal via-slate to-charcoal rounded-3xl p-8 md:p-16 border border-gold/20 overflow-hidden"
        >
          {/* Inner Glow */}
          <div className="absolute inset-0 shadow-inner-glow" />
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.4) 0%, transparent 60%)',
            }}
          />

          <div className="relative z-10 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/30 mb-8">
              <Gift className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Limited Time Offer</span>
            </div>

            {/* Heading */}
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mb-6">
              Start Trading with
              <br />
              <span className="gradient-text-gold">$100 Bonus</span>
            </h2>

            <p className="max-w-2xl mx-auto text-lg text-cream/60 mb-12">
              Open your free account today and receive a $100 welcome bonus. 
              No deposit required. Start trading in under 5 minutes.
            </p>

            {/* Features */}
            <div className="flex flex-wrap items-center justify-center gap-8 mb-12">
              <div className="flex items-center gap-2 text-cream/70">
                <Zap className="w-5 h-5 text-gold" />
                <span>Instant verification</span>
              </div>
              <div className="flex items-center gap-2 text-cream/70">
                <Gift className="w-5 h-5 text-profit" />
                <span>$100 welcome bonus</span>
              </div>
              <div className="flex items-center gap-2 text-cream/70">
                <Users className="w-5 h-5 text-electric" />
                <span>Automated trading bots</span>
              </div>
            </div>

            {/* Email Signup */}
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 bg-void/50 border border-cream/20 rounded-full px-6 py-4 text-cream placeholder-cream/40 focus:border-gold focus:outline-none transition-colors"
                />
                <button type="submit" className="btn-primary whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </button>
              </div>
              <p className="text-cream/40 text-xs mt-4">
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
