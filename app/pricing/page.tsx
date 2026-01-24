'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Zap,
  Crown,
  Rocket,
  Star,
  Shield,
  TrendingUp,
  Users,
  Bot,
  LineChart,
  Gift,
  ArrowRight
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for beginners',
    price: 0,
    period: 'forever',
    icon: Star,
    color: 'from-slate-500 to-slate-600',
    borderColor: 'border-slate-500/20',
    popular: false,
    features: [
      { text: 'Crypto Trading', included: true },
      { text: 'Basic Forex (5 pairs)', included: true },
      { text: '$100 Welcome Bonus', included: true },
      { text: 'Standard Spreads', included: true },
      { text: 'Email Support', included: true },
      { text: 'Stock Trading', included: false },
      { text: 'Copy Trading', included: false },
      { text: 'Auto-Trading Bots', included: false },
      { text: 'Priority Support', included: false },
      { text: 'Advanced Analytics', included: false },
    ],
    cta: 'Start Free',
    ctaLink: '/auth/signup',
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'For active traders',
    price: 29,
    period: 'month',
    icon: Zap,
    color: 'from-electric to-blue-600',
    borderColor: 'border-electric/20',
    popular: false,
    features: [
      { text: 'Crypto Trading', included: true },
      { text: 'All Forex Pairs (20+)', included: true },
      { text: '$250 Bonus on Deposit', included: true },
      { text: 'Reduced Spreads', included: true },
      { text: 'Live Chat Support', included: true },
      { text: 'US Stock Trading', included: true },
      { text: 'Basic Copy Trading', included: true },
      { text: 'Auto-Trading Bots', included: false },
      { text: 'Priority Support', included: false },
      { text: 'Advanced Analytics', included: false },
    ],
    cta: 'Get Basic',
    ctaLink: '/auth/signup?plan=basic',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Most popular choice',
    price: 99,
    period: 'month',
    icon: Rocket,
    color: 'from-gold to-yellow-600',
    borderColor: 'border-gold/30',
    popular: true,
    features: [
      { text: 'Unlimited Crypto Trading', included: true },
      { text: 'All Forex & Commodities', included: true },
      { text: '$500 Bonus on Deposit', included: true },
      { text: 'Tight Spreads (0.1 pips)', included: true },
      { text: '24/7 Priority Support', included: true },
      { text: 'Global Stock Access', included: true },
      { text: 'Pro Copy Trading', included: true },
      { text: '3 Auto-Trading Bots', included: true },
      { text: 'Advanced Analytics', included: true },
      { text: 'Trading Signals', included: false },
    ],
    cta: 'Get Pro',
    ctaLink: '/auth/signup?plan=pro',
  },
  {
    id: 'vip',
    name: 'VIP',
    description: 'For serious investors',
    price: 299,
    period: 'month',
    icon: Crown,
    color: 'from-purple-500 to-pink-600',
    borderColor: 'border-purple-500/30',
    popular: false,
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Zero Commission Trading', included: true },
      { text: '$2,000 Bonus on Deposit', included: true },
      { text: 'Raw Spreads (0.0 pips)', included: true },
      { text: 'Dedicated Account Manager', included: true },
      { text: 'IPO Access', included: true },
      { text: 'Unlimited Copy Trading', included: true },
      { text: 'Unlimited Auto-Bots', included: true },
      { text: 'Real-time Trading Signals', included: true },
      { text: 'VIP Events & Insights', included: true },
    ],
    cta: 'Go VIP',
    ctaLink: '/auth/signup?plan=vip',
  },
];

const comparisonFeatures = [
  { name: 'Trading Assets', free: '50+', basic: '100+', pro: '200+', vip: 'Unlimited' },
  { name: 'Max Leverage', free: '1:10', basic: '1:50', pro: '1:200', vip: '1:500' },
  { name: 'Withdrawal Limit', free: '$1K/day', basic: '$10K/day', pro: '$50K/day', vip: 'Unlimited' },
  { name: 'Spread Type', free: 'Standard', basic: 'Reduced', pro: 'Tight', vip: 'Raw' },
  { name: 'Support', free: 'Email', basic: 'Chat', pro: '24/7 Priority', vip: 'Personal Manager' },
  { name: 'Copy Traders', free: '0', basic: '3', pro: '10', vip: 'Unlimited' },
  { name: 'Auto Bots', free: '0', basic: '0', pro: '3', vip: 'Unlimited' },
  { name: 'Trading Signals', free: '❌', basic: '❌', pro: 'Basic', vip: 'Premium' },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const getPrice = (price: number) => {
    if (price === 0) return 0;
    return billingPeriod === 'yearly' ? Math.floor(price * 0.8) : price;
  };

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full mb-6">
              <Crown className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Choose Your Plan</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Investment Plans for
              <br />
              <span className="gradient-text-gold">Every Trader</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              From beginners to institutional traders, we have a plan that fits your trading style and goals.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <span className={`text-sm ${billingPeriod === 'monthly' ? 'text-cream' : 'text-cream/50'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  billingPeriod === 'yearly' ? 'bg-gold' : 'bg-white/20'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${
                  billingPeriod === 'yearly' ? 'left-8' : 'left-1'
                }`} />
              </button>
              <span className={`text-sm ${billingPeriod === 'yearly' ? 'text-cream' : 'text-cream/50'}`}>
                Yearly
                <span className="ml-2 px-2 py-0.5 bg-profit/20 text-profit text-xs rounded-full">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-6 rounded-2xl border ${plan.borderColor} ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-gold/10 to-transparent' 
                    : 'bg-white/5'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gold text-void text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-xl font-bold text-cream mb-1">{plan.name}</h3>
                <p className="text-sm text-cream/50 mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-cream">${getPrice(plan.price)}</span>
                  {plan.price > 0 && (
                    <span className="text-cream/50">/{billingPeriod === 'yearly' ? 'mo' : 'month'}</span>
                  )}
                  {plan.price === 0 && <span className="text-cream/50 ml-2">{plan.period}</span>}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-profit flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-cream/80' : 'text-cream/30'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaLink}
                  className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${
                    plan.popular
                      ? 'bg-gold text-void hover:bg-gold/90'
                      : 'bg-white/10 text-cream hover:bg-white/20'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-cream">Feature Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-cream/50 font-medium">Feature</th>
                    <th className="text-center p-4 text-cream font-medium">Free</th>
                    <th className="text-center p-4 text-cream font-medium">Basic</th>
                    <th className="text-center p-4 text-gold font-medium">Pro</th>
                    <th className="text-center p-4 text-purple-400 font-medium">VIP</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-cream/70">{feature.name}</td>
                      <td className="p-4 text-center text-cream/50">{feature.free}</td>
                      <td className="p-4 text-center text-cream/70">{feature.basic}</td>
                      <td className="p-4 text-center text-cream">{feature.pro}</td>
                      <td className="p-4 text-center text-cream font-medium">{feature.vip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <p className="text-cream/60 mb-4">Not sure which plan is right for you?</p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Start with Free Plan
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
