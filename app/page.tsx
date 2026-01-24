import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import LiveTicker from '@/components/LiveTicker';
import MarketsSection from '@/components/MarketsSection';
import CopyTradingSection from '@/components/CopyTradingSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="relative">
      <Navigation />
      <Hero />
      <LiveTicker />
      <MarketsSection />
      <CopyTradingSection />
      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
