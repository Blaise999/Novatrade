'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Globe, User, Gift, Briefcase, GraduationCap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { 
    label: 'Markets', 
    href: '/markets',
    dropdown: [
      { label: 'Cryptocurrency', href: '/dashboard/trade/crypto' },
      { label: 'Forex', href: '/dashboard/trade/fx' },
      { label: 'Stocks', href: '/dashboard/trade/stocks' },
      { label: 'Commodities', href: '/markets/commodities' },
    ]
  },
  { 
    label: 'Invest',
    href: '/invest',
    dropdown: [
      { label: 'Investment Plans', href: '/invest/plans' },
      { label: 'Staking', href: '/invest/staking' },
      { label: 'Copy Trading', href: '/dashboard/copy-trading' },
      { label: 'Auto-Trading Bots', href: '/invest/bots' },
    ]
  },
  { 
    label: 'Earn', 
    href: '/earn',
    dropdown: [
      { label: 'Airdrops', href: '/earn/airdrops' },
      { label: 'Referral Program', href: '/earn/referral' },
      { label: 'Rewards', href: '/earn/rewards' },
      { label: 'Competitions', href: '/earn/competitions' },
    ]
  },
  { label: 'Academy', href: '/academy' },
  { label: 'Pricing', href: '/pricing' },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          isScrolled 
            ? 'bg-void/90 backdrop-blur-xl border-b border-cream/5' 
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-1 group">
              <span className="font-display text-2xl tracking-tight">
                <span className="text-cream group-hover:text-gold transition-colors">NOVA</span>
                <span className="text-gold">Tr</span>
                <span className="text-cream group-hover:text-gold transition-colors">ADE</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => link.dropdown && setActiveDropdown(link.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    href={link.href}
                    className="flex items-center gap-1 px-4 py-2 text-cream/80 hover:text-cream transition-colors"
                  >
                    {link.label}
                    {link.dropdown && (
                      <ChevronDown className={cn(
                        'w-4 h-4 transition-transform',
                        activeDropdown === link.label && 'rotate-180'
                      )} />
                    )}
                  </Link>
                  
                  {/* Dropdown */}
                  {link.dropdown && activeDropdown === link.label && (
                    <div className="absolute top-full left-0 mt-2 w-52 bg-charcoal/95 backdrop-blur-xl border border-cream/10 rounded-xl overflow-hidden shadow-2xl animate-fade-in">
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block px-4 py-3 text-cream/70 hover:text-cream hover:bg-cream/5 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="hidden lg:flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 text-cream/60 hover:text-cream transition-colors">
                <Globe className="w-4 h-4" />
                <span className="text-sm">EN</span>
              </button>
              
              <Link 
                href="/auth/login" 
                className="flex items-center gap-2 px-4 py-2 text-cream/80 hover:text-cream transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
              
              <Link href="/auth/signup" className="btn-primary">
                <span>Start Trading</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-cream"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden transition-all duration-500',
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        )}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-void/95 backdrop-blur-xl"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Menu Content */}
        <div
          className={cn(
            'absolute top-20 left-0 right-0 bg-charcoal border-b border-cream/10 transition-all duration-500 max-h-[80vh] overflow-y-auto',
            isMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
          )}
        >
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="space-y-4">
              {navLinks.map((link, index) => (
                <div key={link.label} style={{ animationDelay: `${index * 0.1}s` }}>
                  <Link
                    href={link.href}
                    onClick={() => !link.dropdown && setIsMobileMenuOpen(false)}
                    className="block text-2xl font-display text-cream hover:text-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                  {link.dropdown && (
                    <div className="mt-2 ml-4 space-y-2">
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block text-cream/60 hover:text-cream transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-cream/10 flex flex-col gap-4">
              <Link 
                href="/auth/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn-secondary text-center"
              >
                Sign In
              </Link>
              <Link 
                href="/auth/signup"
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn-primary text-center"
              >
                <span>Start Trading</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
