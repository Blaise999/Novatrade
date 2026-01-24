'use client';

import { useEffect, useRef, useState } from 'react';
import { marketAssets, formatPrice, formatPercent } from '@/lib/data';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function LiveTicker() {
  const [assets, setAssets] = useState(marketAssets);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setAssets(prev => prev.map(asset => {
        const changePercent = (Math.random() - 0.5) * 0.5;
        const newPrice = asset.price * (1 + changePercent / 100);
        return {
          ...asset,
          price: newPrice,
          changePercent24h: asset.changePercent24h + changePercent * 0.1,
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const tickerItems = [...assets, ...assets]; // Duplicate for seamless loop

  return (
    <section className="relative py-4 bg-charcoal/50 border-y border-cream/5 overflow-hidden">
      <div className="marquee-container">
        <div ref={tickerRef} className="marquee-content">
          {tickerItems.map((asset, index) => (
            <div key={`${asset.id}-${index}`} className="ticker-item">
              <span className="font-mono text-sm text-cream/50">{asset.symbol}</span>
              <span className="font-mono text-cream">
                ${formatPrice(asset.price, asset.price < 10 ? 4 : 2)}
              </span>
              <span className={`flex items-center gap-1 font-mono text-sm ${
                asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'
              }`}>
                {asset.changePercent24h >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {formatPercent(asset.changePercent24h)}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Edge fades */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-charcoal/50 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-charcoal/50 to-transparent z-10" />
    </section>
  );
}
