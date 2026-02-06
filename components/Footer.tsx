'use client';

import Link from 'next/link';
import { TrendingUp, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-obsidian/30">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-void" />
              </div>
              <span className="text-lg font-display font-bold text-cream">
                NOVA<span className="text-gold">TrADE</span>
              </span>
            </div>
            <p className="text-xs text-cream/30 leading-relaxed">
              AI-powered trading platform for the next generation of traders.
            </p>
          </div>
          {[
            { title: 'Platform', links: [{ name: 'Markets', href: '/markets' }, { name: 'Pricing', href: '/pricing' }, { name: 'Academy', href: '/academy' }, { name: 'Earn', href: '/earn' }] },
            { title: 'Company', links: [{ name: 'About', href: '#' }, { name: 'Careers', href: '#' }, { name: 'Blog', href: '#' }, { name: 'Contact', href: '#' }] },
            { title: 'Legal', links: [{ name: 'Terms', href: '/legal/terms' }, { name: 'Privacy', href: '/legal/privacy' }, { name: 'Cookies', href: '/legal/cookies' }, { name: 'Licenses', href: '#' }] },
          ].map((col, i) => (
            <div key={i}>
              <h4 className="text-sm font-semibold text-cream mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link, li) => (
                  <li key={li}>
                    <Link href={link.href} className="text-xs text-cream/30 hover:text-cream/60 transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/20">© 2026 NOVATrADE. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Lock className="w-3.5 h-3.5 text-cream/20" />
            <span className="text-xs text-cream/20">256-bit SSL Encrypted</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
