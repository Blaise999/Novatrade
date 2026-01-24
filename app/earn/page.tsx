'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Gift,
  Users,
  Trophy,
  Coins,
  ArrowRight,
  Star,
  Zap
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const earnOptions = [
  {
    title: 'Airdrops',
    description: 'Complete tasks and earn free NOVA tokens. No purchase required!',
    reward: 'Up to 5,000 NOVA',
    icon: Gift,
    color: 'from-profit to-emerald-600',
    href: '/earn/airdrops',
    tag: 'Popular',
  },
  {
    title: 'Referral Program',
    description: 'Invite friends and earn up to 30% lifetime commission on their trades',
    reward: 'Up to 30% Commission',
    icon: Users,
    color: 'from-purple-500 to-pink-600',
    href: '/earn/referral',
    tag: 'High Rewards',
  },
  {
    title: 'Rewards Center',
    description: 'Complete daily tasks, achievements, and challenges to earn bonus rewards',
    reward: 'Daily Bonuses',
    icon: Star,
    color: 'from-gold to-yellow-600',
    href: '/earn/rewards',
    tag: 'Daily',
  },
  {
    title: 'Trading Competitions',
    description: 'Compete with other traders and win from massive prize pools',
    reward: '$50,000+ Prize Pools',
    icon: Trophy,
    color: 'from-electric to-blue-600',
    href: '/earn/competitions',
    tag: 'Limited Time',
  },
];

export default function EarnPage() {
  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-profit/10 border border-profit/20 rounded-full mb-6">
              <Coins className="w-4 h-4 text-profit" />
              <span className="text-profit text-sm font-medium">Multiple Ways to Earn</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Earn Rewards
              <br />
              <span className="gradient-text-gold">Without Trading</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Discover multiple ways to earn on NOVATrADE beyond just trading. 
              From airdrops to referrals, start earning today!
            </p>
          </div>

          {/* Earn Options Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {earnOptions.map((option, index) => (
              <motion.div
                key={option.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={option.href}
                  className="block p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center`}>
                      <option.icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-gold/10 text-gold text-xs font-medium rounded-full">
                      {option.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-cream mb-2">{option.title}</h3>
                  <p className="text-cream/60 mb-4">{option.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-profit font-bold">{option.reward}</span>
                    <span className="flex items-center gap-1 text-gold group-hover:translate-x-1 transition-transform">
                      Learn More
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-gold/10 to-profit/10 rounded-2xl border border-gold/20 p-8 text-center">
            <h2 className="text-2xl font-bold text-cream mb-6">Total Rewards Distributed</h2>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-4xl font-bold text-gold">$5.2M+</p>
                <p className="text-cream/50">Referral Earnings</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-profit">2.5M</p>
                <p className="text-cream/50">NOVA Airdropped</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-electric">$1.8M+</p>
                <p className="text-cream/50">Competition Prizes</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              <Zap className="w-5 h-5" />
              Start Earning Now
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
