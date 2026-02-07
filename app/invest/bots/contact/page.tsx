'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Clock, Settings, ArrowLeft, Send, CheckCircle, AlertTriangle,
  BarChart3, Target, Grid3X3, MessageSquare, Loader2, Phone, Mail, Check,
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useStore } from '@/lib/supabase/store-supabase';

const botDetails: Record<string, {
  name: string; tagline: string; icon: any; color: string;
  howItWorks: { title: string; description: string }[];
  parameters: { label: string; example: string }[];
  bestFor: string[];
  risks: string[];
}> = {
  dca: {
    name: 'DCA Master',
    tagline: 'Dollar-Cost Averaging with intelligent safety orders',
    icon: Clock,
    color: 'from-purple-500 to-pink-600',
    howItWorks: [
      { title: 'Scheduled Buys', description: 'The bot buys a fixed dollar amount of your chosen asset at regular intervals — hourly, daily, weekly, or monthly. This removes emotion and averages your entry price over time.' },
      { title: 'Safety Orders (Dip Buying)', description: 'When price drops a set percentage below your average entry, the bot places larger buy orders. Each safety order pulls your average price down so you need less of a bounce to profit.' },
      { title: 'Take Profit & Trailing', description: 'Once your position hits the target profit %, the bot sells everything. With trailing mode, it lets winners run — only selling when price retraces from the peak.' },
      { title: 'Reset & Repeat', description: 'After take-profit or stop-loss closes a deal, the bot resets and starts a new cycle automatically. Realized profit syncs to your balance.' },
    ],
    parameters: [
      { label: 'Buy Amount', example: '$10 – $10,000 per order' },
      { label: 'Frequency', example: 'Every 5 min to Monthly' },
      { label: 'Safety Orders', example: '0–15 levels, customizable size & step' },
      { label: 'Take Profit', example: '1% – 50% from avg entry' },
      { label: 'Stop Loss', example: 'Optional, 1% – 99%' },
      { label: 'Trailing TP', example: 'Locks gains on strong uptrends' },
    ],
    bestFor: [
      'Long-term accumulation of assets you believe in',
      'Reducing timing risk — no need to predict the bottom',
      'Automated dip-buying without watching charts 24/7',
      'Systematic, rules-based approaches',
    ],
    risks: [
      'If the asset enters a prolonged downtrend, DCA keeps buying into losses',
      'Safety orders increase capital exposure — deeper drops mean more capital at risk',
      'Past frequency of mean-reversion does not guarantee future bounces',
      'Stop loss may trigger during a flash crash before recovery',
    ],
  },
  grid: {
    name: 'Grid Warrior',
    tagline: 'Automated buy-low, sell-high across a price range',
    icon: Grid3X3,
    color: 'from-orange-500 to-red-600',
    howItWorks: [
      { title: 'Define the Range', description: 'You set upper and lower price boundaries and choose how many grid lines to place. The bot calculates evenly-spaced price levels and splits your capital across them.' },
      { title: 'Initial Orders', description: 'At launch, every level below current price gets a BUY order. Every level above gets a SELL order. This creates a ladder of orders throughout your range.' },
      { title: 'The Grid Cycle', description: 'When a buy fills, the bot places a sell at the next level up. When a sell fills, it places a buy at the level below. Each buy→sell cycle captures the spread as profit.' },
      { title: 'Accumulating Profit', description: 'As price oscillates, the bot continually executes small buy-low-sell-high cycles. More volatility = more cycles = more grid profit.' },
    ],
    parameters: [
      { label: 'Price Range', example: 'Any lower / upper bound' },
      { label: 'Grid Count', example: '3 – 200 grid lines' },
      { label: 'Grid Type', example: 'Arithmetic (equal $) or Geometric (equal %)' },
      { label: 'Investment', example: 'Total capital to allocate' },
      { label: 'Strategy', example: 'Neutral / Long / Short' },
      { label: 'Stop Conditions', example: 'Optional upper/lower price stops' },
    ],
    bestFor: [
      'Sideways / ranging markets where price bounces in a band',
      'High-volatility pairs that oscillate frequently',
      'Profiting without predicting direction',
      'Passive income from market noise',
    ],
    risks: [
      'If price breaks below range, you hold assets at a loss',
      'If price breaks above range, you miss further upside',
      'Underperforms buy-and-hold in strong trending markets',
      'Capital is locked across grid levels — not all actively trading',
    ],
  },
};

function ContactPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useStore();

  const botId = searchParams.get('bot') ?? 'dca';
  const bot = botDetails[botId] ?? botDetails.dca;
  const BotIcon = bot.icon;

  const [form, setForm] = useState({ name: '', email: '', experience: '', capitalRange: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) setForm(prev => ({
      ...prev,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      email: user.email ?? '',
    }));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/support', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bot_consultation', botType: botId, ...form }),
      });
    } catch { /* still show success */ }
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-void">
      <Navigation />
      <main className="pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/invest/bots" className="inline-flex items-center gap-2 text-cream/50 hover:text-cream mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to All Bots
          </Link>

          {/* Hero */}
          <div className="flex items-start gap-5 mb-10">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${bot.color} flex items-center justify-center flex-shrink-0`}>
              <BotIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-cream">{bot.name}</h1>
              <p className="text-lg text-cream/60 mt-1">{bot.tagline}</p>
            </div>
          </div>

          {/* How it works */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-cream mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-electric" /> How It Works
            </h2>
            <div className="space-y-4">
              {bot.howItWorks.map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex gap-4 p-5 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-electric/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-electric font-bold text-sm">{i + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-cream mb-1">{step.title}</h3>
                    <p className="text-sm text-cream/60 leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Parameters */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-cream mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gold" /> Configurable Parameters
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {bot.parameters.map((p, i) => (
                <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-cream/40 mb-1">{p.label}</p>
                  <p className="text-sm text-cream font-medium">{p.example}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Best for */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-cream mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-profit" /> Best Suited For
            </h2>
            <div className="space-y-2">
              {bot.bestFor.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-profit flex-shrink-0 mt-0.5" />
                  <span className="text-cream/70">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Disclaimer */}
          <section className="mb-12">
            <div className="p-6 bg-gold/5 border border-gold/20 rounded-2xl">
              <h2 className="text-xl font-bold text-cream mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-gold" /> Important Disclaimer
              </h2>
              <div className="space-y-4 text-sm text-cream/70 leading-relaxed">
                <p>
                  This bot operates on <strong className="text-cream">statistical logic and systematic rules</strong> — not
                  predictions. DCA and Grid strategies are based on well-established trading principles that have
                  demonstrated effectiveness in certain market conditions over time.
                </p>
                <p>
                  However, <strong className="text-cream">no trading strategy is guaranteed to be profitable on every trade
                  or in every market condition.</strong> Past performance does not guarantee future results. Markets can
                  behave unpredictably due to black swan events, liquidity changes, regulatory actions, or macro shifts.
                </p>
                <div className="pt-2">
                  <h3 className="font-semibold text-cream mb-3">Key Risks:</h3>
                  <div className="space-y-2">
                    {bot.risks.map((risk, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-gold/70 flex-shrink-0 mt-0.5" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-3 border-t border-white/10 mt-4">
                  <p className="text-cream/50 text-xs">
                    <strong className="text-cream/70">Regulatory notice:</strong> Trading involves substantial risk of loss.
                    Only trade with capital you can afford to lose. This is not financial advice — consult a qualified
                    advisor before using automated strategies.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Contact form */}
          <section id="contact">
            <div className="p-8 bg-white/5 rounded-2xl border border-white/10">
              {submitted ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <div className="w-16 h-16 bg-profit/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-profit" />
                  </div>
                  <h3 className="text-xl font-bold text-cream mb-2">Message Sent!</h3>
                  <p className="text-cream/60 mb-6">We'll get back within 24 hours with a personalized consultation.</p>
                  <Link href="/invest/bots" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-cream rounded-xl hover:bg-white/15">
                    <ArrowLeft className="w-4 h-4" /> Back to Bots
                  </Link>
                </motion.div>
              ) : (
                <>
                  {/* Personal Contact Card */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 mb-8 p-5 bg-gradient-to-r from-electric/10 to-gold/5 rounded-xl border border-electric/20">
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 overflow-hidden flex items-center justify-center border-2 border-electric/30">
                        {/* Professional male avatar */}
                        <svg viewBox="0 0 80 80" className="w-20 h-20">
                          <rect width="80" height="80" fill="#1e293b"/>
                          <circle cx="40" cy="28" r="14" fill="#94a3b8"/>
                          <ellipse cx="40" cy="68" rx="22" ry="18" fill="#475569"/>
                          <circle cx="40" cy="28" r="12" fill="#cbd5e1"/>
                          <circle cx="40" cy="25" r="10" fill="#e2e8f0"/>
                          <path d="M28 22 Q40 14 52 22 Q52 18 40 16 Q28 18 28 22Z" fill="#334155"/>
                          <circle cx="36" cy="24" r="1.5" fill="#1e293b"/>
                          <circle cx="44" cy="24" r="1.5" fill="#1e293b"/>
                          <path d="M37 29 Q40 31 43 29" stroke="#64748b" strokeWidth="1" fill="none"/>
                          <rect x="32" y="40" width="16" height="20" rx="2" fill="#1e40af"/>
                          <path d="M38 40 L40 48 L42 40Z" fill="#f5f0e5"/>
                        </svg>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-profit rounded-full border-2 border-[#0a0b0d] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-bold text-cream">James Mitchell</h3>
                      <p className="text-sm text-electric font-medium">Senior Trading Strategist</p>
                      <p className="text-xs text-cream/50 mt-1">8+ years algorithmic trading • Former Goldman Sachs</p>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                        <a href="tel:+12127658431" className="inline-flex items-center gap-1.5 text-sm text-cream/70 hover:text-cream transition-colors">
                          <Phone className="w-3.5 h-3.5 text-profit" />
                          +1 (212) 765-8431
                        </a>
                        <a href="mailto:j.mitchell@novatrade.io" className="inline-flex items-center gap-1.5 text-sm text-cream/70 hover:text-cream transition-colors">
                          <Mail className="w-3.5 h-3.5 text-electric" />
                          j.mitchell@novatrade.io
                        </a>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-cream mb-2 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-electric" /> Get Started — Talk to James
                  </h2>
                  <p className="text-sm text-cream/50 mb-6">Tell us your goals. James will personally help configure the right bot parameters for you.</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-cream/50 mb-1.5">Full Name</label>
                        <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                          className="input-dark" placeholder="Your name" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-cream/50 mb-1.5">Email</label>
                        <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                          className="input-dark" placeholder="you@example.com" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-cream/50 mb-1.5">Trading Experience</label>
                        <select required value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} className="input-dark">
                          <option value="">Select...</option>
                          <option value="beginner">Beginner (&lt; 1 year)</option>
                          <option value="intermediate">Intermediate (1-3 years)</option>
                          <option value="advanced">Advanced (3+ years)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-cream/50 mb-1.5">Planned Capital</label>
                        <select required value={form.capitalRange} onChange={e => setForm({ ...form, capitalRange: e.target.value })} className="input-dark">
                          <option value="">Select...</option>
                          <option value="under500">Under $500</option>
                          <option value="500-2000">$500 – $2,000</option>
                          <option value="2000-10000">$2,000 – $10,000</option>
                          <option value="10000+">$10,000+</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-cream/50 mb-1.5">Your goals (optional)</label>
                      <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                        rows={4} className="input-dark resize-none" placeholder="Assets, risk tolerance, questions..." />
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" required className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5" />
                      <span className="text-xs text-cream/50">
                        I understand that trading bots use statistical strategies that are
                        <strong className="text-cream/70"> not guaranteed to profit on every trade</strong>.
                        I have read the disclaimer above.
                      </span>
                    </label>
                    <button type="submit" disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-electric text-void font-bold rounded-xl hover:bg-electric/90 disabled:opacity-50">
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Send Inquiry
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>

          <div className="mt-10 text-center">
            <p className="text-cream/40 text-sm mb-3">Also interested in the other bot?</p>
            <Link href={`/invest/bots/contact?bot=${botId === 'dca' ? 'grid' : 'dca'}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-cream/70 rounded-xl hover:bg-white/10 hover:text-cream">
              {botId === 'dca' ? <><Grid3X3 className="w-4 h-4" /> Learn about Grid Warrior</> : <><Clock className="w-4 h-4" /> Learn about DCA Master</>}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function BotContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-void flex items-center justify-center"><Loader2 className="w-6 h-6 text-electric animate-spin" /></div>}>
      <ContactPageInner />
    </Suspense>
  );
}
