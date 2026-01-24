'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { testimonials, formatLargeNumber } from '@/lib/data';
import { Star, Quote } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 80%',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-void via-charcoal to-void" />
      
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.4) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-6">
            <Star className="w-4 h-4 text-gold fill-gold" />
            <span className="text-gold text-sm">Testimonials</span>
          </div>
          
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mb-6">
            Trusted by
            <br />
            <span className="gradient-text-gold">Millions</span>
          </h2>
          
          <p className="max-w-2xl mx-auto text-lg text-cream/60">
            See what our traders have to say about their experience with NOVATrADE.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div ref={cardsRef} className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="group card-glow p-8 transition-all duration-500"
            >
              {/* Quote Icon */}
              <Quote className="w-10 h-10 text-gold/20 mb-6" />

              {/* Content */}
              <p className="text-cream/80 leading-relaxed mb-8">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Rating */}
              <div className="flex items-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < testimonial.rating ? 'text-gold fill-gold' : 'text-cream/20'
                    }`}
                  />
                ))}
              </div>

              {/* Profit Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-profit/10 rounded-full mb-6">
                <span className="text-profit text-sm font-semibold">
                  +{formatLargeNumber(testimonial.profit)}
                </span>
                <span className="text-cream/50 text-xs">Profit</span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-4 pt-6 border-t border-cream/10">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-cream">{testimonial.name}</div>
                  <div className="text-sm text-cream/50">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="mt-20 text-center">
          <p className="text-cream/40 text-sm mb-8">Trusted by traders worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-40">
            {['Forbes', 'Bloomberg', 'Reuters', 'CNBC', 'CoinDesk'].map((brand) => (
              <span key={brand} className="font-display text-xl text-cream/50">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
