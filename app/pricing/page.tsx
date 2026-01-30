'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Zap,
  Rocket,
  Crown,
  Diamond,
  Users,
  Shield,
  TrendingUp,
  ArrowRight,
  HelpCircle,
  Star,
  Bot,
  Signal,
  Wallet,
  Clock,
  Award
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuthStore } from '@/lib/store';

// Deposit-based pricing tiers
const pricingTiers = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Explore the platform for free',
    depositRequired: 0,
    depositLabel: 'Free',
    icon: Users,
    color: 'from-slate-500 to-slate-600',
    borderColor: 'border-slate-500/20',
    popular: false,
    features: [
      { text: 'View all trading platforms', included: true },
      { text: 'Trading Academy access', included: true },
      { text: 'Paper trading mode', included: true },
      { text: 'Market news & analysis', included: true },
      { text: 'Community forum access', included: true },
      { text: 'Live trading', included: false },
      { text: 'Copy trading', included: false },
      { text: 'Trading bots', included: false },
      { text: 'Trading signals', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Get Started Free',
    ctaLink: '/auth/signup?tier=basic',
    highlights: [],
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Begin your trading journey',
    depositRequired: 500,
    depositLabel: '$500',
    icon: Zap,
    color: 'from-blue-500 to-blue-600',
    borderColor: 'border-blue-500/20',
    popular: false,
    features: [
      { text: 'All Basic features', included: true },
      { text: 'Live Crypto trading', included: true },
      { text: 'Live Forex trading', included: true },
      { text: 'Live Stock trading', included: true },
      { text: 'Up to 1:100 leverage', included: true },
      { text: 'Standard spreads', included: true },
      { text: 'Email support', included: true },
      { text: 'Copy trading', included: false },
      { text: 'Trading bots', included: false },
      { text: 'Personal manager', included: false },
    ],
    cta: 'Deposit $500',
    ctaLink: '/auth/signup?tier=starter&redirect=/dashboard/wallet',
    highlights: ['$50 welcome bonus'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Advanced trading features',
    depositRequired: 1000,
    depositLabel: '$1,000',
    icon: Rocket,
    color: 'from-profit to-emerald-600',
    borderColor: 'border-profit/30',
    popular: true,
    features: [
      { text: 'All Starter features', included: true },
      { text: 'Up to 1:200 leverage', included: true },
      { text: '10% spread discount', included: true },
      { text: 'Copy trading access', included: true },
      { text: 'Basic trading signals', included: true },
      { text: 'Live chat support', included: true },
      { text: 'Fast withdrawals', included: true },
      { text: 'Trading bots', included: false },
      { text: 'Premium signals', included: false },
      { text: 'Personal manager', included: false },
    ],
    cta: 'Deposit $1,000',
    ctaLink: '/auth/signup?tier=pro&redirect=/dashboard/wallet',
    highlights: ['$100 welcome bonus', 'Copy trading'],
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Professional trading suite',
    depositRequired: 2500,
    depositLabel: '$2,500',
    icon: Crown,
    color: 'from-gold to-yellow-600',
    borderColor: 'border-gold/30',
    popular: false,
    features: [
      { text: 'All Pro features', included: true },
      { text: 'Up to 1:500 leverage', included: true },
      { text: '25% spread discount', included: true },
      { text: '2 Auto-trading bots', included: true },
      { text: 'Premium signals', included: true },
      { text: 'Priority support', included: true },
      { text: 'Fast withdrawals', included: true },
      { text: 'Personal manager', included: false },
      { text: 'VIP events', included: false },
      { text: 'Unlimited bots', included: false },
    ],
    cta: 'Deposit $2,500',
    ctaLink: '/auth/signup?tier=elite&redirect=/dashboard/wallet',
    highlights: ['$250 welcome bonus', '2 Trading bots'],
  },
  {
    id: 'vip',
    name: 'VIP',
    description: 'Ultimate trading experience',
    depositRequired: 5000,
    depositLabel: '$5,000+',
    icon: Diamond,
    color: 'from-purple-500 to-pink-600',
    borderColor: 'border-purple-500/30',
    popular: false,
    features: [
      { text: 'All Elite features', included: true },
      { text: 'Unlimited leverage', included: true },
      { text: '50% spread discount', included: true },
      { text: 'Unlimited trading bots', included: true },
      { text: 'VIP-only signals', included: true },
      { text: 'Instant withdrawals', included: true },
      { text: 'Personal account manager', included: true },
      { text: 'VIP events & insights', included: true },
      { text: 'IPO access', included: true },
      { text: 'Concierge service', included: true },
    ],
    cta: 'Deposit $5,000',
    ctaLink: '/auth/signup?tier=vip&redirect=/dashboard/wallet',
    highlights: ['$500 welcome bonus', 'Personal manager', 'Unlimited bots'],
  },
];

// Comparison table features
const comparisonFeatures = [
  { name: 'Minimum Deposit', basic: 'Free', starter: '$500', pro: '$1,000', elite: '$2,500', vip: '$5,000+' },
  { name: 'Welcome Bonus', basic: '—', starter: '$50', pro: '$100', elite: '$250', vip: '$500' },
  { name: 'Live Trading', basic: '❌', starter: '✓', pro: '✓', elite: '✓', vip: '✓' },
  { name: 'Max Leverage', basic: '—', starter: '1:100', pro: '1:200', elite: '1:500', vip: 'Unlimited' },
  { name: 'Spread Discount', basic: '—', starter: '0%', pro: '10%', elite: '25%', vip: '50%' },
  { name: 'Copy Trading', basic: '❌', starter: '❌', pro: '✓', elite: '✓', vip: '✓' },
  { name: 'Trading Bots', basic: '❌', starter: '❌', pro: '❌', elite: '2 bots', vip: 'Unlimited' },
  { name: 'Trading Signals', basic: '❌', starter: '❌', pro: 'Basic', elite: 'Premium', vip: 'VIP-only' },
  { name: 'Support', basic: 'FAQ', starter: 'Email', pro: 'Live Chat', elite: 'Priority', vip: 'Personal Manager' },
  { name: 'Withdrawals', basic: '—', starter: 'Standard', pro: 'Fast', elite: 'Fast', vip: 'Instant' },
];

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');

  const handleGetStarted = (tier: typeof pricingTiers[0]) => {
    if (tier.id === 'basic') {
      // Basic tier goes to signup
      router.push('/auth/signup');
    } else if (isAuthenticated) {
      // Logged in users go directly to wallet with tier and amount info
      router.push(`/dashboard/wallet?tier=${tier.id}&amount=${tier.depositRequired}`);
    } else {
      // Not logged in - go to signup with redirect to wallet
      const baseUrl = `/auth/signup?tier=${tier.id}&redirect=/dashboard/wallet&amount=${tier.depositRequired}`;
      if (email) {
        router.push(`${baseUrl}&email=${encodeURIComponent(email)}`);
      } else {
        router.push(baseUrl);
      }
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full mb-6">
              <Award className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Deposit-Based Tiers</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Unlock Trading Features
              <br />
              <span className="gradient-text-gold">With Your Deposit</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Your membership tier is determined by your total deposit. 
              Deposit more to unlock advanced features, better spreads, and exclusive benefits.
            </p>
          </div>

          {/* How It Works */}
          <div className="mb-16 p-6 bg-white/5 rounded-2xl border border-white/10">
            <h2 className="text-xl font-bold text-cream mb-6 text-center">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: 1, title: 'Sign Up Free', desc: 'Create your account and explore the platform', icon: Users },
                { step: 2, title: 'Make a Deposit', desc: 'Deposit via crypto, card, or bank transfer', icon: Wallet },
                { step: 3, title: 'Get Your Tier', desc: 'Your tier is set based on deposit amount', icon: Award },
                { step: 4, title: 'Start Trading', desc: 'Enjoy features unlocked for your tier', icon: TrendingUp },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-7 h-7 text-gold" />
                  </div>
                  <div className="text-xs text-gold mb-1">Step {item.step}</div>
                  <h3 className="text-cream font-medium text-sm">{item.title}</h3>
                  <p className="text-xs text-cream/50 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Email Capture */}
          <div className="mb-12 max-w-md mx-auto">
            <label className="block text-sm text-cream/70 mb-2 text-center">
              Enter your email to get started
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
              />
            </div>
            <p className="text-xs text-cream/40 mt-2 text-center">
              We'll send you trading tips and updates. Unsubscribe anytime.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-5 rounded-2xl border ${tier.borderColor} ${
                  tier.popular 
                    ? 'bg-gradient-to-b from-profit/10 to-transparent ring-2 ring-profit/30' 
                    : 'bg-white/5'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-profit text-void text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-3`}>
                  <tier.icon className="w-5 h-5 text-white" />
                </div>

                <h3 className="text-lg font-bold text-cream mb-0.5">{tier.name}</h3>
                <p className="text-xs text-cream/50 mb-3">{tier.description}</p>

                <div className="mb-4">
                  <span className="text-2xl font-bold text-cream">{tier.depositLabel}</span>
                  {tier.depositRequired > 0 && (
                    <span className="text-cream/50 text-xs ml-1">min deposit</span>
                  )}
                </div>

                {/* Highlights */}
                {tier.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tier.highlights.map((highlight, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gold/20 text-gold text-xs rounded-full">
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}

                <ul className="space-y-1.5 mb-4">
                  {tier.features.slice(0, 6).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      {feature.included ? (
                        <Check className="w-3 h-3 text-profit flex-shrink-0" />
                      ) : (
                        <X className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-cream/80' : 'text-cream/30'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleGetStarted(tier)}
                  className={`block w-full py-2.5 text-center text-sm font-semibold rounded-xl transition-all ${
                    tier.popular
                      ? 'bg-profit text-void hover:bg-profit/90'
                      : tier.id === 'basic'
                        ? 'bg-white/10 text-cream hover:bg-white/20'
                        : 'bg-gold text-void hover:bg-gold/90'
                  }`}
                >
                  {tier.cta}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden mb-16">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-cream">Feature Comparison</h2>
              <p className="text-sm text-cream/50 mt-1">See what's included in each tier</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-cream/50 font-medium">Feature</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Basic</th>
                    <th className="text-center p-4 text-blue-400 font-medium">Starter</th>
                    <th className="text-center p-4 text-profit font-medium">Pro</th>
                    <th className="text-center p-4 text-gold font-medium">Elite</th>
                    <th className="text-center p-4 text-purple-400 font-medium">VIP</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-cream/70 text-sm">{feature.name}</td>
                      <td className="p-4 text-center text-cream/50 text-sm">{feature.basic}</td>
                      <td className="p-4 text-center text-cream/70 text-sm">{feature.starter}</td>
                      <td className="p-4 text-center text-cream text-sm">{feature.pro}</td>
                      <td className="p-4 text-center text-cream font-medium text-sm">{feature.elite}</td>
                      <td className="p-4 text-center text-cream font-medium text-sm">{feature.vip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-cream mb-8 text-center">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {[
                { 
                  q: 'How do I upgrade my tier?', 
                  a: 'Simply make an additional deposit. Your tier is automatically upgraded based on your total deposits.' 
                },
                { 
                  q: 'Can I withdraw and keep my tier?', 
                  a: 'Your tier is based on total deposits. Withdrawals don\'t affect your tier status.' 
                },
                { 
                  q: 'How do I receive my welcome bonus?', 
                  a: 'Welcome bonuses are credited to your trading account within 24 hours of your deposit being confirmed.' 
                },
                { 
                  q: 'What payment methods are accepted?', 
                  a: 'We accept cryptocurrency (BTC, ETH, USDT), credit/debit cards, and bank transfers.' 
                },
                { 
                  q: 'How long do deposits take?', 
                  a: 'Crypto deposits are instant. Card deposits take 1-3 minutes. Bank transfers take 1-3 business days.' 
                },
                { 
                  q: 'Is there a monthly fee?', 
                  a: 'No monthly fees! Your tier is based solely on your deposit amount. One deposit unlocks lifetime benefits.' 
                },
              ].map((faq, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-cream font-medium mb-1">{faq.q}</h3>
                      <p className="text-sm text-cream/60">{faq.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-gold/10 to-profit/10 rounded-2xl border border-gold/20 p-10">
            <h2 className="text-2xl font-bold text-cream mb-4">Ready to Start Trading?</h2>
            <p className="text-cream/60 mb-6 max-w-xl mx-auto">
              Create your free account and explore the platform. When you're ready, deposit to unlock trading features.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
              >
                Start Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/academy"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
              >
                Learn to Trade First
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
