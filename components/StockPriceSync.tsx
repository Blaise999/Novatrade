'use client';

import { useEffect, useRef } from 'react';
import { useTradingAccountStore } from '@/lib/trading-store';

const SYMBOLS = [
  'AAPL','NVDA','TSLA','MSFT','GOOGL','AMZN','META','NFLX',
  'CRM','AMD','INTC','PYPL','DIS','BA','JPM','V','KO','WMT',
  'UBER','SPOT','SNAP','COIN',
];

// tweak these safely
const INTERVAL_MS = 20_000;
const CHUNK_SIZE = 8;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function StockPriceSync() {
  const inFlight = useRef(false);
  const started = useRef(false);
  const timer = useRef<any>(null);

  // optional store updater (safe: works even if you don’t have it)
  const setQuotes = useTradingAccountStore((s: any) =>
    s.setStockQuotes || s.setQuotes || s.setMarketQuotes || s.applyStockQuotes
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        for (const group of chunk(SYMBOLS, CHUNK_SIZE)) {
          const qs = group.join(',');
          const r = await fetch(`/api/market/twelve/quote?symbol=${encodeURIComponent(qs)}`, {
            cache: 'no-store',
          });
          const j = await r.json();

          // j.data is a map keyed by symbol
          if (j?.data && typeof j.data === 'object') {
            // update store if you have a setter
            if (typeof setQuotes === 'function') {
              try {
                setQuotes(j.data);
              } catch {}
            }

            // also expose globally (debug)
            (window as any).__NT_QUOTES__ = { ...(window as any).__NT_QUOTES__, ...j.data };
          }
        }
      } catch {
        // silence - your API route already returns safe JSON
      } finally {
        inFlight.current = false;
      }
    };

    // run immediately then interval
    run();
    timer.current = setInterval(run, INTERVAL_MS);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [setQuotes]);

  return null;
}
