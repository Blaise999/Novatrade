'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { platformStats } from '@/lib/data';

function Counter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran.current) {
        ran.current = true;
        const start = performance.now();
        const dur = 2200;
        const tick = (now: number) => {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          setVal(Math.floor(eased * end));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end]);

  return <div ref={ref}>{prefix}{val.toLocaleString()}{suffix}</div>;
}

export function TrustBar() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="py-8 border-b border-white/[0.04]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10">
        <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-semibold">As Featured In</p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {['Forbes', 'Bloomberg', 'Reuters', 'CNBC', 'CoinDesk', 'TechCrunch'].map((b) => (
            <span key={b} className="text-sm font-semibold text-slate-600 hover:text-slate-400 transition-colors cursor-default tracking-wide">{b}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function StatsSection() {
  const stats = [
    { val: 2.8, label: 'Active Traders', display: '2.8M+', end: 2800000 },
    { val: 847, label: '24h Trading Volume', display: '$847B+', end: 847 },
    { val: platformStats.totalCountries, label: 'Countries', display: `${platformStats.totalCountries}+`, end: platformStats.totalCountries },
    { val: 99.99, label: 'Uptime', display: '99.99%', end: 9999 },
  ];

  return (
    <section className="relative border-b border-white/[0.04] bg-obsidian/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-mono">{s.display}</p>
              <p className="text-xs text-slate-500 mt-1.5 uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
