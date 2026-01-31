'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Gift,
  Twitter,
  MessageCircle,
  Users,
  CheckCircle,
  Lock,
  Clock,
  Coins,
  Trophy,
  Zap,
  ArrowRight,
  ExternalLink,
  Copy,
  Share2,
  Star,
  Sparkles,
  Wallet,
  Shield
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

// Featured Nova Airdrop
const novaAirdrop = {
  id: 'nova-season1',
  name: 'NOVA Airdrop Season 1',
  description: 'Claim your free NOVA tokens + chance to win BNB! Pay only $0.10 claim fee.',
  reward: '10,000,000',
  currency: 'NOVA',
  bnbPool: '100 BNB',
  status: 'live',
  endsIn: '65 days',
  claimFee: '$0.10 USDC',
  participants: 12847,
  features: [
    'One-click claim with permit',
    'No unlimited approvals',
    '10% chance to win BNB',
    'Bonus for early adopters',
  ],
};

const airdrops = [
  {
    id: 'welcome',
    name: 'Welcome Bonus',
    description: 'Sign up and verify your account to receive your first airdrop',
    reward: 100,
    currency: 'NOVA',
    status: 'active',
    endsIn: null,
    tasks: [
      { id: 1, name: 'Create Account', completed: false, points: 25 },
      { id: 2, name: 'Verify Email', completed: false, points: 25 },
      { id: 3, name: 'Complete KYC', completed: false, points: 50 },
    ],
    icon: Gift,
    color: 'from-gold to-yellow-600',
  },
  {
    id: 'social',
    name: 'Social Media Campaign',
    description: 'Follow us on social media and engage with our community',
    reward: 250,
    currency: 'NOVA',
    status: 'active',
    endsIn: '5 days',
    tasks: [
      { id: 1, name: 'Follow on Twitter', completed: false, points: 50, link: 'https://twitter.com' },
      { id: 2, name: 'Join Telegram Group', completed: false, points: 50, link: 'https://t.me' },
      { id: 3, name: 'Retweet Pinned Post', completed: false, points: 75, link: 'https://twitter.com' },
      { id: 4, name: 'Join Discord Server', completed: false, points: 75, link: 'https://discord.gg' },
    ],
    icon: Twitter,
    color: 'from-electric to-blue-600',
  },
  {
    id: 'trading',
    name: 'First Trade Bonus',
    description: 'Complete your first trade and earn bonus tokens',
    reward: 500,
    currency: 'NOVA',
    status: 'active',
    endsIn: '12 days',
    tasks: [
      { id: 1, name: 'Deposit $50+', completed: false, points: 150 },
      { id: 2, name: 'Complete 1st Trade', completed: false, points: 150 },
      { id: 3, name: 'Trade 5 times', completed: false, points: 200 },
    ],
    icon: Zap,
    color: 'from-profit to-emerald-600',
  },
  {
    id: 'referral',
    name: 'Referral Airdrop',
    description: 'Invite friends and earn tokens for each successful referral',
    reward: 1000,
    currency: 'NOVA',
    status: 'active',
    endsIn: '30 days',
    tasks: [
      { id: 1, name: 'Invite 1 Friend', completed: false, points: 100 },
      { id: 2, name: 'Invite 5 Friends', completed: false, points: 300 },
      { id: 3, name: 'Invite 10 Friends', completed: false, points: 600 },
    ],
    icon: Users,
    color: 'from-purple-500 to-pink-600',
  },
  {
    id: 'vip',
    name: 'VIP Exclusive Drop',
    description: 'Exclusive airdrop for Pro and VIP members only',
    reward: 5000,
    currency: 'NOVA',
    status: 'locked',
    endsIn: null,
    tasks: [
      { id: 1, name: 'Upgrade to Pro/VIP', completed: false, points: 2500 },
      { id: 2, name: 'Trade $10,000+ volume', completed: false, points: 2500 },
    ],
    icon: Trophy,
    color: 'from-amber-500 to-orange-600',
    requirement: 'Pro or VIP subscription required',
  },
];

const upcomingAirdrops = [
  { name: 'Holiday Special Airdrop', date: 'Dec 25, 2025', reward: '2,500 NOVA' },
  { name: 'New Year Mega Drop', date: 'Jan 1, 2026', reward: '10,000 NOVA' },
  { name: 'Trading Competition', date: 'Jan 15, 2026', reward: '50,000 NOVA Pool' },
];

export default function AirdropsPage() {
  const [selectedAirdrop, setSelectedAirdrop] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const referralCode = 'NOVA2024XYZ';

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const totalAvailable = airdrops
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + a.reward, 0);

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-profit/10 border border-profit/20 rounded-full mb-6"
            >
              <Sparkles className="w-4 h-4 text-profit" />
              <span className="text-profit text-sm font-medium">Free Tokens Available!</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Claim Your
              <br />
              <span className="gradient-text-gold">Free Airdrops</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto mb-8">
              Complete simple tasks to earn NOVA tokens. No purchase necessary. 
              Over {totalAvailable.toLocaleString()} NOVA available right now!
            </p>

            {/* Stats */}
            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-gold">{totalAvailable.toLocaleString()}</p>
                <p className="text-sm text-cream/50">NOVA Available</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-cream">{airdrops.filter(a => a.status === 'active').length}</p>
                <p className="text-sm text-cream/50">Active Campaigns</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-profit">$2.50</p>
                <p className="text-sm text-cream/50">NOVA Price</p>
              </div>
            </div>
          </div>

          {/* FEATURED: Nova Airdrop Season 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold/20 via-charcoal to-profit/20 border border-gold/30 p-1">
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
              <div className="relative bg-charcoal/80 rounded-[22px] p-6 md:p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-loss text-white text-xs font-bold rounded-full animate-pulse">
                        <span className="w-2 h-2 bg-white rounded-full" />
                        LIVE NOW
                      </div>
                      <span className="px-3 py-1 bg-gold/20 text-gold text-xs font-medium rounded-full">
                        FEATURED
                      </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-display font-bold text-cream mb-3">
                      {novaAirdrop.name}
                    </h2>
                    <p className="text-lg text-cream/70 mb-6">
                      {novaAirdrop.description}
                    </p>

                    {/* Rewards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-gold/10 rounded-xl border border-gold/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="w-5 h-5 text-gold" />
                          <span className="text-sm text-cream/70">Token Pool</span>
                        </div>
                        <p className="text-2xl font-bold text-gold">{novaAirdrop.reward} NOVA</p>
                      </div>
                      <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          <span className="text-sm text-cream/70">BNB Giveaway</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-500">{novaAirdrop.bnbPool}</p>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {novaAirdrop.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-profit flex-shrink-0" />
                          <span className="text-cream/70">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <Link
                      href="/earn/airdrops/nova"
                      className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-gold to-yellow-500 text-void font-bold rounded-xl hover:opacity-90 transition-all"
                    >
                      <Wallet className="w-5 h-5" />
                      Claim Now - Only {novaAirdrop.claimFee}
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>

                  {/* Right Stats */}
                  <div className="lg:w-72 space-y-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-cream/50 text-sm">Participants</span>
                        <Users className="w-4 h-4 text-cream/50" />
                      </div>
                      <p className="text-2xl font-bold text-cream">{novaAirdrop.participants.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-cream/50 text-sm">Time Remaining</span>
                        <Clock className="w-4 h-4 text-cream/50" />
                      </div>
                      <p className="text-2xl font-bold text-loss">{novaAirdrop.endsIn}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-cream/50 text-sm">Claim Fee</span>
                        <Shield className="w-4 h-4 text-cream/50" />
                      </div>
                      <p className="text-2xl font-bold text-profit">{novaAirdrop.claimFee}</p>
                      <p className="text-xs text-cream/50">EIP-2612 Permit</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Referral Box */}
          <div className="mb-12 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Share2 className="w-7 h-7 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream">Share & Earn More</h3>
                  <p className="text-sm text-cream/60">Earn 100 NOVA for each friend who signs up</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-void rounded-lg border border-white/10">
                  <code className="text-gold font-mono">{referralCode}</code>
                </div>
                <button
                  onClick={copyReferralCode}
                  className="p-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  {copiedCode ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Other Airdrops Grid */}
          <h2 className="text-2xl font-bold text-cream mb-6">More Airdrops</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {airdrops.map((airdrop, index) => (
              <motion.div
                key={airdrop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-6 rounded-2xl border ${
                  airdrop.status === 'locked' 
                    ? 'bg-white/5 border-white/10 opacity-60' 
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                } transition-all`}
              >
                {airdrop.status === 'locked' && (
                  <div className="absolute top-4 right-4">
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                )}

                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${airdrop.color} flex items-center justify-center mb-4`}>
                  <airdrop.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-bold text-cream mb-2">{airdrop.name}</h3>
                <p className="text-sm text-cream/60 mb-4">{airdrop.description}</p>

                {airdrop.requirement && (
                  <p className="text-xs text-loss mb-4">{airdrop.requirement}</p>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-2xl font-bold text-gold">{airdrop.reward.toLocaleString()}</span>
                    <span className="text-cream/50 ml-2">{airdrop.currency}</span>
                  </div>
                  {airdrop.endsIn && (
                    <div className="flex items-center gap-1 text-sm text-cream/50">
                      <Clock className="w-4 h-4" />
                      {airdrop.endsIn}
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-cream/50">Progress</span>
                    <span className="text-cream">
                      {airdrop.tasks.filter(t => t.completed).length}/{airdrop.tasks.length} tasks
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${airdrop.color}`}
                      style={{ 
                        width: `${(airdrop.tasks.filter(t => t.completed).length / airdrop.tasks.length) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Tasks Preview */}
                <div className="space-y-2 mb-4">
                  {airdrop.tasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      {task.completed ? (
                        <CheckCircle className="w-4 h-4 text-profit" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/20" />
                      )}
                      <span className={task.completed ? 'text-cream/50 line-through' : 'text-cream/70'}>
                        {task.name}
                      </span>
                      <span className="ml-auto text-xs text-gold">+{task.points}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href={airdrop.status === 'locked' ? '/pricing' : '/auth/signup'}
                  className={`block w-full py-3 text-center font-semibold rounded-xl transition-all ${
                    airdrop.status === 'locked'
                      ? 'bg-white/5 text-cream/50 cursor-not-allowed'
                      : 'bg-white/10 text-cream hover:bg-white/20'
                  }`}
                >
                  {airdrop.status === 'locked' ? 'Upgrade to Unlock' : 'Start Tasks'}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Upcoming Airdrops */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Coins className="w-6 h-6 text-gold" />
              <h2 className="text-2xl font-bold text-cream">Upcoming Airdrops</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {upcomingAirdrops.map((airdrop, index) => (
                <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-sm text-cream/50 mb-2">
                    <Clock className="w-4 h-4" />
                    {airdrop.date}
                  </div>
                  <h3 className="text-cream font-medium mb-1">{airdrop.name}</h3>
                  <p className="text-gold font-bold">{airdrop.reward}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-cream mb-8">How Airdrops Work</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: 1, title: 'Sign Up', description: 'Create your free account', icon: Users },
                { step: 2, title: 'Complete Tasks', description: 'Follow social & trading tasks', icon: CheckCircle },
                { step: 3, title: 'Earn Tokens', description: 'Get NOVA tokens credited', icon: Coins },
                { step: 4, title: 'Trade or Withdraw', description: 'Use tokens or cash out', icon: Zap },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-16 h-16 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-8 h-8 text-gold" />
                  </div>
                  <div className="text-xs text-gold mb-2">Step {item.step}</div>
                  <h3 className="text-cream font-medium mb-1">{item.title}</h3>
                  <p className="text-sm text-cream/50">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="/earn/airdrops/nova"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Claim Nova Airdrop Now
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
