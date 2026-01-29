'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  BarChart3,
  Globe,
  Coins,
  Building2,
  Fuel,
  Search
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { marketAssets } from '@/lib/data';

const categories = [
  { id: 'all', name: 'All Markets', icon: Globe, count: marketAssets.length },
  { id: 'crypto', name: 'Cryptocurrency', icon: Coins, count: marketAssets.filter(a => a.type === 'crypto').length },
  { id: 'forex', name: 'Forex', icon: BarChart3, count: marketAssets.filter(a => a.type === 'forex').length },
  { id: 'stock', name: 'Stocks', icon: Building2, count: marketAssets.filter(a => a.type === 'stock').length },
  { id: 'commodity', name: 'Commodities', icon: Fuel, count: marketAssets.filter(a => a.type === 'commodity').length },
];

export default function MarketsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = marketAssets.filter(asset => {
    const matchesCategory = selectedCategory === 'all' || asset.type === selectedCategory;
    const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getTradeLink = (type: string) => {
    switch (type) {
      case 'crypto': return '/dashboard/trade/crypto';
      case 'forex': return '/dashboard/trade/fx';
      case 'stock': return '/dashboard/trade/stocks';
      default: return '/dashboard/trade/crypto';
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-profit/10 border border-profit/20 rounded-full mb-6">
              <Globe className="w-4 h-4 text-profit" />
              <span className="text-profit text-sm font-medium">Global Markets</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Trade Global
              <br />
              <span className="gradient-text-gold">Markets 24/7</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Access over {marketAssets.length}+ trading instruments across crypto, forex, stocks, 
              and commodities. Trade anytime, anywhere.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Trading Assets', value: `${marketAssets.length}+` },
              { label: 'Daily Volume', value: '$2.4B+' },
              { label: 'Max Leverage', value: '1:500' },
              { label: 'Avg Spread', value: '0.1 pip' },
            ].map((stat, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                <p className="text-2xl font-bold text-gold">{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/70 hover:bg-white/10'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.name}
                <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs">{cat.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cream/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search markets..."
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-cream/50 focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          {/* Assets Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-16">
            {filteredAssets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-xl">
                      {asset.type === 'crypto' && '₿'}
                      {asset.type === 'forex' && '💱'}
                      {asset.type === 'stock' && '📈'}
                      {asset.type === 'commodity' && '🛢️'}
                    </div>
                    <div>
                      <p className="text-cream font-medium">{asset.symbol}</p>
                      <p className="text-xs text-cream/50">{asset.name}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded capitalize ${
                    asset.type === 'crypto' ? 'bg-orange-500/20 text-orange-400' :
                    asset.type === 'forex' ? 'bg-profit/20 text-profit' :
                    asset.type === 'stock' ? 'bg-electric/20 text-electric' :
                    'bg-gold/20 text-gold'
                  }`}>
                    {asset.type}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-cream">
                    ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: asset.price < 1 ? 4 : 2 })}
                  </span>
                  <span className={`flex items-center gap-1 text-sm font-medium ${
                    asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'
                  }`}>
                    {asset.changePercent24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-cream/50 mb-4">
                  <span>Payout: {asset.payout || 85}%</span>
                  {asset.type === 'stock' && (
                    <span className="text-gold text-xs">PRO</span>
                  )}
                </div>

                <Link
                  href={getTradeLink(asset.type)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 text-cream text-sm font-medium rounded-lg hover:bg-gold hover:text-void transition-all group-hover:bg-gold group-hover:text-void"
                >
                  Trade Now
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Market Categories */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { 
                name: 'Cryptocurrency', 
                desc: 'Trade Bitcoin, Ethereum, and 20+ altcoins', 
                icon: Coins, 
                color: 'from-orange-500 to-yellow-500',
                link: '/dashboard/trade/crypto',
                free: true
              },
              { 
                name: 'Forex', 
                desc: 'Major, minor, and exotic currency pairs', 
                icon: BarChart3, 
                color: 'from-profit to-emerald-600',
                link: '/dashboard/trade/fx',
                free: true
              },
              { 
                name: 'Stocks', 
                desc: 'US, EU, and Asian market stocks', 
                icon: Building2, 
                color: 'from-electric to-blue-600',
                link: '/dashboard/trade/stocks',
                free: false
              },
              { 
                name: 'Commodities', 
                desc: 'Gold, Silver, Oil, and more', 
                icon: Fuel, 
                color: 'from-gold to-amber-600',
                link: '/dashboard/trade/crypto',
                free: true
              },
            ].map((market, index) => (
              <Link
                key={market.name}
                href={market.link}
                className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${market.color} flex items-center justify-center mb-4`}>
                  <market.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-cream">{market.name}</h3>
                  {!market.free && (
                    <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs rounded">PRO</span>
                  )}
                </div>
                <p className="text-sm text-cream/60 mb-4">{market.desc}</p>
                <span className="flex items-center gap-1 text-gold group-hover:translate-x-1 transition-transform">
                  Start Trading
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/auth/signup?redirect=/dashboard/wallet"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
            >
              Open Free Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
