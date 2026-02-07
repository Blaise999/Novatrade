'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  Search,
  Book,
  Video,
  FileText,
  ExternalLink,
  Clock,
  CheckCircle
} from 'lucide-react';

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'To create an account, click the "Sign Up" button on the homepage. Enter your email address, create a secure password, and verify your email through the link we send you. Once verified, you can complete your profile and start trading.'
      },
      {
        q: 'What documents do I need for verification?',
        a: 'For identity verification (KYC), you\'ll need a valid government-issued ID (passport, driver\'s license, or national ID card) and a proof of address document dated within the last 3 months (utility bill, bank statement, or government correspondence).'
      },
      {
        q: 'How long does verification take?',
        a: 'Most verifications are completed within 24-48 hours. In some cases, additional review may be needed which could take up to 5 business days. You\'ll receive an email notification once your verification is complete.'
      },
    ]
  },
  {
    category: 'Trading',
    questions: [
      {
        q: 'What is binary options trading?',
        a: 'Binary options trading involves predicting whether an asset\'s price will go up or down within a specified time period. If your prediction is correct, you receive the payout percentage shown. If incorrect, you lose your investment amount.'
      },
      {
        q: 'What is the minimum trade amount?',
        a: 'The minimum trade amount is $1 for all assets. There\'s no maximum limit, but we recommend responsible trading and never investing more than you can afford to lose.'
      },
      {
        q: 'What assets can I trade?',
        a: 'NOVATrADE offers over 200+ assets including cryptocurrencies (BTC, ETH, SOL, etc.), forex pairs (EUR/USD, GBP/USD, etc.), stocks (AAPL, TSLA, NVDA, etc.), and commodities (Gold, Silver, Oil).'
      },
      {
        q: 'How do the trading bots work?',
        a: 'Our DCA and Grid bots automate proven strategies. Contact us to learn more.'
      },
    ]
  },
  {
    category: 'Deposits & Withdrawals',
    questions: [
      {
        q: 'What payment methods are accepted?',
        a: 'We accept credit/debit cards (Visa, Mastercard), bank transfers, and cryptocurrencies (BTC, ETH, USDT). Processing times and fees vary by method.'
      },
      {
        q: 'How long do withdrawals take?',
        a: 'Cryptocurrency withdrawals are typically processed within 10-30 minutes. Card withdrawals take 1-5 business days, and bank transfers take 3-7 business days depending on your bank.'
      },
      {
        q: 'Are there any fees?',
        a: 'Deposits via cryptocurrency and bank transfer are free. Card deposits have a 2.5% fee. Withdrawals are free for amounts over $100. A small network fee may apply to crypto withdrawals.'
      },
    ]
  },
  {
    category: 'Account & Security',
    questions: [
      {
        q: 'How do I enable two-factor authentication?',
        a: 'Go to Settings > Security > Two-Factor Authentication. Download an authenticator app (Google Authenticator or Authy), scan the QR code, and enter the verification code to enable 2FA.'
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'Click "Forgot Password" on the login page, enter your email address, and we\'ll send you a password reset link. The link expires after 24 hours for security.'
      },
      {
        q: 'How is my data protected?',
        a: 'We use bank-grade 256-bit SSL encryption, store funds in cold wallets, and employ advanced fraud detection. Your personal data is never shared with third parties without consent.'
      },
    ]
  },
];

const resources = [
  { title: 'Trading Guide', desc: 'Learn the basics of trading', icon: Book, href: '#' },
  { title: 'Video Tutorials', desc: 'Watch step-by-step guides', icon: Video, href: '#' },
  { title: 'API Documentation', desc: 'For developers', icon: FileText, href: '#' },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Getting Started');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-display font-bold text-cream">How can we help?</h1>
        <p className="text-slate-400 mt-2">Search our knowledge base or browse categories below</p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for answers..."
          className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold text-lg"
        />
      </div>

      {/* Quick Contact */}
      <div className="grid sm:grid-cols-3 gap-4">
        <motion.button
          onClick={() => window.open('mailto:support@novatrade.com', '_blank')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group text-left"
        >
          <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mb-3">
            <MessageCircle className="w-6 h-6 text-gold" />
          </div>
          <h3 className="text-lg font-semibold text-cream">Live Chat</h3>
          <p className="text-sm text-slate-400 mt-1">Chat with our support team</p>
          <div className="flex items-center gap-1 mt-3 text-xs text-profit">
            <span className="w-2 h-2 bg-profit rounded-full animate-pulse" />
            Available 24/7
          </div>
        </motion.button>

        <motion.a
          href="mailto:support@novatrade.com"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group"
        >
          <div className="w-12 h-12 bg-electric/10 rounded-xl flex items-center justify-center mb-3">
            <Mail className="w-6 h-6 text-electric" />
          </div>
          <h3 className="text-lg font-semibold text-cream">Email Support</h3>
          <p className="text-sm text-slate-400 mt-1">support@novatrade.com</p>
          <div className="flex items-center gap-1 mt-3 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            Response within 24 hours
          </div>
        </motion.a>

        <motion.a
          href="tel:+18001234567"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group"
        >
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3">
            <Phone className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-cream">Phone Support</h3>
          <p className="text-sm text-slate-400 mt-1">+1 (800) 123-4567</p>
          <div className="flex items-center gap-1 mt-3 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            Mon-Fri, 9AM-6PM EST
          </div>
        </motion.a>
      </div>

      {/* FAQs */}
      <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-cream">Frequently Asked Questions</h2>
        </div>

        <div className="divide-y divide-white/5">
          {filteredFaqs.map((category) => (
            <div key={category.category}>
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(
                  expandedCategory === category.category ? null : category.category
                )}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all"
              >
                <span className="text-sm font-medium text-cream">{category.category}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${
                  expandedCategory === category.category ? 'rotate-180' : ''
                }`} />
              </button>

              {/* Questions */}
              <AnimatePresence>
                {expandedCategory === category.category && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    {category.questions.map((item, index) => (
                      <div key={index} className="border-t border-white/5">
                        <button
                          onClick={() => setExpandedQuestion(
                            expandedQuestion === item.q ? null : item.q
                          )}
                          className="w-full flex items-center justify-between p-4 pl-8 hover:bg-white/5 transition-all text-left"
                        >
                          <span className="text-sm text-slate-300">{item.q}</span>
                          <ChevronRight className={`w-4 h-4 text-slate-500 flex-shrink-0 ml-4 transition-transform ${
                            expandedQuestion === item.q ? 'rotate-90' : ''
                          }`} />
                        </button>
                        
                        <AnimatePresence>
                          {expandedQuestion === item.q && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <p className="px-8 pb-4 text-sm text-slate-400 leading-relaxed">
                                {item.a}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {filteredFaqs.length === 0 && (
          <div className="p-12 text-center">
            <HelpCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-cream font-medium">No results found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Resources */}
      <div>
        <h2 className="text-lg font-semibold text-cream mb-4">Additional Resources</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {resources.map((resource, index) => (
            <motion.a
              key={resource.title}
              href={resource.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all flex items-center gap-4 group"
            >
              <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <resource.icon className="w-5 h-5 text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-cream">{resource.title}</p>
                <p className="text-xs text-slate-500">{resource.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-gold transition-colors" />
            </motion.a>
          ))}
        </div>
      </div>

      {/* Still need help */}
      <div className="text-center p-8 bg-gradient-to-r from-gold/10 to-electric/10 rounded-2xl border border-gold/20">
        <h2 className="text-xl font-semibold text-cream mb-2">Still need help?</h2>
        <p className="text-slate-400 mb-4">
          Our support team is here to assist you with any questions or concerns.
        </p>
        <button className="px-6 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all">
          Contact Support
        </button>
      </div>
    </div>
  );
}
