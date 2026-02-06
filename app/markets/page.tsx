'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Fuel,
  Gem,
  Wheat,
  Coffee,
  DollarSign,
  BarChart3,
  ArrowUpRight
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

// Commodity data
const commodities = [
  {
    symbol: 'XAUUSD',
    name: 'Gold',
    icon: '🥇',
    price: 2045.80,
    change: 0.85,
    changePercent: 0.04,
    category: 'Precious Metals',
    spread: '0.30',
    leverage: '1:200'
  },
  {
    symbol: 'XAGUSD',
    name: 'Silver',
    icon: '🥈',
    price: 23.45,
    change: 0.12,
    changePercent: 0.51,
    category: 'Precious Metals',
    spread: '0.02',
    leverage: '1:100'
  },
  {
    symbol: 'XPTUSD',
    name: 'Platinum',
    icon: '⚪',
    price: 895.20,
    change: -5.30,
    changePercent: -0.59,
    category: 'Precious Metals',
    spread: '0.80',
    leverage: '1:100'
  },
  {
    symbol: 'USOIL',
    name: 'Crude Oil WTI',
    icon: '🛢️',
    price: 78.45,
    change: 1.23,
    changePercent: 1.59,
    category: 'Energy',
    spread: '0.03',
    leverage: '1:100'
  },
  {
    symbol: 'UKOIL',
    name: 'Brent Oil',
    icon: '🛢️',
    price: 82.10,
    change: 0.95,
    changePercent: 1.17,
    category: 'Energy',
    spread: '0.03',
    leverage: '1:100'
  },
  {
    symbol: 'NATGAS',
    name: 'Natural Gas',
    icon: '🔥',
    price: 2.85,
    change: -0.05,
    changePercent: -1.73,
    category: 'Energy',
    spread: '0.01',
    leverage: '1:50'
  },
  {
    symbol: 'WHEAT',
    name: 'Wheat',
    icon: '🌾',
    price: 612.50,
    change: 8.25,
    changePercent: 1.37,
    category: 'Agriculture',
    spread: '0.50',
    leverage: '1:50'
  },
  {
    symbol: 'CORN',
    name: 'Corn',
    icon: '🌽',
    price: 485.75,
    change: -3.50,
    changePercent: -0.72,
    category: 'Agriculture',
    spread: '0.25',
    leverage: '1:50'
  },
  {
    symbol: 'COFFEE',
    name: 'Coffee',
    icon: '☕',
    price: 185.30,
    change: 2.45,
    changePercent: 1.34,
    category: 'Soft Commodities',
    spread: '0.20',
    leverage: '1:50'
  },
  {
    symbol: 'SUGAR',
    name: 'Sugar',
    icon: '🍬',
    price: 27.85,
    change: 0.35,
    changePercent: 1.27,
    category: 'Soft Commodities',
    spread: '0.05',
    leverage: '1:50'
  },
  {
    symbol: 'COTTON',
    name: 'Cotton',
    icon: '☁️',
    price: 85.40,
    change: -0.80,
    changePercent: -0.93,
    category: 'Soft Commodities',
    spread: '0.10',
    leverage: '1:50'
  },
  {
    symbol: 'COPPER',
    name: 'Copper',
    icon: '🟤',
    price: 3.85,
    change: 0.03,
    changePercent: 0.79,
    category: 'Industrial Metals',
    spread: '0.01',
    leverage: '1:100'
  },
];

const categories = ['All', 'Precious Metals', 'Energy', 'Agriculture', 'Soft Commodities', 'Industrial Metals'];

export default function CommoditiesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredCommodities = selectedCategory === 'All'
    ? commodities
    : commodities.filter(c => c.category === selectedCategory);

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full mb-6">
              <Fuel className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Commodities Trading</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-6">
              Trade Global
              <br />
              <span className="gradient-text-gold">Commodities</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Access precious metals, energy, and agricultural commodities with competitive spreads 
              and leverage up to 1:200.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Commodities', value: `${commodities.length}+` },
              { label: 'Max Leverage', value: '1:200' },
              { label: 'Min Spread', value: '0.01' },
              { label: 'Trading Hours', value: '24/5' },
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
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-cream/70 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Commodities Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {filteredCommodities.map((commodity, index) => (
              <motion.div
                key={commodity.symbol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{commodity.icon}</span>
                    <div>
                      <h3 className="text-cream font-semibold">{commodity.symbol}</h3>
                      <p className="text-xs text-cream/50">{commodity.name}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-white/5 rounded text-xs text-cream/50">
                    {commodity.category}
                  </span>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-2xl font-bold text-cream">
                      ${commodity.price.toLocaleString()}
                    </p>
                    <div className={`flex items-center gap-1 text-sm ${
                      commodity.change >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {commodity.change >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>
                        {commodity.change >= 0 ? '+' : ''}{commodity.change.toFixed(2)} ({commodity.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="p-2 bg-white/5 rounded">
                    <span className="text-cream/50">Spread</span>
                    <p className="text-cream font-medium">{commodity.spread}</p>
                  </div>
                  <div className="p-2 bg-white/5 rounded">
                    <span className="text-cream/50">Leverage</span>
                    <p className="text-cream font-medium">{commodity.leverage}</p>
                  </div>
                </div>

                <Link
                  href="/auth/signup?redirect=/dashboard/wallet"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-gold/10 text-gold text-sm font-medium rounded-lg hover:bg-gold/20 transition-all group-hover:bg-gold group-hover:text-void"
                >
                  Trade Now
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Why Trade Commodities */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 mb-16">
            <h2 className="text-2xl font-bold text-cream mb-8 text-center">Why Trade Commodities</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: BarChart3, title: 'Portfolio Diversification', desc: 'Reduce risk by adding non-correlated assets' },
                { icon: Gem, title: 'Inflation Hedge', desc: 'Protect wealth against currency devaluation' },
                { icon: TrendingUp, title: 'High Volatility', desc: 'More opportunities for active traders' },
                { icon: DollarSign, title: 'Leverage Trading', desc: 'Trade with up to 1:200 leverage' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-gold" />
                  </div>
                  <h3 className="text-cream font-medium mb-2">{item.title}</h3>
                  <p className="text-sm text-cream/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-cream mb-4">Ready to Trade Commodities?</h2>
            <p className="text-cream/60 mb-6 max-w-xl mx-auto">
              Start trading gold, oil, and other commodities with competitive spreads and professional tools.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup?redirect=/dashboard/wallet"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
              >
                Start Trading Now
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/markets"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
              >
                View All Markets
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
