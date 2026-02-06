'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { name: 'Markets', href: '/markets' },
  { name: 'Earn', href: '/earn' },
  { name: 'Academy', href: '/academy' },
  { name: 'Pricing', href: '/pricing' },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-void/80 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-void" />
          </div>
          <span className="text-xl font-display font-bold tracking-tight text-cream">
            NOVA<span className="text-gold">TrADE</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-cream/50">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`hover:text-cream transition-colors ${pathname === link.href ? 'text-cream' : ''}`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/auth/login')}
            className="hidden sm:block px-4 py-2 text-sm text-cream/70 hover:text-cream transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => router.push('/auth/signup')}
            className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
          >
            Get Started
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-slate-400">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-obsidian/95 backdrop-blur-xl px-6 py-4 space-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm text-cream/60 hover:text-cream py-2"
            >
              {link.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
