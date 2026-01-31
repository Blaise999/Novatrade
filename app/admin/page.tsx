'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  Wallet,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  BarChart3,
  CreditCard,
  Eye
} from 'lucide-react';
import { useDepositSettingsStore } from '@/lib/deposit-settings';

export default function AdminDashboardPage() {
  const { pendingDeposits, confirmedDeposits, getPendingDeposits } = useDepositSettingsStore();
  const pending = getPendingDeposits();
  
  // Mock stats - in production these would come from your database
  const [stats, setStats] = useState({
    totalUsers: 1247,
    activeUsers: 892,
    totalDeposits: 458320,
    pendingDeposits: pending.length,
    totalTrades: 15892,
    openTrades: 342,
    totalVolume: 2450000,
    todayVolume: 125000
  });

  const quickStats = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      change: '+12.5%',
      positive: true,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-500'
    },
    {
      title: 'Total Deposits',
      value: `$${stats.totalDeposits.toLocaleString()}`,
      change: '+8.2%',
      positive: true,
      icon: Wallet,
      color: 'bg-profit/10 text-profit'
    },
    {
      title: 'Pending Deposits',
      value: pending.length.toString(),
      change: pending.length > 0 ? 'Action Required' : 'All Clear',
      positive: pending.length === 0,
      icon: Clock,
      color: pending.length > 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-profit/10 text-profit',
      link: '/admin/deposits'
    },
    {
      title: 'Trading Volume',
      value: `$${(stats.totalVolume / 1000000).toFixed(2)}M`,
      change: '+15.3%',
      positive: true,
      icon: BarChart3,
      color: 'bg-gold/10 text-gold'
    }
  ];

  const recentActivity = [
    { type: 'deposit', user: 'john@email.com', amount: 500, status: 'pending', time: '2 min ago' },
    { type: 'trade', user: 'mary@email.com', pair: 'EUR/USD', pnl: 125, time: '5 min ago' },
    { type: 'deposit', user: 'alex@email.com', amount: 1000, status: 'confirmed', time: '12 min ago' },
    { type: 'signup', user: 'new@user.com', time: '15 min ago' },
    { type: 'withdrawal', user: 'trader@email.com', amount: 300, status: 'processing', time: '20 min ago' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cream">Dashboard Overview</h1>
        <p className="text-slate-400 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Alert for pending deposits */}
      {pending.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-yellow-500 font-medium">
                {pending.length} Pending Deposit{pending.length > 1 ? 's' : ''} Awaiting Approval
              </p>
              <p className="text-yellow-500/70 text-sm">
                Total: ${pending.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
              </p>
            </div>
          </div>
          <Link
            href="/admin/deposits"
            className="px-4 py-2 bg-yellow-500 text-void font-medium rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Review Now
          </Link>
        </motion.div>
      )}

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {stat.link ? (
              <Link href={stat.link} className="block p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    stat.positive ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-cream">{stat.value}</p>
                <p className="text-sm text-cream/50 mt-1">{stat.title}</p>
              </Link>
            ) : (
              <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    stat.positive ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-cream">{stat.value}</p>
                <p className="text-sm text-cream/50 mt-1">{stat.title}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-cream">Recent Activity</h2>
            <Activity className="w-5 h-5 text-cream/30" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-void/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activity.type === 'deposit' ? 'bg-profit/10' :
                    activity.type === 'withdrawal' ? 'bg-loss/10' :
                    activity.type === 'trade' ? 'bg-gold/10' : 'bg-blue-500/10'
                  }`}>
                    {activity.type === 'deposit' && <ArrowDownRight className="w-4 h-4 text-profit" />}
                    {activity.type === 'withdrawal' && <ArrowUpRight className="w-4 h-4 text-loss" />}
                    {activity.type === 'trade' && <TrendingUp className="w-4 h-4 text-gold" />}
                    {activity.type === 'signup' && <Users className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm text-cream">
                      {activity.type === 'signup' ? 'New user registered' :
                       activity.type === 'trade' ? `Trade on ${activity.pair}` :
                       `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}`}
                    </p>
                    <p className="text-xs text-cream/50">{activity.user}</p>
                  </div>
                </div>
                <div className="text-right">
                  {activity.amount && (
                    <p className={`text-sm font-medium ${
                      activity.type === 'deposit' ? 'text-profit' : 'text-loss'
                    }`}>
                      {activity.type === 'deposit' ? '+' : '-'}${activity.amount}
                    </p>
                  )}
                  {activity.pnl !== undefined && (
                    <p className={`text-sm font-medium ${activity.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {activity.pnl >= 0 ? '+' : ''}${activity.pnl}
                    </p>
                  )}
                  <p className="text-xs text-cream/40">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h2 className="text-lg font-semibold text-cream mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/admin/deposits"
                className="flex items-center gap-3 p-3 bg-void/30 rounded-xl hover:bg-void/50 transition-colors"
              >
                <CreditCard className="w-5 h-5 text-gold" />
                <span className="text-sm text-cream">Review Deposits</span>
                {pending.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-loss text-white text-xs rounded-full">
                    {pending.length}
                  </span>
                )}
              </Link>
              <Link
                href="/admin/users"
                className="flex items-center gap-3 p-3 bg-void/30 rounded-xl hover:bg-void/50 transition-colors"
              >
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-cream">Manage Users</span>
              </Link>
              <Link
                href="/admin/markets"
                className="flex items-center gap-3 p-3 bg-void/30 rounded-xl hover:bg-void/50 transition-colors"
              >
                <TrendingUp className="w-5 h-5 text-profit" />
                <span className="text-sm text-cream">Control Markets</span>
              </Link>
              <Link
                href="/admin/settings"
                className="flex items-center gap-3 p-3 bg-void/30 rounded-xl hover:bg-void/50 transition-colors"
              >
                <Activity className="w-5 h-5 text-electric" />
                <span className="text-sm text-cream">Platform Settings</span>
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h2 className="text-lg font-semibold text-cream mb-4">System Status</h2>
            <div className="space-y-3">
              {[
                { name: 'API Server', status: 'online' },
                { name: 'Database', status: 'online' },
                { name: 'Payment Gateway', status: 'online' },
                { name: 'WebSocket', status: 'online' },
              ].map((service) => (
                <div key={service.name} className="flex items-center justify-between">
                  <span className="text-sm text-cream/70">{service.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-profit rounded-full animate-pulse" />
                    <span className="text-xs text-profit capitalize">{service.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
