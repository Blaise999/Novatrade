'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield,
  TrendingUp,
  Bot,
  Zap,
  Crown,
  Star,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Lock,
  Gift,
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface TierDef {
  level: number;
  code: string;
  name: string;
  price: number;
  bonus: number;
  icon: typeof Shield;
  color: string;
  bgColor: string;
  borderColor: string;
  gradient: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const TIERS: TierDef[] = [
  {
    level: 0,
    code: 'basic',
    name: 'Basic',
    price: 0,
    bonus: 0,
    icon: Star,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    gradient: 'from-slate-400 to-slate-500',
    description: 'View markets & paper trading',
    features: [
      'View all live markets',
      'Paper trading (demo)',
      'Trading Academy access',
      'Community forum',
    ],
  },
  {
    level: 1,
    code: 'starter',
    name: 'Starter',
    price: 500,
    bonus: 200,
    icon: TrendingUp,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    gradient: 'from-blue-400 to-blue-600',
    description: 'Trading + Shield protection',
    features: [
      'Live trading enabled',
      'Shield protection',
      'Up to 1:50 leverage',
      '3 trading signals/day',
      'Email support',
      '+$200 trading credit bonus',
    ],
  },
  {
    level: 2,
    code: 'trader',
    name: 'Trader',
    price: 1000,
    bonus: 400,
    icon: Bot,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    gradient: 'from-emerald-400 to-emerald-600',
    description: 'Trading + Shield + DCA Bots',
    features: [
      'Everything in Starter',
      'DCA Bot access',
      'Up to 1:100 leverage',
      '10 pro signals/day',
      'Priority support',
      '20% spread discount',
      '+$400 trading credit bonus',
    ],
    popular: true,
  },
  {
    level: 3,
    code: 'professional',
    name: 'Professional',
    price: 3000,
    bonus: 1200,
    icon: Crown,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    gradient: 'from-amber-400 to-yellow-600',
    description: 'Trading + Shield + GridWarrior',
    features: [
      'Everything in Trader',
      'GridWarrior Bots',
      'All trading bots',
      'AI trading assistant',
      'Personal account manager',
      'Up to 1:200 leverage',
      '+$1,200 trading credit bonus',
    ],
  },
  {
    level: 4,
    code: 'elite',
    name: 'Elite',
    price: 5000,
    bonus: 2000,
    icon: Sparkles,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    gradient: 'from-purple-400 to-pink-600',
    description: 'Ultimate VIP experience',
    features: [
      'Everything in Professional',
      'Unlimited leverage (1:500)',
      'Unlimited signals',
      'Dedicated account manager',
      'Instant withdrawals',
      'Private VIP channel',
      '+$2,000 trading credit bonus',
    ],
  },
];

export default function TierSelectionPage() {
  const router = useRouter();
  const { user } = useStore();
  const [currentTier, setCurrentTier] = useState(0);
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null);

  useEffect(() => {
    async function loadTier() {
      if (!user?.id || !isSupabaseConfigured()) return;

      // Get user's current tier from DB
      const { data } = await supabase
        .from('users')
        .select('tier_level, tier_active')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setCurrentTier(Number(data.tier_level ?? 0));
      }

      // Check for pending purchase
      const { data: pendingData } = await supabase
        .from('tier_purchases')
        .select('tier_code')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingData) {
        setPendingPurchase(pendingData.tier_code);
      }
    }

    loadTier();
  }, [user?.id]);

  function handleBuyTier(tier: TierDef) {
    router.push(`/dashboard/tier/checkout?tier=${tier.code}`);
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-bold text-cream mb-2">
          Choose Your Trading Tier
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Unlock powerful features and receive <span className="text-gold font-semibold">+40% bonus trading credit</span> with every tier purchase.
        </p>
      </div>

      {/* Bonus Banner */}
      <div className="mb-8 p-4 bg-gradient-to-r from-gold/10 to-amber-500/10 border border-gold/20 rounded-2xl flex items-center gap-3">
        <Gift className="w-6 h-6 text-gold flex-shrink-0" />
        <div>
          <p className="text-cream font-medium">40% Bonus Credit on Every Tier</p>
          <p className="text-sm text-slate-400">
            Buy any tier and receive 40% of the price as bonus trading credit. e.g. $1,000 tier → $400 bonus!
          </p>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {TIERS.filter(t => t.level > 0).map((tier, i) => {
          const isCurrentTier = currentTier >= tier.level;
          const isPending = pendingPurchase === tier.code;
          const isUpgrade = tier.level > currentTier;

          return (
            <motion.div
              key={tier.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-obsidian rounded-2xl border ${
                tier.popular
                  ? 'border-gold/40 shadow-lg shadow-gold/10'
                  : 'border-white/10'
              } p-6 flex flex-col`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-gold text-void text-xs font-bold rounded-full uppercase tracking-wide">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current tier badge */}
              {isCurrentTier && (
                <div className="absolute -top-3 right-4">
                  <span className="px-3 py-1 bg-profit/20 text-profit text-xs font-bold rounded-full">
                    ✓ Active
                  </span>
                </div>
              )}

              {/* Icon + Name */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl ${tier.bgColor} flex items-center justify-center`}>
                  <tier.icon className={`w-6 h-6 ${tier.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream">{tier.name}</h3>
                  <p className="text-xs text-slate-500">{tier.description}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-display font-bold text-cream">
                  ${tier.price.toLocaleString()}
                </span>
                <span className="text-sm text-slate-500 ml-1">one-time</span>
                <div className="mt-1">
                  <span className="text-sm text-gold font-medium">
                    +${tier.bonus.toLocaleString()} bonus credit
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              {isPending ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-amber-500/20 text-amber-400 font-semibold text-sm cursor-not-allowed"
                >
                  ⏳ Pending Approval
                </button>
              ) : isCurrentTier ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-profit/20 text-profit font-semibold text-sm cursor-not-allowed"
                >
                  ✓ Current Plan
                </button>
              ) : (
                <button
                  onClick={() => handleBuyTier(tier)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    tier.popular
                      ? 'bg-gradient-to-r from-gold to-gold/80 text-void hover:shadow-lg hover:shadow-gold/20'
                      : 'bg-white/10 text-cream hover:bg-white/20'
                  }`}
                >
                  {isUpgrade ? 'Upgrade' : 'Buy'} {tier.name}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Basic tier info */}
      <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/5 text-center">
        <p className="text-sm text-slate-400">
          <Lock className="w-4 h-4 inline mr-1" />
          Currently on <strong className="text-cream">Basic (Free)</strong> tier? You can view markets and paper trade. Upgrade to start live trading.
        </p>
      </div>
    </div>
  );
}
