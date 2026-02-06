'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  Shield,
  Zap,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BarChart3,
  Users,
  Bot,
  Check
} from 'lucide-react';

const steps = [
  {
    id: 1,
    title: 'Welcome to NOVATrADE',
    subtitle: 'Your gateway to professional trading',
    description: 'Experience AI-powered trading with institutional-grade tools, real-time analytics, and a community of successful traders.',
    icon: Sparkles,
    features: [
      { icon: TrendingUp, text: 'Trade Crypto, Forex & Stocks' },
      { icon: Bot, text: 'AI-Powered Trading Bots' },
      { icon: Users, text: 'Copy Successful Traders' },
    ]
  },
  {
    id: 2,
    title: 'Powerful Trading Tools',
    subtitle: 'Everything you need to succeed',
    description: 'Access advanced charting, real-time market data, and automated trading strategies designed by professionals.',
    icon: BarChart3,
    features: [
      { icon: BarChart3, text: 'Advanced Technical Analysis' },
      { icon: Zap, text: 'Lightning-Fast Execution' },
      { icon: Shield, text: 'Bank-Grade Security' },
    ]
  },
  {
    id: 3,
    title: 'Connect Your Wallet',
    subtitle: 'Secure & non-custodial',
    description: 'Link your Web3 wallet to unlock DeFi features, track your portfolio, and trade directly from your wallet.',
    icon: Wallet,
    features: [
      { icon: Wallet, text: 'MetaMask, WalletConnect & More' },
      { icon: Shield, text: 'You Control Your Keys' },
      { icon: Check, text: 'Optional - Skip if Preferred' },
    ]
  }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setIsExiting(true);
      setTimeout(() => {
        router.push('/connect-wallet');
      }, 300);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 300);
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isExiting ? 0 : 1, scale: isExiting ? 0.95 : 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                index <= currentStep ? 'bg-gold' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-obsidian/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6 sm:p-8"
            >
              {/* Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gold/20 to-electric/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <step.icon className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
              </div>

              {/* Content */}
              <div className="text-center mb-8">
                <p className="text-gold text-sm font-medium mb-2">{step.subtitle}</p>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-cream mb-3">
                  {step.title}
                </h1>
                <p className="text-cream/60 text-sm sm:text-base leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8">
                {step.features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
                  >
                    <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-gold" />
                    </div>
                    <span className="text-cream text-sm font-medium">{feature.text}</span>
                  </motion.div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 text-cream font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
                >
                  {isLastStep ? (
                    <>
                      <Wallet className="w-4 h-4" />
                      Connect Wallet
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Skip Option */}
              <button
                onClick={handleSkip}
                className="w-full mt-4 text-center text-sm text-cream/40 hover:text-cream/60 transition-colors"
              >
                {isLastStep ? 'Skip for now' : 'Skip onboarding'}
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step Counter */}
        <p className="text-center text-xs text-cream/40 mt-6">
          Step {currentStep + 1} of {steps.length}
        </p>
      </motion.div>
    </div>
  );
}
