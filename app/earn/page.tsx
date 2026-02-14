'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Star,
  Gift,
  Target,
  CheckCircle,
  Clock,
  Flame,
  Trophy,
  Zap,
  ArrowRight,
  Lock,
  Coins,
  Calendar,
  TrendingUp
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const dailyTasks = [
  { id: 1, name: 'Login to platform', reward: 10, completed: false, icon: Star },
  { id: 2, name: 'Make 1 trade', reward: 25, completed: false, icon: TrendingUp },
  { id: 3, name: 'Check market news', reward: 5, completed: false, icon: Target },
  { id: 4, name: 'Share on social media', reward: 15, completed: false, icon: Zap },
  { id: 5, name: 'Complete KYC verification', reward: 100, completed: false, icon: CheckCircle, oneTime: true },
];

const achievements = [
  { name: 'First Trade', description: 'Complete your first trade', reward: 50, progress: 0, target: 1, icon: '🎯' },
  { name: 'Trader 10', description: 'Complete 10 trades', reward: 100, progress: 0, target: 10, icon: '📈' },
  { name: 'Trader 100', description: 'Complete 100 trades', reward: 500, progress: 0, target: 100, icon: '🚀' },
  { name: 'Big Spender', description: 'Deposit $1,000+', reward: 200, progress: 0, target: 1000, icon: '💰' },
  { name: 'Whale', description: 'Deposit $10,000+', reward: 1000, progress: 0, target: 10000, icon: '🐋' },
  { name: 'Social Butterfly', description: 'Refer 5 friends', reward: 250, progress: 0, target: 5, icon: '🦋' },
  { name: 'Streak Master', description: '7-day login streak', reward: 150, progress: 0, target: 7, icon: '🔥' },
  { name: 'Copy Cat', description: 'Copy 3 traders', reward: 75, progress: 0, target: 3, icon: '🐱' },
];

const streakRewards = [
  { day: 1, reward: 10, icon: '🌱' },
  { day: 3, reward: 30, icon: '🌿' },
  { day: 7, reward: 100, icon: '🌳' },
  { day: 14, reward: 250, icon: '🌲' },
  { day: 30, reward: 750, icon: '🏆' },
];

const vipLevels = [
  { level: 'Bronze', points: 0, perks: ['5% bonus on deposits', 'Basic support'], color: 'from-orange-600 to-orange-700' },
  { level: 'Silver', points: 1000, perks: ['10% bonus on deposits', 'Priority support', 'Reduced fees'], color: 'from-slate-400 to-slate-500' },
  { level: 'Gold', points: 5000, perks: ['15% bonus on deposits', '24/7 support', 'Free withdrawals'], color: 'from-gold to-yellow-600' },
  { level: 'Platinum', points: 15000, perks: ['20% bonus', 'Personal manager', 'VIP events'], color: 'from-cyan-400 to-cyan-500' },
  { level: 'Diamond', points: 50000, perks: ['25% bonus', 'Exclusive bots', 'Zero fees'], color: 'from-purple-500 to-pink-500' },
];

export default function RewardsPage() {
  const [currentStreak] = useState(0);
  const [totalPoints] = useState(0);

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full mb-6">
              <Star className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Rewards Center</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Earn Rewards
              <br />
              <span className="gradient-text-gold">Every Day</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Complete tasks, achieve milestones, and maintain streaks to earn NOVA points. 
              Redeem for trading bonuses, fee discounts, and exclusive perks.
            </p>
          </div>

          {/* Points Overview */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <div className="p-6 bg-gradient-to-br from-gold/10 to-transparent rounded-2xl border border-gold/20">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-6 h-6 text-gold" />
                <span className="text-cream/50">Total Points</span>
              </div>
              <p className="text-4xl font-bold text-gold">{totalPoints.toLocaleString()}</p>
              <p className="text-sm text-cream/50 mt-1">NOVA Points</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-loss/10 to-transparent rounded-2xl border border-loss/20">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-6 h-6 text-loss" />
                <span className="text-cream/50">Current Streak</span>
              </div>
              <p className="text-4xl font-bold text-loss">{currentStreak} Days</p>
              <p className="text-sm text-cream/50 mt-1">Keep it going!</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-electric/10 to-transparent rounded-2xl border border-electric/20">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-6 h-6 text-electric" />
                <span className="text-cream/50">VIP Level</span>
              </div>
              <p className="text-4xl font-bold text-electric">Bronze</p>
              <p className="text-sm text-cream/50 mt-1">1,000 pts to Silver</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Daily Tasks */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-cream">Daily Tasks</h2>
                </div>
                <span className="text-sm text-cream/50">Resets in 18:32:45</span>
              </div>

              <div className="space-y-3">
                {dailyTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                      task.completed
                        ? 'bg-profit/10 border-profit/20'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      task.completed ? 'bg-profit/20' : 'bg-white/10'
                    }`}>
                      {task.completed ? (
                        <CheckCircle className="w-5 h-5 text-profit" />
                      ) : (
                        <task.icon className="w-5 h-5 text-cream/50" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${task.completed ? 'text-cream/50 line-through' : 'text-cream'}`}>
                        {task.name}
                      </p>
                      {task.oneTime && <span className="text-xs text-gold">One-time reward</span>}
                    </div>
                    <span className={`font-bold ${task.completed ? 'text-profit' : 'text-gold'}`}>
                      +{task.reward} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Streak Rewards */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Flame className="w-6 h-6 text-loss" />
                <h2 className="text-xl font-bold text-cream">Streak Rewards</h2>
              </div>

              <div className="space-y-3">
                {streakRewards.map((streak) => {
                  const achieved = currentStreak >= streak.day;
                  return (
                    <div
                      key={streak.day}
                      className={`flex items-center gap-4 p-3 rounded-xl border ${
                        achieved
                          ? 'bg-profit/10 border-profit/20'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <span className="text-2xl">{streak.icon}</span>
                      <div className="flex-1">
                        <p className="text-cream font-medium">Day {streak.day}</p>
                        <p className="text-sm text-cream/50">
                          {achieved ? 'Claimed!' : `${streak.day - currentStreak} days to go`}
                        </p>
                      </div>
                      <span className={`font-bold ${achieved ? 'text-profit' : 'text-gold'}`}>
                        +{streak.reward} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-gold" />
              <h2 className="text-xl font-bold text-cream">Achievements</h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {achievements.map((achievement, index) => (
                <motion.div
                  key={achievement.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-white/5 rounded-xl border border-white/10"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{achievement.icon}</span>
                    <span className="text-gold font-bold">+{achievement.reward}</span>
                  </div>
                  <h3 className="text-cream font-medium mb-1">{achievement.name}</h3>
                  <p className="text-xs text-cream/50 mb-3">{achievement.description}</p>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold"
                      style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-cream/50 mt-1">
                    {achievement.progress}/{achievement.target}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* VIP Levels */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-6 h-6 text-gold" />
              <h2 className="text-xl font-bold text-cream">VIP Levels</h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {vipLevels.map((vip, index) => (
                <div
                  key={vip.level}
                  className={`p-4 rounded-xl border ${
                    index === 0
                      ? 'bg-gradient-to-b from-orange-500/10 to-transparent border-orange-500/20'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${vip.color} flex items-center justify-center mb-3`}>
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-cream font-bold mb-1">{vip.level}</h3>
                  <p className="text-sm text-cream/50 mb-3">{vip.points.toLocaleString()} pts</p>
                  <ul className="space-y-1">
                    {vip.perks.map((perk, i) => (
                      <li key={i} className="text-xs text-cream/60 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-profit" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Start Earning Rewards
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
