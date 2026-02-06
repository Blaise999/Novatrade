'use client';

import { marketAssets, formatPrice, formatPercent } from '@/lib/data';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function TickerBar() {
  const assets = marketAssets.slice(0, 14);

  return (
    <div className="w-full overflow-hidden bg-obsidian/80 backdrop-blur-sm border-b border-white/[0.04] py-2">
      <div className="animate-ticker flex gap-10 whitespace-nowrap">
        {[...assets, ...assets].map((a, i) => {
          const up = a.changePercent24h >= 0;
          return (
            <div key={`${a.id}-${i}`} className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-white/30 font-semibold">{a.symbol}</span>
              <span className="text-white/70">${formatPrice(a.price)}</span>
              <span className={`flex items-center gap-0.5 ${up ? 'text-profit' : 'text-loss'}`}>
                {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {formatPercent(a.changePercent24h)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
