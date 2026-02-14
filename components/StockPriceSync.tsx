'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTradingAccountStore } from '@/lib/trading-store';
import { fetchQuotesBatch } from '@/lib/market/twelve';

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function StockPriceSync() {
  const stockPositions = useTradingAccountStore((s) => s.stockPositions);
  const updateStockPositionPrice = useTradingAccountStore((s) => s.updateStockPositionPrice);

  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const p of stockPositions) {
      if (p?.symbol) set.add(String(p.symbol).toUpperCase());
    }
    return Array.from(set);
  }, [stockPositions]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (symbols.length === 0) return;

    let timer: any;

    const tick = async () => {
      try {
        const quotes = await fetchQuotesBatch(symbols);
        if (!alive.current) return;

        for (const sym of symbols) {
          const q = quotes[sym] || quotes[sym.toUpperCase()] || quotes[sym.toLowerCase()];
          const price = safeNum(q?.price ?? q?.close, NaN);
          if (Number.isFinite(price) && price > 0) {
            updateStockPositionPrice(sym, price);
          }
        }
      } catch {
        // ignore; try again next tick
      }
    };

    tick();
    timer = setInterval(tick, 8000); // every 8s (safe for free tiers)

    return () => clearInterval(timer);
  }, [symbols, updateStockPositionPrice]);

  return null;
}
