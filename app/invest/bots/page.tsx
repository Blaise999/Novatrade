'use client';

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
import { useStore } from '@/lib/supabase/store-supabase';

const bots = [
  {
    id: 'dca',
    name: 'DCA Master',
    description: 'Dollar-cost averaging with intelligent safety orders for systematic long-term accumulation',
    monthlyReturn: 'Varies',
    riskLevel: 'Low',
    winRate: 85,
    trades: 30,
    minCapital: 100,
    status: 'active',
    icon: Clock,
    color: 'from-purple-500 to-pink-600',
    features: ['Scheduled auto-buys at any interval', 'Safety orders (automatic dip-buying)', 'Trailing take profit', 'Custom frequency & sizing', 'Auto stop-loss protection'],
  },
  {
    id: 'grid',
    name: 'Grid Warrior',
    description: 'Automated buy-low sell-high grid strategy — profits from price oscillation in any range',
    monthlyReturn: 'Varies',
    riskLevel: 'Medium',
    winRate: 70,
    trades: 200,
    minCapital: 200,
    status: 'active',
    icon: Settings,
    color: 'from-orange-500 to-red-600',
    features: ['Arithmetic & Geometric grids', 'Long / Short / Neutral modes', 'Auto buy-sell cycling', 'Custom grid count & price range', 'Works 24/7 in sideways markets'],
  },
];

const stats = [
  { label: 'Active Bot Users', value: '12,000+' },
  { label: 'Total Profit Generated', value: '$18M+' },
  { label: 'Bot Uptime', value: '99.99%' },
  { label: 'Avg Win Rate', value: '77%' },
];

export default function BotsPage() {
  const { isAuthenticated } = useStore();
  const router = useRouter();

  const handleLearnMore = (botId: string) => {
    router.push(`/invest/bots/contact?bot=${botId}`);
  };

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
              Two proven strategies designed to grow your portfolio automatically. 
              Choose the bot that fits your trading style and let it work 24/7.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
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

          {/* Bots Grid — 2 cards side by side */}
          <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
            {bots.map((bot, index) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                className="relative p-7 rounded-2xl border bg-white/5 border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${bot.color} flex items-center justify-center`}>
                    <bot.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-profit" />
                    <span className="text-xs text-cream/50">Active</span>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-cream mb-2">{bot.name}</h3>
                <p className="text-sm text-cream/60 mb-5">{bot.description}</p>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-cream/50">Win Rate</p>
                    <p className="text-cream font-bold text-lg">{bot.winRate}%</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-cream/50">Risk Level</p>
                    <p className={`font-bold text-lg ${
                      bot.riskLevel === 'Low' ? 'text-profit' : 'text-gold'
                    }`}>{bot.riskLevel}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-cream/50">Min Capital</p>
                    <p className="text-cream font-bold text-lg">${bot.minCapital}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-cream/50">Monthly Return</p>
                    <p className="text-gold font-bold text-lg">{bot.monthlyReturn}</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-7">
                  {bot.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-profit flex-shrink-0" />
                      <span className="text-cream/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleLearnMore(bot.id)}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all ${
                    bot.id === 'dca'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:opacity-90'
                      : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:opacity-90'
                  }`}
                >
                  <ArrowRight className="w-4 h-4" />
                  Learn More & Get Started
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
