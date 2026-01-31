'use client';

import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import LiveTicker from '@/components/LiveTicker';
import FeaturesSection from '@/components/FeaturesSection';
import MarketsSection from '@/components/MarketsSection';
import CopyTradingSection from '@/components/CopyTradingSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-void">
      <Navigation />
      <Hero />
      <LiveTicker />
      <FeaturesSection />
      <MarketsSection />
      <CopyTradingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
