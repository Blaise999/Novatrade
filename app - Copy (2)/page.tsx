import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import TickerBar from '@/components/landing/TickerBar';
import HeroSection from '@/components/landing/HeroSection';
import StatsSection, { TrustBar } from '@/components/landing/StatsSection';
import MarketPreview from '@/components/landing/MarketPreview';
import FeaturesSection from '@/components/landing/FeaturesSection';
import CopyTradingPreview from '@/components/landing/CopyTradingPreview';
import EarnInvestPreview from '@/components/landing/EarnInvestPreview';
import PricingPreview from '@/components/landing/PricingPreview';
import { TestimonialsSection, HowItWorksSection, CTASection } from '@/components/landing/Sections';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <TickerBar />
      <Navigation />
      <HeroSection />
      <TrustBar />
      <StatsSection />
      <MarketPreview />
      <FeaturesSection />
      <CopyTradingPreview />
      <EarnInvestPreview />
      <HowItWorksSection />
      <PricingPreview />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
