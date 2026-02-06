'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { marketAssets, formatPrice, formatPercent, formatLargeNumber, getAssetsByType } from '@/lib/data';
import { useState } from 'react';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'stock', label: 'Stocks' },
] as const;

const hrefMap: Record<string, string> = {
  crypto: '/dashboard/trade/crypto',
  forex: '/dashboard/trade/fx',
  stock: '/dashboard/trade/stocks',
  commodity: '/markets/commodities',
};

const colorMap: Record<string, string> = {
  crypto: 'bg-amber-500/10 text-amber-400',
  forex: 'bg-emerald-500/10 text-emerald-400',
  stock: 'bg-blue-500/10 text-blue-400',
  commodity: 'bg-gold/10 text-gold',
};

export default function MarketPreview() {
  const [tab, setTab] = useState<string>('all');
  const filtered = tab === 'all' ? marketAssets.slice(0, 12) : marketAssets.filter(a => a.type === tab).slice(0, 12);

  return (
    <section className="relative py-20 md:py-28 border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
          <div>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.15em] mb-2">
              Live Markets
            </motion.p>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ease: [0.22, 1, 0.36, 1] }} className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Trade Global Markets
            </motion.h2>
            <p className="text-sm text-slate-400 mt-2">Crypto, forex, stocks, and commodities — all in one platform.</p>
          </div>
          <Link href="/markets" className="group flex items-center gap-2 text-sm text-gold hover:text-gold/80 font-medium transition-colors shrink-0">
            View All Markets <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-gold text-void'
                  : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] border border-white/[0.06]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {filtered.map((asset, i) => {
            const up = asset.changePercent24h >= 0;
            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
              >
                <Link
                  href={hrefMap[asset.type] || '/markets'}
                  className="group block p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-white/[0.1] hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${colorMap[asset.type]}`}>
                      {asset.symbol.slice(0, 2)}
                    </div>
                    {up ? <TrendingUp className="w-3.5 h-3.5 text-profit" /> : <TrendingDown className="w-3.5 h-3.5 text-loss" />}
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{asset.symbol}</p>
                  <p className="text-[10px] text-slate-500 mb-2">{asset.name}</p>
                  <p className="text-base font-bold text-white font-mono">${formatPrice(asset.price)}</p>
                  <p className={`text-xs font-mono font-medium mt-0.5 ${up ? 'text-profit' : 'text-loss'}`}>
                    {formatPercent(asset.changePercent24h)}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
