'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Trophy,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  Medal,
  ArrowRight,
  Calendar,
  Target,
  Zap,
  Crown,
  Star
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const activeCompetitions = [
  {
    id: 'weekly-forex',
    name: 'Weekly Forex Championship',
    description: 'Compete in forex trading for the highest ROI',
    prizePool: 25000,
    participants: 1847,
    maxParticipants: 5000,
    startDate: 'Jan 20, 2025',
    endDate: 'Jan 27, 2025',
    status: 'active',
    timeLeft: '4 days 12:34:56',
    entryFee: 0,
    asset: 'Forex',
    color: 'from-profit to-emerald-600',
  },
  {
    id: 'crypto-kings',
    name: 'Crypto Kings Tournament',
    description: 'Battle for crypto trading supremacy',
    prizePool: 50000,
    participants: 3241,
    maxParticipants: 10000,
    startDate: 'Jan 15, 2025',
    endDate: 'Feb 15, 2025',
    status: 'active',
    timeLeft: '23 days 08:12:33',
    entryFee: 50,
    asset: 'Crypto',
    color: 'from-gold to-yellow-600',
  },
  {
    id: 'newbie-challenge',
    name: 'Newbie Trading Challenge',
    description: 'Exclusive competition for new traders',
    prizePool: 10000,
    participants: 892,
    maxParticipants: 2000,
    startDate: 'Jan 22, 2025',
    endDate: 'Jan 29, 2025',
    status: 'upcoming',
    timeLeft: 'Starts in 2 days',
    entryFee: 0,
    asset: 'All',
    color: 'from-electric to-blue-600',
  },
];

const upcomingCompetitions = [
  { name: 'February Mega Tournament', date: 'Feb 1-28', prize: '$100,000', asset: 'All Markets' },
  { name: 'Stock Trading Sprint', date: 'Feb 10-17', prize: '$30,000', asset: 'Stocks' },
  { name: 'VIP Exclusive Cup', date: 'Feb 15-22', prize: '$75,000', asset: 'Crypto' },
];

const leaderboard = [
  { rank: 1, name: 'CryptoKing_23', roi: '+847%', trades: 234, prize: '$10,000', avatar: '👑' },
  { rank: 2, name: 'TradeM***er', roi: '+623%', trades: 189, prize: '$5,000', avatar: '🥈' },
  { rank: 3, name: 'Inve***Pro', roi: '+512%', trades: 156, prize: '$2,500', avatar: '🥉' },
  { rank: 4, name: 'Bit***Whale', roi: '+428%', trades: 201, prize: '$1,500', avatar: '4️⃣' },
  { rank: 5, name: 'Nova***ader', roi: '+356%', trades: 178, prize: '$1,000', avatar: '5️⃣' },
  { rank: 6, name: 'Forex***ter', roi: '+298%', trades: 145, prize: '$750', avatar: '6️⃣' },
  { rank: 7, name: 'Day***der', roi: '+267%', trades: 167, prize: '$500', avatar: '7️⃣' },
  { rank: 8, name: 'Swing***er', roi: '+234%', trades: 89, prize: '$400', avatar: '8️⃣' },
  { rank: 9, name: 'Scal***Pro', roi: '+212%', trades: 312, prize: '$300', avatar: '9️⃣' },
  { rank: 10, name: 'Trend***er', roi: '+198%', trades: 134, prize: '$200', avatar: '🔟' },
];

const prizeBreakdown = [
  { position: '1st Place', percentage: 40, color: 'text-gold' },
  { position: '2nd Place', percentage: 20, color: 'text-slate-300' },
  { position: '3rd Place', percentage: 10, color: 'text-orange-400' },
  { position: '4th-10th', percentage: 15, color: 'text-cream' },
  { position: '11th-50th', percentage: 10, color: 'text-cream/70' },
  { position: '51st-100th', percentage: 5, color: 'text-cream/50' },
];

export default function CompetitionsPage() {
  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full mb-6">
              <Trophy className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Trading Competitions</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Compete & Win
              <br />
              <span className="gradient-text-gold">Massive Prizes</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Test your trading skills against the best traders on the platform. 
              Compete for glory and win from massive prize pools!
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Total Prize Pool', value: '$185,000', icon: DollarSign },
              { label: 'Active Competitions', value: '3', icon: Trophy },
              { label: 'Total Participants', value: '5,980+', icon: Users },
              { label: 'Prizes Awarded', value: '$2.5M+', icon: Medal },
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

          {/* Active Competitions */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-cream mb-6">Active & Upcoming</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCompetitions.map((comp, index) => (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative p-6 rounded-2xl border ${
                    comp.status === 'active'
                      ? 'bg-gradient-to-b from-profit/10 to-transparent border-profit/20'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {comp.status === 'active' && (
                    <div className="absolute -top-3 right-4 px-3 py-1 bg-profit text-void text-xs font-bold rounded-full flex items-center gap-1">
                      <span className="w-2 h-2 bg-void rounded-full animate-pulse" />
                      LIVE
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${comp.color} flex items-center justify-center mb-4`}>
                    <Trophy className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-cream mb-2">{comp.name}</h3>
                  <p className="text-sm text-cream/60 mb-4">{comp.description}</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cream/50 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Prize Pool
                      </span>
                      <span className="text-gold font-bold">${comp.prizePool.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cream/50 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Participants
                      </span>
                      <span className="text-cream">{comp.participants.toLocaleString()} / {comp.maxParticipants.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cream/50 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {comp.status === 'active' ? 'Time Left' : 'Starts'}
                      </span>
                      <span className={comp.status === 'active' ? 'text-loss' : 'text-electric'}>{comp.timeLeft}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cream/50 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Entry Fee
                      </span>
                      <span className="text-cream">{comp.entryFee === 0 ? 'FREE' : `$${comp.entryFee}`}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-profit"
                        style={{ width: `${(comp.participants / comp.maxParticipants) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-cream/50 mt-1">
                      {Math.round((comp.participants / comp.maxParticipants) * 100)}% filled
                    </p>
                  </div>

                  <Link
                    href="/auth/signup"
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                      comp.status === 'active'
                        ? 'bg-profit text-void hover:bg-profit/90'
                        : 'bg-white/10 text-cream hover:bg-white/20'
                    }`}
                  >
                    {comp.status === 'active' ? 'Join Now' : 'Register'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-gold" />
                <h2 className="text-xl font-bold text-cream">Current Leaderboard</h2>
              </div>
              <span className="text-sm text-cream/50">Weekly Forex Championship</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-cream/50 font-medium">Rank</th>
                    <th className="text-left p-3 text-cream/50 font-medium">Trader</th>
                    <th className="text-right p-3 text-cream/50 font-medium">ROI</th>
                    <th className="text-right p-3 text-cream/50 font-medium">Trades</th>
                    <th className="text-right p-3 text-cream/50 font-medium">Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user) => (
                    <tr key={user.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <span className="text-2xl">{user.avatar}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-cream font-medium">{user.name}</span>
                      </td>
                      <td className="p-3 text-right text-profit font-bold">{user.roi}</td>
                      <td className="p-3 text-right text-cream">{user.trades}</td>
                      <td className="p-3 text-right text-gold font-bold">{user.prize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Prize Breakdown */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Medal className="w-6 h-6 text-gold" />
                <h2 className="text-xl font-bold text-cream">Prize Distribution</h2>
              </div>
              <div className="space-y-3">
                {prizeBreakdown.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className={`w-24 text-sm font-medium ${item.color}`}>{item.position}</span>
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-profit"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-cream font-bold w-12 text-right">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-electric" />
                <h2 className="text-xl font-bold text-cream">Coming Soon</h2>
              </div>
              <div className="space-y-3">
                {upcomingCompetitions.map((comp, index) => (
                  <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-cream font-medium">{comp.name}</h3>
                      <span className="text-gold font-bold">{comp.prize}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-cream/50">
                      <span>{comp.date}</span>
                      <span>{comp.asset}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              <Trophy className="w-5 h-5" />
              Join Competition Now
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
