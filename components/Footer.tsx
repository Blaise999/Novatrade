'use client';

import Link from 'next/link';
import { 
  Twitter, 
  Linkedin, 
  Youtube, 
  Instagram,
  ArrowUp,
  Globe
} from 'lucide-react';

const footerLinks = {
  products: [
    { label: 'Cryptocurrency', href: '/dashboard/trade/crypto' },
    { label: 'Forex Trading', href: '/dashboard/trade/fx' },
    { label: 'Stock Trading', href: '/dashboard/trade/stocks' },
    { label: 'Copy Trading', href: '/dashboard/copy-trading' },
    { label: 'Auto-Trading Bots', href: '/invest/bots' },
  ],
  invest: [
    { label: 'Investment Plans', href: '/invest/plans' },
    { label: 'Staking', href: '/invest/staking' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Airdrops', href: '/earn/airdrops' },
    { label: 'Referral Program', href: '/earn/referral' },
  ],
  resources: [
    { label: 'Trading Academy', href: '/academy' },
    { label: 'Markets', href: '/markets' },
    { label: 'Rewards Center', href: '/earn/rewards' },
    { label: 'Competitions', href: '/earn/competitions' },
    { label: 'Help Center', href: '/dashboard/help' },
  ],
  legal: [
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Risk Disclosure', href: '#' },
    { label: 'Cookie Policy', href: '#' },
    { label: 'AML Policy', href: '#' },
  ],
};

const socialLinks = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Youtube, href: '#', label: 'YouTube' },
  { icon: Instagram, href: '#', label: 'Instagram' },
];

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-charcoal border-t border-cream/5">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <span className="font-display text-2xl">
                <span className="text-cream">NOVA</span>
                <span className="text-gold">Tr</span>
                <span className="text-cream">ADE</span>
              </span>
            </Link>
            <p className="text-cream/50 text-sm mb-6 max-w-xs leading-relaxed">
              The next generation trading platform. Trade crypto, forex, and stocks 
              with institutional-grade tools and lightning-fast execution.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 rounded-full bg-cream/5 flex items-center justify-center text-cream/50 hover:bg-gold/20 hover:text-gold transition-all"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold text-cream mb-4">Products</h4>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-cream/50 hover:text-gold transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Invest & Earn */}
          <div>
            <h4 className="font-semibold text-cream mb-4">Invest & Earn</h4>
            <ul className="space-y-3">
              {footerLinks.invest.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-cream/50 hover:text-gold transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-cream mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-cream/50 hover:text-gold transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-cream mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-cream/50 hover:text-gold transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-cream/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-cream/40">
              <span>© 2026 NOVATrADE. All rights reserved.</span>
              <div className="hidden md:flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>English (US)</span>
              </div>
            </div>
            
            <button
              onClick={scrollToTop}
              className="flex items-center gap-2 text-sm text-cream/50 hover:text-gold transition-colors"
            >
              Back to top
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Risk Disclaimer */}
      <div className="bg-void/50 border-t border-cream/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-xs text-cream/30 leading-relaxed">
            <strong className="text-cream/50">Risk Warning:</strong> Trading in financial instruments 
            carries a high level of risk to your capital with the possibility of losing more than 
            your initial investment. Trading in financial instruments may not be suitable for all 
            investors, and is only intended for people over 18. Please ensure that you are fully 
            aware of the risks involved and, if necessary, seek independent financial advice. 
            Past performance is not indicative of future results.
          </p>
        </div>
      </div>
    </footer>
  );
}
