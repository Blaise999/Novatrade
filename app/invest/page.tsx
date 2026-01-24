'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Coins,
  Users,
  Bot,
  ArrowRight,
  Shield,
  Percent,
  Clock
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const investOptions = [
  {
    title: 'Investment Plans',
    description: 'Fixed ROI plans with guaranteed returns. Perfect for passive income.',
    reward: 'Up to 35% ROI',
    icon: TrendingUp,
    color: 'from-gold to-yellow-600',
    href: '/invest/plans',
    features: ['Capital Protected', 'Daily Payouts', 'Flexible Terms'],
  },
  {
    title: 'Crypto Staking',
    description: 'Stake your crypto assets and earn passive income with high APY rates.',
    reward: 'Up to 95% APY',
    icon: Coins,
    color: 'from-electric to-blue-600',
    href: '/invest/staking',
    features: ['Auto-Compound', 'Multiple Tokens', 'Flexible Lock'],
  },
  {
    title: 'Copy Trading',
    description: 'Automatically copy trades from top-performing traders on the platform.',
    reward: 'Mirror Expert Trades',
    icon: Users,
    color: 'from-profit to-emerald-600',
    href: '/dashboard/copy-trading',
    features: ['Top Traders', 'Set & Forget', 'Risk Control'],
  },
  {
    title: 'Auto-Trading Bots',
    description: 'Let AI-powered bots trade for you 24/7 with proven strategies.',
    reward: 'Automated Profits',
    icon: Bot,
    color: 'from-purple-500 to-pink-600',
    href: '/invest/bots',
    features: ['AI-Powered', '24/7 Trading', 'Low Risk Options'],
  },
];

export default function InvestPage() {
  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full mb-6">
              <TrendingUp className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Grow Your Wealth</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Smart Investment
              <br />
              <span className="gradient-text-gold">Solutions</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Choose from multiple investment options designed for all risk levels. 
              From guaranteed returns to high-yield staking opportunities.
            </p>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 mb-16">
            {[
              { icon: Shield, text: 'Capital Protected', color: 'text-profit' },
              { icon: Percent, text: 'High Returns', color: 'text-gold' },
              { icon: Clock, text: 'Flexible Terms', color: 'text-electric' },
            ].map((badge, index) => (
              <div key={index} className="flex items-center gap-2 text-cream/60">
                <badge.icon className={`w-5 h-5 ${badge.color}`} />
                <span className="text-sm">{badge.text}</span>
              </div>
            ))}
          </div>

          {/* Invest Options Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {investOptions.map((option, index) => (
              <motion.div
                key={option.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={option.href}
                  className="block p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-all group h-full"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center mb-4`}>
                    <option.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-cream mb-2">{option.title}</h3>
                  <p className="text-cream/60 mb-4">{option.description}</p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {option.features.map((feature, i) => (
                      <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-cream/70">
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-profit font-bold">{option.reward}</span>
                    <span className="flex items-center gap-1 text-gold group-hover:translate-x-1 transition-transform">
                      Get Started
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Stats */}
          <div className="bg-gradient-to-r from-gold/10 to-electric/10 rounded-2xl border border-gold/20 p-8 text-center">
            <h2 className="text-2xl font-bold text-cream mb-6">Platform Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <p className="text-3xl font-bold text-gold">$847M+</p>
                <p className="text-cream/50 text-sm">Total Invested</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-profit">$125M+</p>
                <p className="text-cream/50 text-sm">Profits Distributed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-electric">45,000+</p>
                <p className="text-cream/50 text-sm">Active Investors</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-cream">99.9%</p>
                <p className="text-cream/50 text-sm">Payout Rate</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Start Investing Today
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
