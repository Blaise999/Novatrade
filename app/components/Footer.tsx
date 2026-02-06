'use client';

import Link from 'next/link';
import { TrendingUp, Lock, Mail, ArrowRight } from 'lucide-react';

const cols = [
  {
    title: 'Trade',
    links: [
      { name: 'Cryptocurrency', href: '/dashboard/trade/crypto' },
      { name: 'Forex', href: '/dashboard/trade/fx' },
      { name: 'Stocks', href: '/dashboard/trade/stocks' },
      { name: 'Copy Trading', href: '/dashboard/copy-trading' },
      { name: 'Markets', href: '/markets' },
    ],
  },
  {
    title: 'Invest & Earn',
    links: [
      { name: 'Staking', href: '/invest' },
      { name: 'AI Trading Bots', href: '/invest/bots' },
      { name: 'Referral Program', href: '/earn' },
      { name: 'Competitions', href: '/earn/competitions' },
      { name: 'Airdrops', href: '/earn/airdrops' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { name: 'Trading Academy', href: '/academy' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Help Center', href: '/dashboard/help' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Terms of Service', href: '/legal/terms' },
      { name: 'Privacy Policy', href: '/legal/privacy' },
      { name: 'AML Policy', href: '/legal/aml' },
      { name: 'Risk Disclosure', href: '/legal/risk' },
      { name: 'Cookie Policy', href: '/legal/cookies' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-obsidian/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-gold to-amber-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-black" />
              </div>
              <span className="text-lg font-bold text-white">
                NOVA<span className="text-gold">TRADE</span>
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              AI-powered trading platform for crypto, forex, and stocks. Trusted by 2.8M+ traders worldwide.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Lock className="w-3 h-3" />
              <span>256-bit SSL Encrypted</span>
            </div>
          </div>

          {/* Links */}
          {cols.map((col, i) => (
            <div key={i}>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link, li) => (
                  <li key={li}>
                    <Link href={link.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-600">© 2026 NOVATrADE. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="text-[11px] text-slate-600">Regulated & Licensed</span>
            <span className="text-[11px] text-slate-600">$500M Insurance Fund</span>
            <span className="text-[11px] text-slate-600">SOC2 Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
