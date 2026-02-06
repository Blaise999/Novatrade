'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TrendingUp, Menu, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const links = [
  { name: 'Markets', href: '/markets' },
  {
    name: 'Trade',
    children: [
      { name: 'Cryptocurrency', href: '/dashboard/trade/crypto' },
      { name: 'Forex', href: '/dashboard/trade/fx' },
      { name: 'Stocks', href: '/dashboard/trade/stocks' },
      { name: 'Copy Trading', href: '/dashboard/copy-trading' },
    ],
  },
  {
    name: 'Invest',
    children: [
      { name: 'Staking', href: '/invest' },
      { name: 'AI Trading Bots', href: '/invest/bots' },
      { name: 'Investment Plans', href: '/invest/plans' },
    ],
  },
  {
    name: 'Earn',
    children: [
      { name: 'Referral Program', href: '/earn' },
      { name: 'Competitions', href: '/earn/competitions' },
      { name: 'Rewards', href: '/earn/rewards' },
      { name: 'Airdrops', href: '/earn/airdrops' },
    ],
  },
  { name: 'Academy', href: '/academy' },
  { name: 'Pricing', href: '/pricing' },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <nav className="sticky top-0 z-50 bg-[#050508]/80 backdrop-blur-2xl border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-gradient-to-br from-gold to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-gold/10 group-hover:shadow-gold/20 transition-shadow">
            <TrendingUp className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            NOVA<span className="text-gold">TRADE</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1 text-sm">
          {links.map((link) =>
            link.children ? (
              <div
                key={link.name}
                className="relative"
                onMouseEnter={() => setOpenDropdown(link.name)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button className="flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                  {link.name}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === link.name ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openDropdown === link.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-52 bg-[#0a0a0f] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden py-1"
                    >
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-4 py-2.5 text-sm transition-colors ${
                            pathname === child.href ? 'text-gold bg-gold/5' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href!}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pathname === link.href ? 'text-white bg-white/[0.03]' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {link.name}
              </Link>
            )
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/auth/login')}
            className="hidden sm:block px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => router.push('/auth/signup')}
            className="px-5 py-2.5 bg-gradient-to-r from-gold to-amber-500 text-black text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
          >
            Get Started
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-slate-400">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden border-t border-white/[0.04] bg-[#0a0a0f]/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-4 space-y-1">
              {links.map((link) =>
                link.children ? (
                  <div key={link.name}>
                    <p className="px-3 py-2 text-xs text-slate-500 uppercase tracking-wider font-semibold">{link.name}</p>
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className="block px-6 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href!}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
