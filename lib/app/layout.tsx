'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Shield, Zap, Award } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-void flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-void via-obsidian to-charcoal" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gold/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-electric/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-profit/10 rounded-full blur-[80px]" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-void" />
            </div>
            <span className="text-2xl font-display font-bold text-cream">
              NOVA<span className="text-gold">TRADE</span>
            </span>
          </Link>
          
          {/* Main Content */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl xl:text-5xl font-display font-bold text-cream leading-tight">
                Trade Smarter,<br />
                <span className="text-gradient">Not Harder</span>
              </h1>
              <p className="mt-4 text-lg text-slate-400 max-w-md">
                Join over 2.8 million traders worldwide. Access global markets with 
                institutional-grade tools and zero commission on crypto.
              </p>
            </motion.div>
            
            {/* Features */}
            <motion.div 
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {[
                { icon: Shield, label: 'Bank-Grade Security', sublabel: '$500M Insurance' },
                { icon: Zap, label: 'Lightning Fast', sublabel: '0.001s Execution' },
                { icon: Award, label: 'Award Winning', sublabel: '5 Industry Awards' },
                { icon: TrendingUp, label: '200+ Assets', sublabel: 'Global Markets' },
              ].map((feature, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/20 to-transparent flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{feature.label}</p>
                    <p className="text-xs text-slate-500">{feature.sublabel}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
          
          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center gap-6"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider">Trusted by</p>
            <div className="flex items-center gap-6 text-slate-600">
              {['Forbes', 'Bloomberg', 'Reuters', 'CNBC'].map((brand) => (
                <span key={brand} className="text-sm font-medium">{brand}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-6 left-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-void" />
            </div>
            <span className="text-xl font-display font-bold text-cream">
              NOVA<span className="text-gold">TRADE</span>
            </span>
          </Link>
        </div>
        
        {/* Form Container */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
