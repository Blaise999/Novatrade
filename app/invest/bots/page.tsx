'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  TrendingUp,
  Shield,
  Zap,
  Clock,
  Settings,
  Play,
  Pause,
  ArrowRight,
  CheckCircle,
  Lock,
  BarChart3,
  Activity,
  DollarSign
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuthStore } from '@/lib/store';

const bots = [
  {
    id: 'conservative',
    name: 'Safe Trader',
    description: 'Low-risk bot focusing on stable, consistent returns',
    monthlyReturn: '5-8%',
    riskLevel: 'Low',
    winRate: 78,
    trades: 45,
    minCapital: 100,
    status: 'active',
    icon: Shield,
    color: 'from-blue-500 to-blue-600',
    features: ['Stop-loss protection', 'Conservative positions', 'Blue-chip assets only'],
    free: true,
  },
  {
    id: 'balanced',
    name: 'Smart Scalper',
    description: 'Balanced approach with moderate risk and good returns',
    monthlyReturn: '12-18%',
    riskLevel: 'Medium',
    winRate: 72,
    trades: 120,
    minCapital: 500,
    status: 'active',
    icon: BarChart3,
    color: 'from-profit to-emerald-600',
    features: ['AI-powered analysis', 'Multi-timeframe', 'News sentiment'],
    free: false,
  },
  {
    id: 'aggressive',
    name: 'Alpha Hunter',
    description: 'High-frequency trading for maximum profit potential',
    monthlyReturn: '25-40%',
    riskLevel: 'High',
    winRate: 65,
    trades: 300,
    minCapital: 1000,
    status: 'active',
    icon: Zap,
    color: 'from-gold to-yellow-600',
    features: ['High-frequency trades', 'Leverage trading', 'All market conditions'],
    free: false,
  },
  {
    id: 'dca',
    name: 'DCA Master',
    description: 'Dollar-cost averaging bot for long-term wealth building',
    monthlyReturn: '8-15%',
    riskLevel: 'Low',
    winRate: 85,
    trades: 30,
    minCapital: 250,
    status: 'active',
    icon: Clock,
    color: 'from-purple-500 to-pink-600',
    features: ['Auto-accumulation', 'Market timing', 'Portfolio rebalancing'],
    free: false,
  },
  {
    id: 'arbitrage',
    name: 'Arbitrage Pro',
    description: 'Exploits price differences across exchanges',
    monthlyReturn: '15-25%',
    riskLevel: 'Medium',
    winRate: 92,
    trades: 500,
    minCapital: 5000,
    status: 'active',
    icon: Activity,
    color: 'from-electric to-cyan-600',
    features: ['Cross-exchange', 'Lightning fast', 'Zero market risk'],
    free: false,
    premium: true,
  },
  {
    id: 'grid',
    name: 'Grid Warrior',
    description: 'Grid trading strategy for ranging markets',
    monthlyReturn: '10-20%',
    riskLevel: 'Medium',
    winRate: 70,
    trades: 200,
    minCapital: 500,
    status: 'active',
    icon: Settings,
    color: 'from-orange-500 to-red-600',
    features: ['Auto grid setup', 'Range detection', 'Profit optimization'],
    free: false,
  },
];

const stats = [
  { label: 'Total Bot Users', value: '28,000+' },
  { label: 'Profits Generated', value: '$45M+' },
  { label: 'Avg. Monthly Return', value: '18%' },
  { label: 'Uptime', value: '99.99%' },
];

export default function BotsPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);

  const handleActivateBot = (botId: string) => {
    if (isAuthenticated) {
      router.push(`/dashboard/wallet?bot=${botId}`);
    } else {
      router.push(`/auth/signup?redirect=/dashboard/wallet&bot=${botId}`);
    }
  };

  const filteredBots = selectedRisk
    ? bots.filter(b => b.riskLevel === selectedRisk)
    : bots;

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-electric/10 border border-electric/20 rounded-full mb-6">
              <Bot className="w-4 h-4 text-electric" />
              <span className="text-electric text-sm font-medium">AI-Powered Trading</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Auto-Trading Bots
              <br />
              <span className="gradient-text-gold">Trade While You Sleep</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Let our AI-powered trading bots work for you 24/7. Choose from multiple strategies 
              designed for different risk levels and profit goals.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10 text-center"
              >
                <p className="text-2xl font-bold text-gold">{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Risk Filter */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            <button
              onClick={() => setSelectedRisk(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedRisk === null
                  ? 'bg-gold text-void'
                  : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              All Bots
            </button>
            {['Low', 'Medium', 'High'].map((risk) => (
              <button
                key={risk}
                onClick={() => setSelectedRisk(risk)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedRisk === risk
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/70 hover:bg-white/10'
                }`}
              >
                {risk} Risk
              </button>
            ))}
          </div>

          {/* Bots Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredBots.map((bot, index) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-6 rounded-2xl border ${
                  bot.premium 
                    ? 'bg-gradient-to-b from-gold/10 to-transparent border-gold/30' 
                    : 'bg-white/5 border-white/10'
                } hover:border-white/20 transition-all`}
              >
                {bot.premium && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gold text-void text-xs font-bold rounded-full">
                    VIP ONLY
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${bot.color} flex items-center justify-center`}>
                    <bot.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${bot.status === 'active' ? 'bg-profit' : 'bg-slate-500'}`} />
                    <span className="text-xs text-cream/50 capitalize">{bot.status}</span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-cream mb-1">{bot.name}</h3>
                <p className="text-sm text-cream/60 mb-4">{bot.description}</p>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-cream/50">Monthly Return</p>
                    <p className="text-profit font-bold">{bot.monthlyReturn}</p>
                  </div>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-cream/50">Win Rate</p>
                    <p className="text-cream font-bold">{bot.winRate}%</p>
                  </div>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-cream/50">Risk Level</p>
                    <p className={`font-bold ${
                      bot.riskLevel === 'Low' ? 'text-profit' : 
                      bot.riskLevel === 'Medium' ? 'text-gold' : 'text-loss'
                    }`}>{bot.riskLevel}</p>
                  </div>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-cream/50">Min Capital</p>
                    <p className="text-cream font-bold">${bot.minCapital}</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {bot.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-profit flex-shrink-0" />
                      <span className="text-cream/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleActivateBot(bot.id)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                    bot.free
                      ? 'bg-profit text-void hover:bg-profit/90'
                      : 'bg-gold text-void hover:bg-gold/90'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Activate Bot
                </button>
              </motion.div>
            ))}
          </div>

          {/* How It Works */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 mb-16">
            <h2 className="text-2xl font-bold text-cream mb-8 text-center">How Auto-Trading Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: 1, title: 'Choose Bot', description: 'Select a bot that matches your risk profile', icon: Bot },
                { step: 2, title: 'Fund Account', description: 'Deposit the minimum required capital', icon: DollarSign },
                { step: 3, title: 'Activate', description: 'Turn on the bot and let it trade for you', icon: Play },
                { step: 4, title: 'Earn Profits', description: 'Watch your profits grow automatically', icon: TrendingUp },
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
          <div className="text-center">
            <button
              onClick={() => router.push(isAuthenticated ? '/dashboard/wallet' : '/auth/signup?redirect=/dashboard/wallet')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Start Auto-Trading Now
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
