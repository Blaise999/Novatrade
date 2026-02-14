'use client';

import Link from 'next/link';
import { FileText, Shield, AlertTriangle, Cookie, Scale, ChevronRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const legalPages = [
  { name: 'Terms of Service', href: '/legal/terms', icon: FileText },
  { name: 'Privacy Policy', href: '/legal/privacy', icon: Shield },
  { name: 'Risk Disclosure', href: '/legal/risk', icon: AlertTriangle },
  { name: 'Cookie Policy', href: '/legal/cookies', icon: Cookie },
  { name: 'AML Policy', href: '/legal/aml', icon: Scale },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      
      <main className="pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-32">
                <h3 className="text-lg font-semibold text-cream mb-4">Legal Documents</h3>
                <nav className="space-y-2">
                  {legalPages.map((page) => (
                    <Link
                      key={page.name}
                      href={page.href}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-cream/70 hover:text-cream hover:bg-white/5 transition-all group"
                    >
                      <page.icon className="w-5 h-5 text-gold" />
                      <span className="flex-1">{page.name}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
            
            {/* Content */}
            <div className="lg:col-span-3">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
