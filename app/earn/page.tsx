'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  Gift,
  DollarSign,
  Copy,
  CheckCircle,
  Share2,
  TrendingUp,
  Award,
  ArrowRight,
  Twitter,
  Facebook,
  MessageCircle,
  Mail,
  Link as LinkIcon,
  Star,
  Crown
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const tiers = [
  { level: 'Bronze', referrals: 1, commission: 10, bonus: 50, color: 'from-orange-600 to-orange-700' },
  { level: 'Silver', referrals: 5, commission: 15, bonus: 100, color: 'from-slate-400 to-slate-500' },
  { level: 'Gold', referrals: 15, commission: 20, bonus: 250, color: 'from-gold to-yellow-600' },
  { level: 'Platinum', referrals: 50, commission: 25, bonus: 500, color: 'from-cyan-400 to-cyan-500' },
  { level: 'Diamond', referrals: 100, commission: 30, bonus: 1000, color: 'from-purple-500 to-pink-500' },
];

const leaderboard = [
  { rank: 1, name: 'CryptoKing_23', referrals: 847, earnings: 42350, avatar: '👑' },
  { rank: 2, name: 'TradeM***er', referrals: 623, earnings: 31150, avatar: '🥈' },
  { rank: 3, name: 'Inve***Pro', referrals: 512, earnings: 25600, avatar: '🥉' },
  { rank: 4, name: 'Bit***nWhale', referrals: 428, earnings: 21400, avatar: '🐋' },
  { rank: 5, name: 'Nova***ader', referrals: 356, earnings: 17800, avatar: '⭐' },
];

export default function ReferralPage() {
  const [referralCode] = useState('NOVA-XYZ789');
  const [referralLink] = useState('https://novatrade.com/ref/NOVA-XYZ789');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-profit/10 border border-profit/20 rounded-full mb-6">
              <Users className="w-4 h-4 text-profit" />
              <span className="text-profit text-sm font-medium">Earn Together</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Refer & Earn
              <br />
              <span className="gradient-text-gold">Up to 30% Commission</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Invite friends to NOVATrADE and earn lifetime commissions on their trading fees. 
              Plus, they get bonus funds to start trading!
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Total Paid Out', value: '$2.4M+', icon: DollarSign },
              { label: 'Active Referrers', value: '12,500+', icon: Users },
              { label: 'Avg. Monthly Earnings', value: '$450', icon: TrendingUp },
              { label: 'Top Earner This Month', value: '$8,200', icon: Crown },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10 text-center"
              >
                <stat.icon className="w-6 h-6 text-gold mx-auto mb-2" />
                <p className="text-2xl font-bold text-cream">{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Referral Box */}
          <div className="bg-gradient-to-r from-gold/10 to-profit/10 rounded-2xl border border-gold/20 p-8 mb-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold text-cream mb-4">Your Referral Link</h2>
                <p className="text-cream/60 mb-6">
                  Share your unique link with friends. When they sign up and trade, you both earn rewards!
                </p>
                
                {/* Referral Link */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-cream/50 mb-2">Your Referral Link</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={referralLink}
                        readOnly
                        className="flex-1 px-4 py-3 bg-void border border-white/10 rounded-xl text-cream text-sm font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(referralLink, 'link')}
                        className="p-3 bg-gold text-void rounded-xl hover:bg-gold/90 transition-colors"
                      >
                        {copied === 'link' ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-cream/50 mb-2">Referral Code</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={referralCode}
                        readOnly
                        className="flex-1 px-4 py-3 bg-void border border-white/10 rounded-xl text-gold text-lg font-mono font-bold"
                      />
                      <button
                        onClick={() => copyToClipboard(referralCode, 'code')}
                        className="p-3 bg-white/10 text-cream rounded-xl hover:bg-white/20 transition-colors"
                      >
                        {copied === 'code' ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Share Buttons */}
                <div className="flex items-center gap-3 mt-6">
                  <span className="text-sm text-cream/50">Share:</span>
                  {[
                    { icon: Twitter, color: 'hover:bg-blue-500/20 hover:text-blue-400' },
                    { icon: Facebook, color: 'hover:bg-blue-600/20 hover:text-blue-500' },
                    { icon: MessageCircle, color: 'hover:bg-green-500/20 hover:text-green-400' },
                    { icon: Mail, color: 'hover:bg-red-500/20 hover:text-red-400' },
                  ].map((social, i) => (
                    <button
                      key={i}
                      className={`p-2 bg-white/5 rounded-lg text-cream/50 transition-colors ${social.color}`}
                    >
                      <social.icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-void/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-cream mb-4">Rewards Breakdown</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Gift className="w-5 h-5 text-profit" />
                      <span className="text-cream">Friend's Signup Bonus</span>
                    </div>
                    <span className="text-profit font-bold">$100</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-gold" />
                      <span className="text-cream">Your Referral Bonus</span>
                    </div>
                    <span className="text-gold font-bold">$50+</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-electric" />
                      <span className="text-cream">Lifetime Commission</span>
                    </div>
                    <span className="text-electric font-bold">10-30%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tiers */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-cream mb-8 text-center">Commission Tiers</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {tiers.map((tier, index) => (
                <motion.div
                  key={tier.level}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 text-center"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center mx-auto mb-3`}>
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-cream font-bold mb-1">{tier.level}</h3>
                  <p className="text-xs text-cream/50 mb-3">{tier.referrals}+ referrals</p>
                  <div className="space-y-1">
                    <p className="text-profit font-bold">{tier.commission}% Commission</p>
                    <p className="text-xs text-gold">${tier.bonus} bonus/referral</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-gold" />
                <h2 className="text-xl font-bold text-cream">Top Referrers This Month</h2>
              </div>
              <span className="text-sm text-cream/50">Win $5,000 bonus!</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-cream/50 font-medium">Rank</th>
                    <th className="text-left p-3 text-cream/50 font-medium">User</th>
                    <th className="text-right p-3 text-cream/50 font-medium">Referrals</th>
                    <th className="text-right p-3 text-cream/50 font-medium">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user) => (
                    <tr key={user.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <span className={`text-2xl ${user.rank <= 3 ? '' : 'text-cream/50'}`}>
                          {user.avatar}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-cream font-medium">{user.name}</span>
                      </td>
                      <td className="p-3 text-right text-cream">{user.referrals.toLocaleString()}</td>
                      <td className="p-3 text-right text-profit font-bold">${user.earnings.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* How It Works */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-cream mb-8">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { step: 1, title: 'Share Link', description: 'Share your unique referral link with friends', icon: Share2 },
                { step: 2, title: 'They Sign Up', description: 'Friends create account using your link', icon: Users },
                { step: 3, title: 'They Trade', description: 'They get bonus and start trading', icon: TrendingUp },
                { step: 4, title: 'You Earn', description: 'Earn commission on every trade forever', icon: DollarSign },
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
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Start Earning Now
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
