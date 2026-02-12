// components/TierGate.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Lock, ArrowRight } from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';

export type FeatureKey =
  | 'trading'
  | 'shield'
  | 'dca_bots'
  | 'grid_bots'
  | 'trading_bots'
  | 'ai_assistant'
  | 'elite';

const FEATURE_TIER_REQUIREMENTS: Record<FeatureKey, { minTier: number; tierName: string; description: string }> = {
  trading: { minTier: 1, tierName: 'Starter', description: 'Active tier required to place trades' },
  shield: { minTier: 1, tierName: 'Starter', description: 'Shield Protection to lock portfolio value' },
  dca_bots: { minTier: 2, tierName: 'Trader', description: 'Dollar-Cost Averaging automated bots' },
  grid_bots: { minTier: 3, tierName: 'Pro', description: 'Grid trading automated strategies' },
  trading_bots: { minTier: 2, tierName: 'Trader', description: 'Automated trading bots' },
  ai_assistant: { minTier: 3, tierName: 'Pro', description: 'AI-powered trading assistant' },
  elite: { minTier: 4, tierName: 'Elite', description: 'Elite-tier exclusive features' },
};

interface TierGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  title?: string;
  message?: string;
  inline?: boolean;
}

export default function TierGate({ feature, children, title, message, inline = false }: TierGateProps) {
  const { user } = useStore();
  const [tierLevel, setTierLevel] = useState<number | null>(null);
  const [tierActive, setTierActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const requirement = FEATURE_TIER_REQUIREMENTS[feature];

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    const check = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import('@/lib/supabase/client');
        if (!isSupabaseConfigured()) {
          setTierLevel(99); setTierActive(true); setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('users')
          .select('tier_level, tier_active')
          .eq('id', user.id)
          .maybeSingle();
        setTierLevel(Number(data?.tier_level ?? 0));
        setTierActive(Boolean(data?.tier_active));
      } catch {
        setTierLevel(0); setTierActive(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [user?.id]);

  if (loading) return null;

  const hasAccess = tierActive && (tierLevel ?? 0) >= requirement.minTier;

  if (hasAccess) return <>{children}</>;

  if (inline) {
    return (
      <div className="p-4 bg-gold/5 border border-gold/20 rounded-2xl flex items-start gap-4">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gold">
            {title || `${requirement.tierName} Tier Required`}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {message || requirement.description}. Upgrade to {requirement.tierName} tier or higher to unlock.
          </p>
        </div>
        <Link
          href="/dashboard/tier"
          className="px-4 py-2 bg-gold/10 text-gold text-sm font-medium rounded-lg hover:bg-gold/20 transition-colors whitespace-nowrap flex items-center gap-1"
        >
          Upgrade <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  // Full-page lock screen
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-gold/10 rounded-2xl flex items-center justify-center mb-6">
        <Shield className="w-10 h-10 text-gold" />
      </div>
      <h2 className="text-2xl font-display font-bold text-cream mb-2">
        {title || `${requirement.tierName} Tier Required`}
      </h2>
      <p className="text-slate-400 max-w-md mb-6">
        {message || `This feature requires an active ${requirement.tierName} tier or higher. Upgrade your plan to get access.`}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard/tier"
          className="px-6 py-3 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          View Tiers & Plans
        </Link>
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-white/5 text-cream font-medium rounded-xl hover:bg-white/10 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
