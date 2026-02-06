'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  TrendingUp,
  Shield,
  Zap,
  ChevronRight,
  BarChart3,
  Users,
  Bot,
  ArrowUpRight,
  Globe,
  Lock,
  Cpu,
  Layers,
  ArrowRight,
  Star,
  Activity,
  Wallet,
  CircleDollarSign,
  Timer,
  Check,
} from 'lucide-react';

// Animated counter
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, hasAnimated]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// Live ticker bar
function TickerBar() {
  const assets = [
    { symbol: 'BTC/USD', price: '97,432.50', change: '+2.34%', up: true },
    { symbol: 'ETH/USD', price: '3,421.80', change: '+1.87%', up: true },
    { symbol: 'EUR/USD', price: '1.0847', change: '-0.12%', up: false },
    { symbol: 'GOLD', price: '2,891.40', change: '+0.56%', up: true },
    { symbol: 'SOL/USD', price: '198.72', change: '+5.21%', up: true },
    { symbol: 'GBP/USD', price: '1.2634', change: '+0.08%', up: true },
    { symbol: 'AAPL', price: '231.45', change: '-0.34%', up: false },
    { symbol: 'TSLA', price: '412.80', change: '+3.12%', up: true },
  ];

  return (
    <div className="w-full overflow-hidden bg-obsidian/80 border-b border-white/5 py-2.5">
      <div className="animate-ticker flex gap-12 whitespace-nowrap">
        {[...assets, ...assets].map((asset, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-cream/60 font-medium">{asset.symbol}</span>
            <span className="text-cream">{asset.price}</span>
            <span className={asset.up ? 'text-profit' : 'text-loss'}>{asset.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Grid background component
function GridBG() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(to right, #F8F6F0 1px, transparent 1px), linear-gradient(to bottom, #F8F6F0 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gold/[0.04] rounded-full blur-[160px]" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-electric/[0.03] rounded-full blur-[120px]" />
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: Bot,
      title: 'AI Trading Engine',
      desc: 'Proprietary algorithms analyze 50+ indicators in real-time, executing trades with sub-millisecond precision.',
      accent: 'from-electric to-cyan',
      accentBg: 'bg-electric/10',
      accentText: 'text-electric',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      desc: 'Professional-grade charting with 100+ technical indicators, pattern recognition, and predictive modeling.',
      accent: 'from-gold to-gold-light',
      accentBg: 'bg-gold/10',
      accentText: 'text-gold',
    },
    {
      icon: Shield,
      title: 'Institutional Security',
      desc: 'Bank-grade encryption, cold storage, multi-sig wallets, and SOC2-compliant infrastructure.',
      accent: 'from-profit to-profit-dark',
      accentBg: 'bg-profit/10',
      accentText: 'text-profit',
    },
    {
      icon: Zap,
      title: 'Lightning Execution',
      desc: 'Ultra-low latency order routing with direct market access. Average fill time under 50ms.',
      accent: 'from-loss to-loss-dark',
      accentBg: 'bg-loss/10',
      accentText: 'text-loss',
    },
    {
      icon: Users,
      title: 'Copy Trading',
      desc: 'Follow top-performing traders and automatically mirror their positions with customizable risk controls.',
      accent: 'from-cyan to-electric',
      accentBg: 'bg-cyan/10',
      accentText: 'text-cyan',
    },
    {
      icon: Globe,
      title: 'Global Markets',
      desc: 'Trade crypto, forex, equities, and commodities from a single unified platform. 24/7 access.',
      accent: 'from-gold-light to-gold',
      accentBg: 'bg-gold/10',
      accentText: 'text-gold-light',
    },
  ];

  const stats = [
    { value: 2400000, suffix: '+', label: 'Trading Volume (24h)', prefix: '$' },
    { value: 12800, suffix: '+', label: 'Active Traders', prefix: '' },
    { value: 99, suffix: '.97%', label: 'Uptime SLA', prefix: '' },
    { value: 50, suffix: 'ms', label: 'Avg. Execution', prefix: '<' },
  ];

  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      period: '',
      desc: 'Get started with essential tools',
      features: ['Spot trading', 'Basic charting', '2 AI signals/day', 'Email support'],
      cta: 'Start Free',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/mo',
      desc: 'For serious traders',
      features: ['Everything in Starter', 'Unlimited AI signals', 'Copy trading', 'Advanced analytics', 'Priority support', 'API access'],
      cta: 'Go Pro',
      highlight: true,
    },
    {
      name: 'Elite',
      price: '$199',
      period: '/mo',
      desc: 'Institutional-grade access',
      features: ['Everything in Pro', 'Custom bots', 'Dedicated account manager', 'White-glove onboarding', 'OTC desk access', 'Custom API limits'],
      cta: 'Contact Sales',
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen bg-void text-cream overflow-x-hidden">
      {/* Ticker */}
      <TickerBar />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-void/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-void" />
            </div>
            <span className="text-xl font-display font-bold tracking-tight">
              NOVA<span className="text-gold">TrADE</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-cream/50">
            <a href="#features" className="hover:text-cream transition-colors">Features</a>
            <a href="#stats" className="hover:text-cream transition-colors">Performance</a>
            <a href="#pricing" className="hover:text-cream transition-colors">Pricing</a>
            <a href="/markets" className="hover:text-cream transition-colors">Markets</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/auth')}
              className="hidden sm:block px-4 py-2 text-sm text-cream/70 hover:text-cream transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push('/auth')}
              className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center">
        <GridBG />
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-4xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 border border-gold/20 rounded-full mb-8"
            >
              <div className="w-2 h-2 bg-profit rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gold">Platform v3.0 — AI Engine Now Live</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold leading-[1.05] tracking-tight mb-6"
            >
              Trade Smarter.{' '}
              <span className="bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                Execute Faster.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg sm:text-xl text-cream/50 max-w-2xl mb-10 leading-relaxed"
            >
              AI-powered trading with institutional-grade tools. Access crypto, forex, and equities 
              with real-time signals, automated strategies, and a community of profitable traders.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button
                onClick={() => router.push('/auth')}
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-2xl hover:shadow-xl hover:shadow-gold/20 transition-all text-lg"
              >
                Start Trading
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-cream font-semibold rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all text-lg"
              >
                View Demo
                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-6 mt-12"
            >
              <div className="flex -space-x-2">
                {[...'ABCDE'].map((letter, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-void flex items-center justify-center text-xs font-bold"
                    style={{
                      background: ['#D4AF37', '#6366F1', '#00D9A5', '#22D3EE', '#FF4757'][i],
                      color: '#050508',
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                  ))}
                </div>
                <p className="text-xs text-cream/40 mt-0.5">Trusted by 12,800+ traders worldwide</p>
              </div>
            </motion.div>
          </div>

          {/* Floating card - right side */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="hidden xl:block absolute right-6 top-1/2 -translate-y-1/2 w-80"
          >
            <div className="bg-obsidian/60 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-cream/60">Live Signal</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-profit rounded-full animate-pulse" />
                  <span className="text-xs text-profit font-medium">Active</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { pair: 'BTC/USD', dir: 'LONG', conf: '94%', color: 'text-profit' },
                  { pair: 'EUR/USD', dir: 'SHORT', conf: '87%', color: 'text-loss' },
                  { pair: 'SOL/USD', dir: 'LONG', conf: '91%', color: 'text-profit' },
                ].map((sig, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.15 }}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-cream">{sig.pair}</p>
                      <p className={`text-xs font-mono font-bold ${sig.color}`}>{sig.dir}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-cream/80">{sig.conf}</p>
                      <p className="text-[10px] text-cream/40">confidence</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-cream/30 font-mono">Updated 3s ago</span>
                <Activity className="w-3.5 h-3.5 text-profit animate-pulse" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative border-y border-white/5 bg-obsidian/30">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-display font-bold text-cream">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </p>
                <p className="text-sm text-cream/40 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 md:py-32">
        <GridBG />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm font-medium text-gold mb-3"
            >
              PLATFORM CAPABILITIES
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold"
            >
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
                Win
              </span>
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
                className="group relative p-6 bg-obsidian/50 border border-white/5 rounded-2xl hover:border-white/10 transition-all duration-500 hover:bg-obsidian/80"
              >
                <div className={`w-12 h-12 ${feature.accentBg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.accentText}`} />
                </div>
                <h3 className="text-lg font-display font-bold text-cream mb-2">{feature.title}</h3>
                <p className="text-sm text-cream/40 leading-relaxed">{feature.desc}</p>
                <div className={`absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r ${feature.accent} opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative py-24 border-y border-white/5 bg-obsidian/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-electric mb-3">GET STARTED IN MINUTES</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold">
              Three Steps to Your First Trade
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              { step: '01', icon: Wallet, title: 'Create Account', desc: 'Sign up in 30 seconds. Connect your wallet or fund with fiat. Full KYC takes under 2 minutes.' },
              { step: '02', icon: Cpu, title: 'Activate AI', desc: 'Enable AI signals, set your risk tolerance, and choose your preferred assets. The engine starts working immediately.' },
              { step: '03', icon: CircleDollarSign, title: 'Start Earning', desc: 'Execute AI-recommended trades, follow top traders, or deploy automated strategies. Track everything in real-time.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center"
              >
                <div className="text-6xl font-display font-bold text-white/[0.03] mb-4">{item.step}</div>
                <div className="w-16 h-16 bg-electric/10 rounded-2xl flex items-center justify-center mx-auto mb-5 -mt-10">
                  <item.icon className="w-8 h-8 text-electric" />
                </div>
                <h3 className="text-xl font-display font-bold text-cream mb-3">{item.title}</h3>
                <p className="text-sm text-cream/40 leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 w-12 border-t border-dashed border-white/10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-24 md:py-32">
        <GridBG />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-gold mb-3">PRICING</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold">
              Plans Built for{' '}
              <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
                Every Trader
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-7 rounded-2xl border transition-all ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-gold/10 to-obsidian border-gold/30 shadow-xl shadow-gold/5'
                    : 'bg-obsidian/50 border-white/5 hover:border-white/10'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold text-void text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-lg font-display font-bold text-cream">{plan.name}</h3>
                <p className="text-sm text-cream/40 mt-1">{plan.desc}</p>
                <div className="mt-6 mb-6">
                  <span className="text-4xl font-display font-bold text-cream">{plan.price}</span>
                  {plan.period && <span className="text-cream/40 text-sm">{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2.5 text-sm text-cream/60">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-gold' : 'text-profit/60'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push('/auth')}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-gold to-gold/80 text-void hover:shadow-lg hover:shadow-gold/20'
                      : 'bg-white/5 border border-white/10 text-cream hover:bg-white/10'
                  }`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 border-t border-white/5">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/[0.06] rounded-full blur-[150px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-6">
              Ready to Trade with{' '}
              <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
                an Edge?
              </span>
            </h2>
            <p className="text-cream/40 text-lg mb-10 max-w-xl mx-auto">
              Join thousands of traders already using NOVATrADE's AI-powered platform. 
              Start for free — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/auth')}
                className="group flex items-center justify-center gap-2 px-10 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-2xl hover:shadow-xl hover:shadow-gold/20 transition-all text-lg"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-obsidian/30">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-void" />
                </div>
                <span className="text-lg font-display font-bold">
                  NOVA<span className="text-gold">TrADE</span>
                </span>
              </div>
              <p className="text-xs text-cream/30 leading-relaxed">
                AI-powered trading platform for the next generation of traders.
              </p>
            </div>
            {[
              { title: 'Platform', links: ['Markets', 'Pricing', 'Academy', 'API Docs'] },
              { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
              { title: 'Legal', links: ['Terms', 'Privacy', 'Cookies', 'Licenses'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold text-cream mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, li) => (
                    <li key={li}>
                      <a href="#" className="text-xs text-cream/30 hover:text-cream/60 transition-colors">{link}</a>
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
    </div>
  );
}
