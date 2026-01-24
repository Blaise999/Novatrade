'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Coins,
  Lock,
  Unlock,
  TrendingUp,
  Clock,
  Shield,
  ArrowRight,
  Calculator,
  CheckCircle,
  Info,
  AlertCircle,
  Wallet
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const stakingPools = [
  {
    id: 'nova',
    token: 'NOVA',
    name: 'NOVA Token',
    icon: '🌟',
    apy: 45,
    tvl: 12500000,
    minStake: 100,
    lockPeriods: [
      { days: 30, bonus: 0, apy: 45 },
      { days: 90, bonus: 10, apy: 55 },
      { days: 180, bonus: 25, apy: 70 },
      { days: 365, bonus: 50, apy: 95 },
    ],
    features: ['Auto-compounding', 'No minimum lock', 'Instant rewards'],
  },
  {
    id: 'btc',
    token: 'BTC',
    name: 'Bitcoin',
    icon: '₿',
    apy: 8,
    tvl: 45000000,
    minStake: 0.001,
    lockPeriods: [
      { days: 30, bonus: 0, apy: 8 },
      { days: 90, bonus: 1, apy: 9 },
      { days: 180, bonus: 2, apy: 10 },
      { days: 365, bonus: 4, apy: 12 },
    ],
    features: ['Secured by insurance', 'Daily payouts', 'Flexible withdrawal'],
  },
  {
    id: 'eth',
    token: 'ETH',
    name: 'Ethereum',
    icon: 'Ξ',
    apy: 12,
    tvl: 32000000,
    minStake: 0.01,
    lockPeriods: [
      { days: 30, bonus: 0, apy: 12 },
      { days: 90, bonus: 2, apy: 14 },
      { days: 180, bonus: 4, apy: 16 },
      { days: 365, bonus: 8, apy: 20 },
    ],
    features: ['ETH 2.0 rewards', 'Compound daily', 'No fees'],
  },
  {
    id: 'usdt',
    token: 'USDT',
    name: 'Tether USD',
    icon: '₮',
    apy: 15,
    tvl: 28000000,
    minStake: 50,
    lockPeriods: [
      { days: 30, bonus: 0, apy: 15 },
      { days: 90, bonus: 3, apy: 18 },
      { days: 180, bonus: 5, apy: 20 },
      { days: 365, bonus: 10, apy: 25 },
    ],
    features: ['Stable returns', 'USD pegged', 'Withdraw anytime'],
  },
];

export default function StakingPage() {
  const [selectedPool, setSelectedPool] = useState(stakingPools[0]);
  const [selectedLock, setSelectedLock] = useState(stakingPools[0].lockPeriods[1]);
  const [stakeAmount, setStakeAmount] = useState(1000);

  const calculateRewards = () => {
    const dailyRate = selectedLock.apy / 365 / 100;
    return stakeAmount * dailyRate * selectedLock.days;
  };

  const totalTVL = stakingPools.reduce((sum, pool) => sum + pool.tvl, 0);

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-electric/10 border border-electric/20 rounded-full mb-6">
              <Coins className="w-4 h-4 text-electric" />
              <span className="text-electric text-sm font-medium">Earn Passive Income</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Stake & Earn
              <br />
              <span className="gradient-text-gold">Up to 95% APY</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Stake your crypto assets and earn passive income with industry-leading APY rates. 
              Flexible lock periods with bonus rewards for longer commitments.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Total Value Locked', value: `$${(totalTVL / 1000000).toFixed(0)}M+` },
              { label: 'Active Stakers', value: '45,000+' },
              { label: 'Rewards Paid', value: '$8.5M+' },
              { label: 'Supported Assets', value: `${stakingPools.length}` },
            ].map((stat, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                <p className="text-2xl font-bold text-gold">{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Pool Selection */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-semibold text-cream mb-4">Select Asset</h2>
              {stakingPools.map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => {
                    setSelectedPool(pool);
                    setSelectedLock(pool.lockPeriods[1]);
                  }}
                  className={`w-full p-4 rounded-xl border transition-all text-left ${
                    selectedPool.id === pool.id
                      ? 'bg-gold/10 border-gold/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">
                      {pool.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-cream font-medium">{pool.token}</span>
                        <span className="text-profit font-bold">{pool.apy}% APY</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-cream/50">{pool.name}</span>
                        <span className="text-cream/50">TVL: ${(pool.tvl / 1000000).toFixed(1)}M</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Staking Calculator */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center text-2xl">
                    {selectedPool.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-cream">Stake {selectedPool.token}</h3>
                    <p className="text-sm text-cream/50">{selectedPool.name}</p>
                  </div>
                </div>

                {/* Lock Period Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-cream/70 mb-3">
                    Lock Period
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedPool.lockPeriods.map((period) => (
                      <button
                        key={period.days}
                        onClick={() => setSelectedLock(period)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          selectedLock.days === period.days
                            ? 'bg-gold/10 border-gold/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="block text-cream font-medium">{period.days} Days</span>
                        <span className="block text-sm text-profit">{period.apy}% APY</span>
                        {period.bonus > 0 && (
                          <span className="block text-xs text-gold">+{period.bonus}% Bonus</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stake Amount */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-cream/70">Stake Amount</label>
                    <span className="text-sm text-cream/50">Min: {selectedPool.minStake} {selectedPool.token}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(Math.max(selectedPool.minStake, parseFloat(e.target.value) || 0))}
                      className="w-full px-4 py-3 pr-20 bg-white/5 border border-white/10 rounded-xl text-cream text-lg focus:outline-none focus:border-gold"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/50">
                      {selectedPool.token}
                    </span>
                  </div>
                </div>

                {/* Results */}
                <div className="p-4 bg-gradient-to-r from-profit/10 to-transparent rounded-xl border border-profit/20 mb-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-cream/50 mb-1">Est. Daily Rewards</p>
                      <p className="text-lg font-bold text-cream">
                        {(calculateRewards() / selectedLock.days).toFixed(4)} {selectedPool.token}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-cream/50 mb-1">Est. Total Rewards</p>
                      <p className="text-lg font-bold text-profit">
                        +{calculateRewards().toFixed(4)} {selectedPool.token}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-cream/50 mb-1">Effective APY</p>
                      <p className="text-lg font-bold text-gold">{selectedLock.apy}%</p>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedPool.features.map((feature, i) => (
                    <span key={i} className="flex items-center gap-1 px-3 py-1 bg-white/5 rounded-full text-sm text-cream/70">
                      <CheckCircle className="w-3 h-3 text-profit" />
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Link
                    href="/auth/signup"
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
                  >
                    <Lock className="w-5 h-5" />
                    Stake Now
                  </Link>
                  <Link
                    href="/dashboard/wallet"
                    className="px-6 py-4 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
                  >
                    <Wallet className="w-5 h-5" />
                  </Link>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-4 bg-electric/10 border border-electric/20 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-electric flex-shrink-0 mt-0.5" />
                <div className="text-sm text-cream/70">
                  <p className="font-medium text-cream mb-1">How Staking Works</p>
                  <p>
                    When you stake your assets, they are locked for the selected period to generate yields. 
                    Longer lock periods offer higher APY rates and bonus rewards. Early unstaking may incur penalties.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-cream mb-8 text-center">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {[
                { q: 'What is staking?', a: 'Staking is the process of locking your crypto assets to earn rewards while supporting the network.' },
                { q: 'When do I receive rewards?', a: 'Rewards are calculated daily and can be claimed or auto-compounded based on your preference.' },
                { q: 'Can I unstake early?', a: 'Yes, but early unstaking may incur a small penalty fee depending on the lock period.' },
                { q: 'Are my funds safe?', a: 'Yes, all staked assets are secured by multi-signature wallets and insurance coverage.' },
              ].map((faq, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <h3 className="text-cream font-medium mb-2">{faq.q}</h3>
                  <p className="text-sm text-cream/60">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
