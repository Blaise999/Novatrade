'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowDownLeft,
  Copy,
  CheckCircle,
  CreditCard,
  Bitcoin,
  Building2,
  QrCode,
  Clock,
  Shield,
  ChevronRight,
  X,
  AlertCircle,
  TrendingUp,
  Bot,
  Coins,
  Gift,
  Upload,
  MessageCircle,
  Mail,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useWalletStore } from '@/lib/store';
import { useMembershipStore, TIER_CONFIG, MembershipTier } from '@/lib/membership-tiers';
import { useDepositSettingsStore, CryptoWallet, BankAccount, PaymentProcessor } from '@/lib/deposit-settings';
import KYCGate from '@/components/KYCGate';

// Investment plan info
const investmentPlans: Record<string, { name: string; roi: string; min: number }> = {
  starter: { name: 'Starter Plan', roi: '5%', min: 100 },
  growth: { name: 'Growth Plan', roi: '12%', min: 1000 },
  premium: { name: 'Premium Plan', roi: '20%', min: 10000 },
  elite: { name: 'Elite Plan', roi: '35%', min: 50000 }
};

// Bot info
const botInfo: Record<string, { name: string; min: number }> = {
  'grid-bot': { name: 'Grid Trading Bot', min: 100 },
  'dca-bot': { name: 'DCA Bot', min: 50 },
  'arbitrage-bot': { name: 'Arbitrage Bot', min: 500 },
  'momentum-bot': { name: 'Momentum Bot', min: 250 },
  'ai-bot': { name: 'AI Trading Bot', min: 1000 }
};

type DepositStep = 'method' | 'details' | 'confirm' | 'submitted';
type PaymentMethod = 'crypto' | 'bank' | 'processor';

// For safely reading label fields from TierConfig without TS errors
type TierLabelConfig = { displayName?: string; name?: string; label?: string; title?: string };

function WalletContent() {
  const router = useRouter();
  const { user } = useStore();
  const { address: walletAddress, isConnected } = useWalletStore();
  const { currentTier } = useMembershipStore();
  const searchParams = useSearchParams();

  // Deposit settings from admin store
  const {
    cryptoWallets,
    bankAccounts,
    paymentProcessors,
    depositInstructions,
    supportEmail,
    supportWhatsApp,
    requireProof,
    globalMinDeposit,
    getEnabledCryptoWallets,
    getEnabledBankAccounts,
    getEnabledPaymentProcessors,
    submitDeposit,
    getUserDeposits
  } = useDepositSettingsStore();

  // Get query parameters for context
  const planId = searchParams.get('plan');
  const stakeToken = searchParams.get('stake');
  const botId = searchParams.get('bot');
  const tierId = searchParams.get('tier') as MembershipTier | null;
  const tierAmount = searchParams.get('amount');

  // State
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [depositStep, setDepositStep] = useState<DepositStep>('method');
  const [selectedMethodType, setSelectedMethodType] = useState<PaymentMethod | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoWallet | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [selectedProcessor, setSelectedProcessor] = useState<PaymentProcessor | null>(null);
  const [amount, setAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [userTierActive, setUserTierActive] = useState<boolean | null>(null); // null = loading

  // Check if user has active tier
  useEffect(() => {
    if (!user?.id) return;
    const checkTier = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import('@/lib/supabase/client');
        if (!isSupabaseConfigured()) { setUserTierActive(true); return; }
        const { data } = await supabase
          .from('users')
          .select('tier_level, tier_active')
          .eq('id', user.id)
          .maybeSingle();
        setUserTierActive(Boolean(data?.tier_active) && Number(data?.tier_level ?? 0) >= 1);
      } catch { setUserTierActive(true); }
    };
    checkTier();
  }, [user?.id]);

  // Get enabled payment methods
  const enabledCrypto = getEnabledCryptoWallets();
  const enabledBanks = getEnabledBankAccounts();
  const enabledProcessors = getEnabledPaymentProcessors();

  // User's deposit history — fetch from Supabase so admin approval status syncs
  const [dbDeposits, setDbDeposits] = useState<any[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);

  const loadDepositsFromDB = async () => {
    if (!user?.id) return;
    setDepositsLoading(true);
    try {
      const { supabase: sb, isSupabaseConfigured: isc } = await import('@/lib/supabase/client');
      if (!isc()) { setDepositsLoading(false); return; }
      const { data } = await sb
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setDbDeposits(data || []);
    } catch { /* fallback: keep empty */ }
    setDepositsLoading(false);
  };

  useEffect(() => {
    if (user?.id) loadDepositsFromDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Merge: prefer DB deposits, fallback to local store
  const localDeposits = user ? getUserDeposits(user.id) : [];
  const userDeposits = dbDeposits.length > 0
    ? dbDeposits.map((d: any) => ({
        id: d.id,
        amount: Number(d.amount ?? 0),
        methodName: d.method_name || d.method || d.network || 'Crypto',
        status: d.status || 'pending',
        createdAt: d.created_at,
        rejectionReason: d.rejection_reason || null,
        adminNote: d.admin_note || null,
        txHash: d.tx_hash || d.transaction_ref || null,
      }))
    : localDeposits;

  // Get context info
  const selectedPlan = planId ? investmentPlans[planId] : null;
  const selectedBot = botId ? botInfo[botId] : null;
  const selectedTier = tierId ? TIER_CONFIG[tierId] : null;

  const hasContext = selectedPlan || stakeToken || selectedBot || selectedTier;

  // ✅ FIX: TierConfig might not have displayName — compute a safe label
  const selectedTierLabel = (() => {
    if (!tierId || !selectedTier) return null;
    const cfg = selectedTier as unknown as TierLabelConfig;
    return (
      cfg.displayName ??
      cfg.name ??
      cfg.label ??
      cfg.title ??
      // fallback: turn "gold" -> "Gold"
      tierId.charAt(0).toUpperCase() + tierId.slice(1)
    );
  })();

  // Set minimum amount based on context
  useEffect(() => {
    if (selectedTier && tierAmount) {
      setAmount(tierAmount);
    } else if (selectedPlan) {
      setAmount(selectedPlan.min.toString());
    } else if (selectedBot) {
      setAmount(selectedBot.min.toString());
    }
  }, [selectedPlan, selectedBot, selectedTier, tierAmount]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProofImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDeposit = async () => {
    if (!user) return;

    setIsSubmitting(true);

    let methodId = '';
    let methodName = '';

    if (selectedMethodType === 'crypto' && selectedCrypto) {
      methodId = selectedCrypto.id;
      methodName = `${selectedCrypto.name} (${selectedCrypto.network})`;
    } else if (selectedMethodType === 'bank' && selectedBank) {
      methodId = selectedBank.id;
      methodName = selectedBank.bankName;
    } else if (selectedMethodType === 'processor' && selectedProcessor) {
      methodId = selectedProcessor.id;
      methodName = selectedProcessor.name;
    }

    // Save to local store (legacy)
    submitDeposit({
      amount: parseFloat(amount),
      method: selectedMethodType!,
      methodId,
      methodName,
      transactionRef,
      proofImage: proofImage || undefined,
      userId: user.id,
      userEmail: user.email,
    });

    // Save to Supabase deposits table for admin approval
    try {
      const { supabase, isSupabaseConfigured } = await import('@/lib/supabase/client');
      if (isSupabaseConfigured()) {
        await supabase.from('deposits').insert({
          user_id: user.id,
          amount: parseFloat(amount),
          currency: 'USD',
          method: selectedMethodType || 'crypto',
          method_name: methodName || 'Crypto',
          network: selectedMethodType === 'crypto' ? (selectedCrypto?.network || '') : null,
          transaction_ref: transactionRef || null,
          tx_hash: transactionRef || null,
          proof_url: proofImage || null,
          status: 'pending',
        });
      }
    } catch (e) {
      console.error('Failed to save deposit to DB:', e);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setDepositStep('submitted');
    setShowSuccess(true);
    // Reload deposits from DB so history tab updates
    await loadDepositsFromDB();
  };

  const resetDeposit = () => {
    setDepositStep('method');
    setSelectedMethodType(null);
    setSelectedCrypto(null);
    setSelectedBank(null);
    setSelectedProcessor(null);
    setAmount('');
    setTransactionRef('');
    setProofImage(null);
    setShowSuccess(false);
  };

  const quickAmounts = [100, 250, 500, 1000, 2500, 5000];

  const getMinDeposit = () => {
    if (selectedMethodType === 'crypto' && selectedCrypto) return selectedCrypto.minDeposit;
    if (selectedMethodType === 'bank' && selectedBank) return selectedBank.minDeposit;
    if (selectedMethodType === 'processor' && selectedProcessor) return selectedProcessor.minDeposit;
    return globalMinDeposit;
  };

  return (
    <KYCGate action="deposit funds">
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-cream">Wallet</h1>
        <p className="text-slate-400 mt-1">Manage your funds and transactions</p>
      </div>

      {/* Tier Activation Banner */}
      {userTierActive === false && (
        <div className="mb-6 p-4 bg-gold/5 border border-gold/20 rounded-2xl flex items-start gap-4">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gold">Activate a Tier to Start Trading</h3>
            <p className="text-xs text-slate-400 mt-1">
              You need an active tier plan to trade and access platform features. 
              Deposit funds and purchase a tier to get started.
            </p>
          </div>
          <Link 
            href="/dashboard/tier" 
            className="px-4 py-2 bg-gold/10 text-gold text-sm font-medium rounded-lg hover:bg-gold/20 transition-colors whitespace-nowrap"
          >
            View Tiers
          </Link>
        </div>
      )}

      {/* Context Banner */}
      <AnimatePresence>
        {hasContext && !dismissedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-gradient-to-r from-gold/20 to-profit/20 rounded-2xl border border-gold/30"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  {selectedPlan && <TrendingUp className="w-6 h-6 text-gold" />}
                  {stakeToken && <Coins className="w-6 h-6 text-gold" />}
                  {selectedBot && <Bot className="w-6 h-6 text-gold" />}
                  {selectedTier && <Gift className="w-6 h-6 text-gold" />}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-cream">
                    {selectedPlan && `You selected: ${selectedPlan.name}`}
                    {stakeToken && `You want to stake: ${stakeToken}`}
                    {selectedBot && `You selected: ${selectedBot.name}`}
                    {selectedTier && `Upgrade to: ${selectedTierLabel ?? 'Tier'} Tier`}
                  </h3>

                  <p className="text-sm text-cream/70 mt-1">
                    {selectedPlan && `Minimum: $${selectedPlan.min} • Expected ROI: ${selectedPlan.roi}`}
                    {stakeToken && `Deposit funds to start staking ${stakeToken}`}
                    {selectedBot && `Minimum allocation: $${selectedBot.min}`}
                    {selectedTier && `Deposit $${tierAmount ?? ''} to unlock ${selectedTierLabel ?? 'tier'} benefits`}
                  </p>
                </div>
              </div>

              <button onClick={() => setDismissedBanner(true)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-cream/50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balance Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-gold/20 to-gold/5 rounded-2xl border border-gold/20 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-gold" />
            </div>
            <span className="text-sm text-cream/60">Available Balance</span>
          </div>
          <p className="text-2xl font-bold text-cream">${(user?.balance || 0).toLocaleString()}</p>
          {(user?.balance || 0) === 0 && <p className="text-xs text-gold mt-2">Deposit to start trading</p>}
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-profit/10 rounded-xl flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-profit" />
            </div>
            <span className="text-sm text-cream/60">Total Deposited</span>
          </div>
          <p className="text-2xl font-bold text-cream">${(user?.totalDeposited || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-electric" />
            </div>
            <span className="text-sm text-cream/60">Account Tier</span>
          </div>
          <p className="text-2xl font-bold text-cream capitalize">{currentTier}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['deposit', 'withdraw', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'deposit') resetDeposit();
              if (tab === 'history') loadDepositsFromDB();
            }}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all capitalize whitespace-nowrap ${
              activeTab === tab
                ? 'bg-gold text-void'
                : 'bg-white/5 text-cream/60 hover:text-cream hover:bg-white/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Deposit/Withdraw Form */}
        <div className="lg:col-span-2">
          {/* Deposit Tab */}
          {activeTab === 'deposit' && (
            <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
              {/* Step Indicator */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {(['method', 'details', 'confirm'] as const).map((step, idx) => (
                    <div key={step} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          depositStep === step || (depositStep === 'submitted' && idx < 3)
                            ? 'bg-gold text-void'
                            : ['method', 'details', 'confirm'].indexOf(depositStep as any) > idx
                            ? 'bg-profit text-void'
                            : 'bg-white/10 text-cream/50'
                        }`}
                      >
                        {['method', 'details', 'confirm'].indexOf(depositStep as any) > idx ||
                        depositStep === 'submitted' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      {idx < 2 && (
                        <div
                          className={`w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 ${
                            ['method', 'details', 'confirm'].indexOf(depositStep as any) > idx
                              ? 'bg-profit'
                              : 'bg-white/10'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {depositStep !== 'method' && depositStep !== 'submitted' && (
                  <button
                    onClick={() => {
                      if (depositStep === 'details') setDepositStep('method');
                      if (depositStep === 'confirm') setDepositStep('details');
                    }}
                    className="text-sm text-gold hover:text-gold/80"
                  >
                    ← Back
                  </button>
                )}
              </div>

              {/* Step 1: Select Payment Method */}
              {depositStep === 'method' && (
                <div>
                  <h2 className="text-lg font-semibold text-cream mb-4">Select Payment Method</h2>

                  {/* ★ Direct Deposit — wallet to wallet, no middleman */}
                  {enabledCrypto.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm text-cream/60 mb-3 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-gold" /> <span className="text-gold font-semibold">Direct Deposit</span>
                      </h3>
                      <p className="text-xs text-cream/50 mb-3">
                        Send USDT directly from your wallet — no banks, no processors, instant.
                      </p>
                      <div className="grid sm:grid-cols-1 gap-3">
                        {enabledCrypto
                          .filter((c) => c.name.toUpperCase().includes('USDT') || c.symbol?.toUpperCase?.() === 'USDT' || c.name.toUpperCase().includes('TETHER'))
                          .slice(0, 1)
                          .map((crypto) => (
                            <button
                              key={`direct-${crypto.id}`}
                              onClick={() => {
                                setSelectedMethodType('crypto');
                                setSelectedCrypto(crypto);
                                setDepositStep('details');
                              }}
                              className="flex items-center gap-4 p-5 bg-gradient-to-r from-gold/10 to-profit/10 hover:from-gold/20 hover:to-profit/20 rounded-xl border border-gold/30 hover:border-gold/50 transition-all text-left"
                            >
                              <div className="w-12 h-12 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-xl flex items-center justify-center text-xl">
                                💰
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-cream">Direct USDT Deposit</p>
                                <p className="text-xs text-cream/60 mt-0.5">
                                  Send from your wallet → Our wallet • {crypto.network}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 px-3 py-1.5 bg-gold/20 text-gold text-xs font-semibold rounded-lg">
                                <Zap className="w-3 h-3" /> Fastest
                              </div>
                            </button>
                          ))}

                        {/* Fallback if no USDT found — show first crypto as direct deposit */}
                        {enabledCrypto.filter((c) => c.name.toUpperCase().includes('USDT') || c.symbol?.toUpperCase?.() === 'USDT' || c.name.toUpperCase().includes('TETHER')).length === 0 &&
                          enabledCrypto.slice(0, 1).map((crypto) => (
                            <button
                              key={`direct-${crypto.id}`}
                              onClick={() => {
                                setSelectedMethodType('crypto');
                                setSelectedCrypto(crypto);
                                setDepositStep('details');
                              }}
                              className="flex items-center gap-4 p-5 bg-gradient-to-r from-gold/10 to-profit/10 hover:from-gold/20 hover:to-profit/20 rounded-xl border border-gold/30 hover:border-gold/50 transition-all text-left"
                            >
                              <div className="w-12 h-12 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-xl flex items-center justify-center text-xl">
                                💰
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-cream">Direct Crypto Deposit</p>
                                <p className="text-xs text-cream/60 mt-0.5">
                                  Send from your wallet → Our wallet • {crypto.network}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 px-3 py-1.5 bg-gold/20 text-gold text-xs font-semibold rounded-lg">
                                <Zap className="w-3 h-3" /> Fastest
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Crypto Options */}
                  {enabledCrypto.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm text-cream/60 mb-3 flex items-center gap-2">
                        <Bitcoin className="w-4 h-4" /> Cryptocurrency
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {enabledCrypto.map((crypto) => (
                          <button
                            key={crypto.id}
                            onClick={() => {
                              setSelectedMethodType('crypto');
                              setSelectedCrypto(crypto);
                              setDepositStep('details');
                            }}
                            className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-gold/30 transition-all text-left"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-lg flex items-center justify-center text-lg">
                              {crypto.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-cream truncate">{crypto.name}</p>
                              <p className="text-xs text-cream/50">{crypto.network}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-cream/30 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bank Transfer Options */}
                  {enabledBanks.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm text-cream/60 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Bank Transfer
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {enabledBanks.map((bank) => (
                          <button
                            key={bank.id}
                            onClick={() => {
                              setSelectedMethodType('bank');
                              setSelectedBank(bank);
                              setDepositStep('details');
                            }}
                            className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-gold/30 transition-all text-left"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-cream truncate">{bank.bankName}</p>
                              <p className="text-xs text-cream/50">
                                {bank.currency} • {bank.country}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-cream/30 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Processors */}
                  {enabledProcessors.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm text-cream/60 mb-3 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Other Methods
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {enabledProcessors.map((processor) => (
                          <button
                            key={processor.id}
                            onClick={() => {
                              setSelectedMethodType('processor');
                              setSelectedProcessor(processor);
                              setDepositStep('details');
                            }}
                            className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-gold/30 transition-all text-left"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center text-lg">
                              {processor.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-cream truncate">{processor.name}</p>
                              <p className="text-xs text-cream/50">Fee: {processor.fee}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-cream/30 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No methods enabled */}
                  {enabledCrypto.length === 0 &&
                    enabledBanks.length === 0 &&
                    enabledProcessors.length === 0 && (
                      <div className="text-center py-12">
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-cream mb-2">
                          No Payment Methods Available
                        </h3>
                        <p className="text-cream/60 mb-4">
                          Please contact support to make a deposit.
                        </p>
                        {supportEmail && (
                          <a
                            href={`mailto:${supportEmail}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-void font-medium rounded-xl hover:bg-gold/90 transition-colors"
                          >
                            <Mail className="w-4 h-4" /> Contact Support
                          </a>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* Step 2: Payment Details */}
              {depositStep === 'details' && (
                <div>
                  <h2 className="text-lg font-semibold text-cream mb-4">Payment Details</h2>

                  {/* Crypto Details */}
                  {selectedMethodType === 'crypto' && selectedCrypto && (
                    <div className="p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 rounded-xl border border-orange-500/20 mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">
                          {selectedCrypto.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-cream">{selectedCrypto.name}</p>
                          <p className="text-sm text-cream/60">{selectedCrypto.network} Network</p>
                        </div>
                      </div>

                      <div className="flex justify-center mb-4">
                        <div className="w-40 h-40 sm:w-48 sm:h-48 bg-white rounded-xl p-2 flex items-center justify-center">
                          <QrCode className="w-full h-full text-void" />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="text-xs text-cream/50 mb-1 block">Deposit Address</label>
                        <div className="flex items-center gap-2 p-3 bg-void/50 rounded-lg">
                          <code className="flex-1 text-xs sm:text-sm text-gold font-mono break-all">
                            {selectedCrypto.address}
                          </code>
                          <button
                            onClick={() => handleCopy(selectedCrypto.address)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4 text-profit" />
                            ) : (
                              <Copy className="w-4 h-4 text-cream/60" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg text-sm">
                        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        <span className="text-yellow-500 text-xs sm:text-sm">
                          Only send {selectedCrypto.symbol} on {selectedCrypto.network}. Min: $
                          {selectedCrypto.minDeposit}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bank Details */}
                  {selectedMethodType === 'bank' && selectedBank && (
                    <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-cream">{selectedBank.bankName}</p>
                          <p className="text-sm text-cream/60">{selectedBank.country}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                          <span className="text-cream/60 text-sm">Account Name</span>
                          <span className="text-cream font-medium text-sm">
                            {selectedBank.accountName}
                          </span>
                        </div>

                        <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                          <span className="text-cream/60 text-sm">Account Number</span>
                          <div className="flex items-center gap-2">
                            <span className="text-cream font-mono text-sm">
                              {selectedBank.accountNumber}
                            </span>
                            <button onClick={() => handleCopy(selectedBank.accountNumber)}>
                              <Copy className="w-4 h-4 text-cream/40 hover:text-cream" />
                            </button>
                          </div>
                        </div>

                        {selectedBank.routingNumber && (
                          <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                            <span className="text-cream/60 text-sm">Routing Number</span>
                            <span className="text-cream font-mono text-sm">
                              {selectedBank.routingNumber}
                            </span>
                          </div>
                        )}

                        {selectedBank.swiftCode && (
                          <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                            <span className="text-cream/60 text-sm">SWIFT Code</span>
                            <span className="text-cream font-mono text-sm">{selectedBank.swiftCode}</span>
                          </div>
                        )}

                        {selectedBank.iban && (
                          <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                            <span className="text-cream/60 text-sm">IBAN</span>
                            <span className="text-cream font-mono text-sm">{selectedBank.iban}</span>
                          </div>
                        )}

                        <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                          <span className="text-cream/60 text-sm">Currency</span>
                          <span className="text-cream text-sm">{selectedBank.currency}</span>
                        </div>
                      </div>

                      {selectedBank.instructions && (
                        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-sm">
                          <p className="text-blue-400">{selectedBank.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Processor Details */}
                  {selectedMethodType === 'processor' && selectedProcessor && (
                    <div className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/20 mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">
                          {selectedProcessor.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-cream">{selectedProcessor.name}</p>
                          <p className="text-sm text-cream/60">Fee: {selectedProcessor.fee}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                          <span className="text-cream/60 text-sm">Account</span>
                          <div className="flex items-center gap-2">
                            <span className="text-cream font-medium text-sm">
                              {selectedProcessor.accountId}
                            </span>
                            <button onClick={() => handleCopy(selectedProcessor.accountId)}>
                              <Copy className="w-4 h-4 text-cream/40 hover:text-cream" />
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between p-3 bg-void/30 rounded-lg">
                          <span className="text-cream/60 text-sm">Name</span>
                          <span className="text-cream text-sm">{selectedProcessor.accountName}</span>
                        </div>
                      </div>

                      {selectedProcessor.instructions && (
                        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-sm">
                          <p className="text-blue-400">{selectedProcessor.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Amount Input */}
                  <div className="mb-6">
                    <label className="text-sm text-cream/60 mb-2 block">Amount (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/50">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Min: ${getMinDeposit()}`}
                        className="w-full pl-8 pr-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream text-lg font-medium focus:border-gold focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {quickAmounts.map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setAmount(amt.toString())}
                          className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            amount === amt.toString()
                              ? 'bg-gold text-void'
                              : 'bg-white/5 text-cream/60 hover:bg-white/10 hover:text-cream'
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setDepositStep('confirm')}
                    disabled={!amount || parseFloat(amount) < getMinDeposit()}
                    className="w-full py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Step 3: Confirm & Submit Proof */}
              {depositStep === 'confirm' && (
                <div>
                  <h2 className="text-lg font-semibold text-cream mb-4">Confirm Deposit</h2>

                  <div className="p-4 bg-void/50 rounded-xl border border-white/10 mb-6">
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <span className="text-cream/60">Amount</span>
                      <span className="text-cream font-semibold">
                        ${parseFloat(amount).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <span className="text-cream/60">Method</span>
                      <span className="text-cream">
                        {selectedMethodType === 'crypto' && selectedCrypto?.name}
                        {selectedMethodType === 'bank' && selectedBank?.bankName}
                        {selectedMethodType === 'processor' && selectedProcessor?.name}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-cream/60">Processing</span>
                      <span className="text-cream">1-24 hours</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm text-cream/60 mb-2 block">
                      Transaction ID / Reference {selectedMethodType !== 'crypto' && '(optional)'}
                    </label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder={selectedMethodType === 'crypto' ? 'Enter transaction hash' : 'Enter reference number'}
                      className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream focus:border-gold focus:outline-none"
                    />
                  </div>

                  {requireProof && (
                    <div className="mb-6">
                      <label className="text-sm text-cream/60 mb-2 block">Payment Proof (Screenshot)</label>
                      {!proofImage ? (
                        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
                          <Upload className="w-8 h-8 text-cream/40 mb-2" />
                          <span className="text-sm text-cream/60">Click to upload screenshot</span>
                          <span className="text-xs text-cream/40 mt-1">PNG, JPG up to 5MB</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                      ) : (
                        <div className="relative">
                          <img src={proofImage} alt="Payment proof" className="w-full h-40 object-cover rounded-xl" />
                          <button
                            onClick={() => setProofImage(null)}
                            className="absolute top-2 right-2 p-1 bg-void/80 rounded-lg hover:bg-void"
                          >
                            <X className="w-4 h-4 text-cream" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 mb-6">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-300">
                        <p className="mb-2">{depositInstructions}</p>
                        <p className="text-blue-400/70">
                          Need help?{' '}
                          <a href={`mailto:${supportEmail}`} className="text-blue-400 underline">
                            {supportEmail}
                          </a>
                          {supportWhatsApp && (
                            <>
                              {' '}or{' '}
                              <a
                                href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}`}
                                className="text-blue-400 underline"
                              >
                                WhatsApp
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmitDeposit}
                    disabled={
                      isSubmitting ||
                      (requireProof && !proofImage) ||
                      (selectedMethodType === 'crypto' && !transactionRef)
                    }
                    className="w-full py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" /> Submit Deposit Request
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 4: Submitted Success */}
              {depositStep === 'submitted' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-profit/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-profit" />
                  </div>
                  <h2 className="text-2xl font-bold text-cream mb-2">Deposit Submitted!</h2>
                  <p className="text-cream/60 mb-6 max-w-md mx-auto">
                    Your deposit request has been submitted. Our team will verify and credit your account within 1-24 hours.
                  </p>

                  <div className="p-4 bg-gold/10 rounded-xl border border-gold/20 mb-6 max-w-md mx-auto">
                    <p className="text-sm text-cream/70">
                      Amount:{' '}
                      <span className="text-cream font-semibold">
                        ${parseFloat(amount).toLocaleString()}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={resetDeposit}
                      className="px-6 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors"
                    >
                      Make Another Deposit
                    </button>
                    <Link
                      href="/dashboard"
                      className="px-6 py-3 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-colors"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Withdraw Tab */}
          {activeTab === 'withdraw' && (
            <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
              <h2 className="text-lg font-semibold text-cream mb-4">Withdraw Funds</h2>

              {(user?.balance || 0) === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="w-12 h-12 text-cream/20 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-cream mb-2">No Funds to Withdraw</h3>
                  <p className="text-cream/60 mb-4">Deposit funds first before you can withdraw.</p>
                  <button
                    onClick={() => setActiveTab('deposit')}
                    className="px-6 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors"
                  >
                    Make a Deposit
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Balance Summary */}
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-cream/50 mb-1">Available for Withdrawal</p>
                    <p className="text-3xl font-bold text-cream">
                      ${(user?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Finance Team Contact */}
                  <div className="p-5 bg-gradient-to-br from-gold/10 to-gold/5 rounded-xl border border-gold/20">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-gold" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-cream mb-1">Finance Department</h3>
                        <p className="text-sm text-cream/60 mb-4">
                          All withdrawal requests are processed by our finance team to ensure security
                          and compliance. Please contact us directly to initiate your withdrawal.
                        </p>

                        <div className="space-y-3 mb-5">
                          <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <p className="text-xs text-gold font-medium mb-1">Head of Finance</p>
                            <p className="text-sm font-semibold text-cream">Mr. Walsh & Associates</p>
                            <p className="text-xs text-cream/50 mt-0.5">Withdrawal Processing Team</p>
                          </div>

                          <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-3">
                            <Mail className="w-4 h-4 text-electric flex-shrink-0" />
                            <div>
                              <p className="text-xs text-cream/50">Email</p>
                              <a href={`mailto:${supportEmail || 'finance@novatrade.io'}`} className="text-sm text-electric hover:underline">
                                {supportEmail || 'finance@novatrade.io'}
                              </a>
                            </div>
                          </div>

                          {supportWhatsApp && (
                            <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-3">
                              <MessageCircle className="w-4 h-4 text-profit flex-shrink-0" />
                              <div>
                                <p className="text-xs text-cream/50">WhatsApp</p>
                                <a href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}`}
                                   target="_blank" rel="noopener noreferrer"
                                   className="text-sm text-profit hover:underline">
                                  {supportWhatsApp}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <a
                            href={`mailto:${supportEmail || 'finance@novatrade.io'}?subject=Withdrawal Request — ${user?.email}&body=Hi Finance Team,%0A%0AI would like to request a withdrawal.%0A%0AAccount: ${user?.email}%0AAmount: $${(user?.balance || 0).toFixed(2)}%0A%0AThank you.`}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gold text-void font-semibold text-sm rounded-xl hover:bg-gold/90 transition-all"
                          >
                            <Mail className="w-4 h-4" /> Email Finance Team
                          </a>
                          {supportWhatsApp && (
                            <a
                              href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hi, I'd like to request a withdrawal from my NovaTrade account (${user?.email}). Amount: $${(user?.balance || 0).toFixed(2)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-5 py-2.5 bg-profit/20 text-profit font-semibold text-sm rounded-xl hover:bg-profit/30 transition-all border border-profit/20"
                            >
                              <MessageCircle className="w-4 h-4" /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Processing Info */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-lg font-bold text-cream">24h</p>
                      <p className="text-xs text-cream/40">Processing Time</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-lg font-bold text-cream">$50</p>
                      <p className="text-xs text-cream/40">Min. Withdrawal</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-lg font-bold text-cream">0%</p>
                      <p className="text-xs text-cream/40">Withdrawal Fee</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl flex items-start gap-2">
                    <Info className="w-4 h-4 text-cream/40 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-cream/40">
                      For security, all withdrawals are manually verified by our finance department.
                      Please have your account details and preferred payment method ready when you contact us.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-cream">Transaction History</h2>
                <button
                  onClick={loadDepositsFromDB}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-cream/40 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${depositsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {depositsLoading && userDeposits.length === 0 ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto mb-4" />
                  <p className="text-cream/60">Loading transactions...</p>
                </div>
              ) : userDeposits.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-cream/20 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-cream mb-2">No Transactions Yet</h3>
                  <p className="text-cream/60">Your deposit history will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userDeposits.map((deposit: any) => (
                    <div key={deposit.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              deposit.status === 'confirmed' || deposit.status === 'approved'
                                ? 'bg-profit/10'
                                : deposit.status === 'rejected'
                                ? 'bg-loss/10'
                                : 'bg-yellow-500/10'
                            }`}
                          >
                            {deposit.status === 'confirmed' || deposit.status === 'approved' ? (
                              <CheckCircle2 className="w-5 h-5 text-profit" />
                            ) : deposit.status === 'rejected' ? (
                              <XCircle className="w-5 h-5 text-loss" />
                            ) : (
                              <Clock className="w-5 h-5 text-yellow-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-cream">${Number(deposit.amount).toLocaleString()}</p>
                            <p className="text-xs text-cream/50">{deposit.methodName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              deposit.status === 'confirmed' || deposit.status === 'approved'
                                ? 'bg-profit/10 text-profit'
                                : deposit.status === 'rejected'
                                ? 'bg-loss/10 text-loss'
                                : 'bg-yellow-500/10 text-yellow-500'
                            }`}
                          >
                            {deposit.status === 'confirmed' ? 'Confirmed' : deposit.status === 'approved' ? 'Approved' : deposit.status}
                          </span>
                          <p className="text-xs text-cream/40 mt-1">
                            {new Date(deposit.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {/* Show rejection reason */}
                      {deposit.status === 'rejected' && deposit.rejectionReason && (
                        <div className="mt-2 p-2 bg-loss/5 border border-loss/10 rounded-lg">
                          <p className="text-xs text-loss">{deposit.rejectionReason}</p>
                        </div>
                      )}
                      {/* Show tx hash */}
                      {deposit.txHash && (
                        <p className="mt-1 text-[10px] text-cream/30 font-mono truncate">
                          TX: {deposit.txHash}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Info */}
        <div className="space-y-4">
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h3 className="text-lg font-semibold text-cream mb-4">Need Help?</h3>
            <div className="space-y-3">
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Mail className="w-5 h-5 text-gold" />
                  <span className="text-sm text-cream">{supportEmail}</span>
                </a>
              )}
              {supportWhatsApp && (
                <a
                  href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-profit" />
                  <span className="text-sm text-cream">{supportWhatsApp}</span>
                </a>
              )}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <h3 className="text-lg font-semibold text-cream mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/trade/fx"
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <TrendingUp className="w-5 h-5 text-gold" />
                <span className="text-sm text-cream">Trade Forex</span>
                <ChevronRight className="w-4 h-4 text-cream/30 ml-auto" />
              </Link>

              <Link
                href="/dashboard/trade/crypto"
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Bitcoin className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-cream">Trade Crypto</span>
                <ChevronRight className="w-4 h-4 text-cream/30 ml-auto" />
              </Link>

              <Link
                href="/invest/plans"
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Gift className="w-5 h-5 text-electric" />
                <span className="text-sm text-cream">Investment Plans</span>
                <ChevronRight className="w-4 h-4 text-cream/30 ml-auto" />
              </Link>
            </div>
          </div>

          <div className="p-4 bg-electric/5 rounded-xl border border-electric/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-electric flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-cream">Secure Deposits</p>
                <p className="text-xs text-slate-400 mt-1">
                  All deposits are verified manually for your security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </KYCGate>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-32 mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-48 mb-6"></div>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="h-32 bg-white/5 rounded-2xl"></div>
              <div className="h-32 bg-white/5 rounded-2xl"></div>
              <div className="h-32 bg-white/5 rounded-2xl"></div>
            </div>
          </div>
        </div>
      }
    >
      <WalletContent />
    </Suspense>
  );
}
