import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// TRADING TIERS SYSTEM
// ============================================
// Basic: FREE - View markets, demo trading, no live trading
// Tier 1: $500 - Start live trading
// Tier 2: $1,000 - Advanced features + copy trading  
// Tier 3: $3,000 - Professional tools + coaching
// Tier 4: $5,000 - VIP Elite access + everything
// ============================================

export type MembershipTier = 'basic' | 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface TierConfig {
  id: MembershipTier;
  name: string;
  price: number;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  features: string[];
  
  // Trading access
  tradingAccess: boolean;
  maxLeverage: number;
  maxPositions: number; // -1 = unlimited
  spreadDiscount: number; // percentage
  
  // Features
  signalsPerDay: number;
  copyTrading: boolean;
  tradingBots: boolean;
  aiAssistant: boolean;
  customIndicators: boolean;
  
  // Support
  supportLevel: 'community' | 'email' | 'priority' | 'personal' | 'dedicated';
  coachingSessions: number; // per month
  accountManager: boolean;
  
  // Withdrawals
  withdrawalSpeed: 'standard' | 'fast' | 'instant';
  
  // Bonuses
  welcomeBonus: number;
}

export const TIER_CONFIG: Record<MembershipTier, TierConfig> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 0,
    description: 'Learn the markets for free',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    icon: '👤',
    features: [
      'View all live markets',
      'Full Trading Academy access',
      'Demo trading (paper money)',
      'Community forum access',
      'Basic market analysis',
      'Educational videos',
    ],
    tradingAccess: false,
    maxLeverage: 0,
    maxPositions: 0,
    spreadDiscount: 0,
    signalsPerDay: 0,
    copyTrading: false,
    tradingBots: false,
    aiAssistant: false,
    customIndicators: false,
    supportLevel: 'community',
    coachingSessions: 0,
    accountManager: false,
    withdrawalSpeed: 'standard',
    welcomeBonus: 0,
  },
  
  tier1: {
    id: 'tier1',
    name: 'Starter',
    price: 500,
    description: 'Begin live trading',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    icon: '🚀',
    features: [
      'Everything in Basic',
      '✓ Live trading enabled',
      'Up to 1:50 leverage',
      '3 trading signals/day',
      'Email support',
      '10 open positions max',
      'Major forex & crypto',
      '$50 welcome bonus',
    ],
    tradingAccess: true,
    maxLeverage: 50,
    maxPositions: 10,
    spreadDiscount: 0,
    signalsPerDay: 3,
    copyTrading: false,
    tradingBots: false,
    aiAssistant: false,
    customIndicators: false,
    supportLevel: 'email',
    coachingSessions: 0,
    accountManager: false,
    withdrawalSpeed: 'standard',
    welcomeBonus: 50,
  },
  
  tier2: {
    id: 'tier2',
    name: 'Trader',
    price: 1000,
    description: 'Advanced trading tools',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    icon: '📈',
    features: [
      'Everything in Starter',
      'Up to 1:100 leverage',
      '10 pro signals/day',
      '✓ Copy trading access',
      'Priority chat support',
      '25 open positions max',
      'All trading pairs',
      '20% spread discount',
      '$100 welcome bonus',
    ],
    tradingAccess: true,
    maxLeverage: 100,
    maxPositions: 25,
    spreadDiscount: 20,
    signalsPerDay: 10,
    copyTrading: true,
    tradingBots: false,
    aiAssistant: false,
    customIndicators: false,
    supportLevel: 'priority',
    coachingSessions: 0,
    accountManager: false,
    withdrawalSpeed: 'fast',
    welcomeBonus: 100,
  },
  
  tier3: {
    id: 'tier3',
    name: 'Professional',
    price: 3000,
    description: 'Pro tools & personal coaching',
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    icon: '👑',
    features: [
      'Everything in Trader',
      'Up to 1:200 leverage',
      '25 VIP signals/day',
      '✓ Trading bots access',
      '✓ AI trading assistant',
      '✓ Personal account manager',
      '✓ 2x monthly coaching',
      '50 open positions max',
      '35% spread discount',
      'VIP webinars',
      '$300 welcome bonus',
    ],
    tradingAccess: true,
    maxLeverage: 200,
    maxPositions: 50,
    spreadDiscount: 35,
    signalsPerDay: 25,
    copyTrading: true,
    tradingBots: true,
    aiAssistant: true,
    customIndicators: true,
    supportLevel: 'personal',
    coachingSessions: 2,
    accountManager: true,
    withdrawalSpeed: 'fast',
    welcomeBonus: 300,
  },
  
  tier4: {
    id: 'tier4',
    name: 'Elite',
    price: 5000,
    description: 'Ultimate VIP experience',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    icon: '💎',
    features: [
      'Everything in Professional',
      'Up to 1:500 leverage',
      '✓ Unlimited VIP signals',
      '✓ Custom trading strategies',
      '✓ Dedicated account manager',
      '✓ 4x monthly coaching',
      'Unlimited positions',
      '50% spread discount',
      '✓ Private VIP channel',
      '✓ Instant withdrawals',
      'Portfolio reviews',
      'Direct analyst access',
      '$500 welcome bonus',
    ],
    tradingAccess: true,
    maxLeverage: 500,
    maxPositions: -1, // unlimited
    spreadDiscount: 50,
    signalsPerDay: 999, // unlimited
    copyTrading: true,
    tradingBots: true,
    aiAssistant: true,
    customIndicators: true,
    supportLevel: 'dedicated',
    coachingSessions: 4,
    accountManager: true,
    withdrawalSpeed: 'instant',
    welcomeBonus: 500,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get tier config by price paid
export function getTierByPrice(amount: number): MembershipTier {
  if (amount >= 5000) return 'tier4';
  if (amount >= 3000) return 'tier3';
  if (amount >= 1000) return 'tier2';
  if (amount >= 500) return 'tier1';
  return 'basic';
}

// Calculate upgrade cost
export function getUpgradeCost(currentTier: MembershipTier, targetTier: MembershipTier): number {
  const currentPrice = TIER_CONFIG[currentTier].price;
  const targetPrice = TIER_CONFIG[targetTier].price;
  return Math.max(0, targetPrice - currentPrice);
}

// Check if action is allowed for tier
export function canPerformAction(
  tier: MembershipTier,
  action: 'trade' | 'copyTrade' | 'useBots' | 'useAI' | 'customIndicators'
): boolean {
  const config = TIER_CONFIG[tier];
  switch (action) {
    case 'trade':
      return config.tradingAccess;
    case 'copyTrade':
      return config.copyTrading;
    case 'useBots':
      return config.tradingBots;
    case 'useAI':
      return config.aiAssistant;
    case 'customIndicators':
      return config.customIndicators;
    default:
      return false;
  }
}

// Get all tiers as array (sorted by price)
export function getAllTiers(): TierConfig[] {
  return Object.values(TIER_CONFIG).sort((a, b) => a.price - b.price);
}

// Get next tier
export function getNextTier(currentTier: MembershipTier): MembershipTier | null {
  const tiers: MembershipTier[] = ['basic', 'tier1', 'tier2', 'tier3', 'tier4'];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex >= tiers.length - 1) return null;
  return tiers[currentIndex + 1];
}

// ============================================
// MEMBERSHIP STORE
// ============================================

interface MembershipState {
  // Current tier
  currentTier: MembershipTier;
  tierPurchasedAt: number | null;
  
  // Coaching sessions tracking
  coachingSessionsUsed: number;
  coachingSessionsResetAt: number;
  
  // Total invested
  totalInvested: number;
  
  // Actions
  setTier: (tier: MembershipTier) => void;
  upgradeTier: (newTier: MembershipTier, amount: number) => void;
  useCoachingSession: () => boolean;
  resetMonthlySessions: () => void;
  
  // Getters
  getTierConfig: () => TierConfig;
  getAvailableCoachingSessions: () => number;
  canTrade: () => boolean;
}

export const useMembershipStore = create<MembershipState>()(
  persist(
    (set, get) => ({
      currentTier: 'basic',
      tierPurchasedAt: null,
      coachingSessionsUsed: 0,
      coachingSessionsResetAt: Date.now(),
      totalInvested: 0,
      
      setTier: (tier) => set({ 
        currentTier: tier,
        tierPurchasedAt: Date.now(),
      }),
      
      upgradeTier: (newTier, amount) => {
        set({
          currentTier: newTier,
          tierPurchasedAt: Date.now(),
          totalInvested: get().totalInvested + amount,
          coachingSessionsUsed: 0,
          coachingSessionsResetAt: Date.now(),
        });
      },
      
      useCoachingSession: () => {
        const state = get();
        const config = TIER_CONFIG[state.currentTier];
        const available = config.coachingSessions - state.coachingSessionsUsed;
        
        if (available <= 0) return false;
        
        set({ coachingSessionsUsed: state.coachingSessionsUsed + 1 });
        return true;
      },
      
      resetMonthlySessions: () => {
        set({
          coachingSessionsUsed: 0,
          coachingSessionsResetAt: Date.now(),
        });
      },
      
      getTierConfig: () => TIER_CONFIG[get().currentTier],
      
      getAvailableCoachingSessions: () => {
        const state = get();
        const config = TIER_CONFIG[state.currentTier];
        return Math.max(0, config.coachingSessions - state.coachingSessionsUsed);
      },
      
      canTrade: () => TIER_CONFIG[get().currentTier].tradingAccess,
    }),
    {
      name: 'membership-storage',
    }
  )
);

// ============================================
// TIER DISPLAY HELPERS
// ============================================

export function getTierBadgeColor(tier: MembershipTier): string {
  const colors: Record<MembershipTier, string> = {
    basic: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    tier1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    tier2: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    tier3: 'bg-gold/20 text-gold border-gold/30',
    tier4: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  return colors[tier];
}

export function getTierGradient(tier: MembershipTier): string {
  const gradients: Record<MembershipTier, string> = {
    basic: 'from-slate-400 to-slate-500',
    tier1: 'from-blue-400 to-blue-600',
    tier2: 'from-emerald-400 to-emerald-600',
    tier3: 'from-gold to-yellow-600',
    tier4: 'from-purple-400 to-pink-600',
  };
  return gradients[tier];
}
