'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Shield, Zap, Award, BarChart3 } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508] flex">
      {/* Left Side - Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a12] via-[#080810] to-[#050508]" />
        
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gold/15 rounded-full blur-[150px]"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px]"
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-3/4 left-1/2 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px]"
          animate={{
            x: ['-50%', '-40%', '-50%'],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-gradient-to-br from-gold to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold/20 group-hover:shadow-gold/40 transition-shadow">
              <TrendingUp className="w-6 h-6 text-black" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              NOVA<span className="text-gold">TRADE</span>
            </span>
          </Link>

          {/* Main content */}
          <div className="space-y-10 max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] tracking-tight">
                Trade Smarter,
                <br />
                <span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent">
                  Not Harder
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed">
                Join over 2.8 million traders worldwide. Access global markets with 
                institutional-grade tools and zero commission on crypto.
              </p>
            </motion.div>

            {/* Feature cards */}
            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {[
                { 
                  icon: Shield, 
                  title: 'Bank-Grade Security', 
                  subtitle: '$500M Insurance',
                  gradient: 'from-gold/20 to-gold/5'
                },
                { 
                  icon: Zap, 
                  title: 'Lightning Fast', 
                  subtitle: '0.001s Execution',
                  gradient: 'from-emerald-500/20 to-emerald-500/5'
                },
                { 
                  icon: Award, 
                  title: 'Award Winning', 
                  subtitle: '5 Industry Awards',
                  gradient: 'from-blue-500/20 to-blue-500/5'
                },
                { 
                  icon: BarChart3, 
                  title: '200+ Assets', 
                  subtitle: 'Global Markets',
                  gradient: 'from-purple-500/20 to-purple-500/5'
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="group"
                >
                  <div className={`
                    flex items-center gap-3 p-4 rounded-xl 
                    bg-gradient-to-br ${feature.gradient}
                    border border-white/[0.05]
                    hover:border-white/[0.1] transition-all
                    backdrop-blur-sm
                  `}>
                    <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{feature.title}</p>
                      <p className="text-xs text-slate-500">{feature.subtitle}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-8"
          >
            <p className="text-xs text-slate-600 uppercase tracking-wider font-medium">Trusted by</p>
            <div className="flex items-center gap-8">
              {['Forbes', 'Bloomberg', 'Reuters', 'CNBC'].map((brand) => (
                <span 
                  key={brand} 
                  className="text-sm font-medium text-slate-600 hover:text-slate-400 transition-colors cursor-default"
                >
                  {brand}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile background */}
        <div className="lg:hidden absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.1),rgba(0,0,0,0))]" />
        </div>

        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-6 left-6 z-20">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-gold to-amber-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold text-white">
              NOVA<span className="text-gold">TRADE</span>
            </span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
