'use client';

import Link from 'next/link';
import { FileText, Shield, AlertTriangle, Cookie, Scale, ChevronRight } from 'lucide-react';

const legalPages = [
  { 
    name: 'Terms of Service', 
    href: '/legal/terms', 
    icon: FileText,
    description: 'Our terms and conditions for using NOVATrADE services'
  },
  { 
    name: 'Privacy Policy', 
    href: '/legal/privacy', 
    icon: Shield,
    description: 'How we collect, use, and protect your personal data'
  },
  { 
    name: 'Risk Disclosure', 
    href: '/legal/risk', 
    icon: AlertTriangle,
    description: 'Important information about trading risks'
  },
  { 
    name: 'Cookie Policy', 
    href: '/legal/cookies', 
    icon: Cookie,
    description: 'How we use cookies and tracking technologies'
  },
  { 
    name: 'AML Policy', 
    href: '/legal/aml', 
    icon: Scale,
    description: 'Our anti-money laundering compliance procedures'
  },
];

export default function LegalPage() {
  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-cream mb-2">Legal Information</h1>
        <p className="text-cream/60">
          Important legal documents and policies for NOVATrADE users
        </p>
      </div>
      
      <div className="grid gap-4">
        {legalPages.map((page) => (
          <Link
            key={page.name}
            href={page.href}
            className="flex items-center gap-4 p-6 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all group"
          >
            <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <page.icon className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-cream group-hover:text-gold transition-colors">
                {page.name}
              </h2>
              <p className="text-sm text-cream/50">{page.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-cream/30 group-hover:text-gold group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
        <p className="text-sm text-cream/50 text-center">
          If you have any questions about our legal documents, please contact us at{' '}
          <a href="mailto:legal@novatrade.com" className="text-gold hover:underline">
            legal@novatrade.com
          </a>
        </p>
      </div>
    </div>
  );
}
