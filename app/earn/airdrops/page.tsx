'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Wallet,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Coins,
  Sparkles,
  ArrowRight,
  Copy,
  Shield,
  Zap,
  Star,
  Loader2,
  Check,
  X,
  Info,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const AIRDROP_CONFIG = {
  key: 'nova_s1',
  name: 'NOVA Airdrop Season 1',
  totalPool: 10000000,
  bnbPool: 0, // keeping simple (offchain)
  endDate: new Date('2026-03-31'), // ✅ change as you want
  baseAllocation: 500,
  requiredReferrals: 5,
};

const claimSteps = [
  { id: 1, name: 'Sign In', description: 'Login to your account' },
  { id: 2, name: 'Refer Users', description: 'Get 5 verified referrals' },
  { id: 3, name: 'Connect Wallet', description: 'Optional wallet link' },
  { id: 4, name: 'Claim', description: 'Receive your NOVA' },
];

function formatAddress(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function NovaAirdropPage() {
  const store = useStore() as any;
  const user = store?.user || null;

  // auth token for server routes
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // wallet state (optional)
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);

  // server status
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [eligible, setEligible] = useState(false);
  const [verifiedReferrals, setVerifiedReferrals] = useState(0);
  const [requiredReferrals, setRequiredReferrals] = useState(AIRDROP_CONFIG.requiredReferrals);
  const [allocation, setAllocation] = useState(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimInfo, setClaimInfo] = useState<any>(null);

  // ui
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // stats banner
  const [timeLeft, setTimeLeft] = useState('');

  const referralLink = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://www.novaatrade.com';
    if (!referralCode) return '';
    return `${origin}/auth/signup?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode]);

  const currentStep = useMemo(() => {
    if (!user) return 1;
    if (user && !eligible) return 2;
    if (eligible && !walletConnected) return 3;
    return 4;
  }, [user, eligible, walletConnected]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const diff = AIRDROP_CONFIG.endDate.getTime() - now.getTime();
      if (diff <= 0) return setTimeLeft('Ended');

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    };

    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, []);

  // get access token (for server routes)
  useEffect(() => {
    (async () => {
      try {
        if (!isSupabaseConfigured) return;
        const { data } = await supabase.auth.getSession();
        setAccessToken(data.session?.access_token || null);
      } catch {
        setAccessToken(null);
      }
    })();
  }, [user]);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setStatusError('');
    try {
      if (!accessToken) {
        setStatusError('Please sign in to check eligibility.');
        return;
      }

      const res = await fetch('/api/airdrops/nova-s1/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusError(json?.error || 'Failed to load airdrop status');
        return;
      }

      setEligible(!!json.eligible);
      setVerifiedReferrals(Number(json.verifiedReferrals || 0));
      setRequiredReferrals(Number(json.requiredReferrals || AIRDROP_CONFIG.requiredReferrals));
      setAllocation(Number(json.allocation || 0));
      setReferralCode(json.referralCode || null);
      setClaimed(!!json.claimed);
      setClaimInfo(json.claim || null);
    } catch (e: any) {
      setStatusError(e?.message || 'Failed to load airdrop status');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (user && accessToken) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  const connectWallet = async () => {
    setError('');
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        setError('No Web3 wallet detected. Install MetaMask or a compatible wallet.');
        return;
      }
      const ethereum = (window as any).ethereum;

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0] || '';
      if (!addr) {
        setError('No wallet account found.');
        return;
      }

      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      const cid = parseInt(chainIdHex, 16);

      setWalletAddress(addr);
      setChainId(cid);
      setWalletConnected(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to connect wallet');
    }
  };

  const copyReferralLink = async () => {
    try {
      if (!referralLink) return;
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const claimAirdrop = async () => {
    setError('');
    setIsClaiming(true);

    try {
      if (!accessToken) {
        setError('Please sign in first.');
        return;
      }
      if (!eligible) {
        setError(`You need ${requiredReferrals} verified referrals to claim.`);
        return;
      }

      const res = await fetch('/api/airdrops/nova-s1/claim', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          walletAddress: walletConnected ? walletAddress : null,
          chainId: chainId ?? null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Claim failed');
        return;
      }

      setClaimed(true);
      setClaimInfo(json.claim || null);
      setAllocation(Number(json.allocation || allocation));
    } catch (e: any) {
      setError(e?.message || 'Claim failed');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <Navigation />

      <main className="pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold/20 to-profit/20 border border-gold/30 rounded-full mb-6"
            >
              <Sparkles className="w-4 h-4 text-gold animate-pulse" />
              <span className="text-gold text-sm font-medium">{AIRDROP_CONFIG.name}</span>
              <Sparkles className="w-4 h-4 text-gold animate-pulse" />
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-4">
              NOVA Airdrop
              <br />
              <span className="gradient-text-gold">Refer {requiredReferrals} users to claim</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Simple rule: invite {requiredReferrals} users → they create accounts + verify email → you can claim.
            </p>
          </div>

          {/* Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              {
                label: 'Total Pool',
                value: `${(AIRDROP_CONFIG.totalPool / 1000000).toFixed(0)}M NOVA`,
                icon: Coins,
                color: 'text-gold',
              },
              {
                label: 'Required Referrals',
                value: `${requiredReferrals}`,
                icon: Users,
                color: 'text-electric',
              },
              {
                label: 'Your Referrals',
                value: user ? `${verifiedReferrals}` : '—',
                icon: Star,
                color: 'text-profit',
              },
              { label: 'Time Left', value: timeLeft || '—', icon: Clock, color: 'text-loss' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10 text-center"
              >
                <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Main Card */}
            <div className="lg:col-span-3">
              <div className="bg-gradient-to-b from-charcoal to-charcoal/50 rounded-3xl border border-gold/20 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-gold/10 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center">
                        <Gift className="w-6 h-6 text-gold" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-cream">Claim Your Airdrop</h2>
                        <p className="text-sm text-cream/50">Refer → Verify → Claim (server-verified)</p>
                      </div>
                    </div>

                    {user && (
                      <button
                        onClick={fetchStatus}
                        disabled={loadingStatus}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-sm text-cream/70 hover:bg-white/10 transition-colors disabled:opacity-60"
                      >
                        {loadingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Info className="w-4 h-4" />}
                        Refresh
                      </button>
                    )}
                  </div>
                </div>

                {/* Steps */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    {claimSteps.map((step, index) => (
                      <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                              currentStep > step.id
                                ? 'bg-profit text-void'
                                : currentStep === step.id
                                ? 'bg-gold text-void'
                                : 'bg-white/10 text-cream/50'
                            }`}
                          >
                            {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                          </div>
                          <p
                            className={`text-xs mt-2 text-center max-w-[90px] ${
                              currentStep >= step.id ? 'text-cream' : 'text-cream/40'
                            }`}
                          >
                            {step.name}
                          </p>
                        </div>

                        {index < claimSteps.length - 1 && (
                          <div
                            className={`w-10 md:w-16 h-0.5 mx-2 ${
                              currentStep > step.id ? 'bg-profit' : 'bg-white/10'
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6">
                  <AnimatePresence>
                    {(error || statusError) && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 p-4 bg-loss/10 border border-loss/20 rounded-xl flex items-center gap-3"
                      >
                        <AlertCircle className="w-5 h-5 text-loss flex-shrink-0" />
                        <p className="text-sm text-loss">{error || statusError}</p>
                        <button onClick={() => { setError(''); setStatusError(''); }} className="ml-auto">
                          <X className="w-4 h-4 text-loss" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Not signed in */}
                  {!user && (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-gold" />
                      </div>
                      <h3 className="text-xl font-bold text-cream mb-2">Sign in to start</h3>
                      <p className="text-cream/60 mb-6 max-w-md mx-auto">
                        You need an account to track referrals and claim the airdrop.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                          href="/auth/signup"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
                        >
                          Create Account
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                          href="/auth/login"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
                        >
                          Sign In
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Signed in */}
                  {user && (
                    <div className="space-y-6">
                      {/* Referral block */}
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-cream font-bold text-lg">Your referral progress</p>
                            <p className="text-sm text-cream/50">
                              You need <span className="text-cream">{requiredReferrals}</span> verified referrals.
                              Verified means: user signed up + verified email.
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-3xl font-bold text-gold">
                              {verifiedReferrals}/{requiredReferrals}
                            </p>
                            <p className="text-xs text-cream/50">Verified referrals</p>
                          </div>
                        </div>

                        <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-gold to-yellow-500"
                            style={{
                              width: `${Math.min(100, (verifiedReferrals / requiredReferrals) * 100)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-5 flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={copyReferralLink}
                            disabled={!referralLink}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all disabled:opacity-60"
                          >
                            {copied ? <Check className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy referral link'}
                          </button>

                          <Link
                            href={referralLink ? `/auth/signup?ref=${encodeURIComponent(referralCode || '')}` : '/auth/signup'}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
                          >
                            Test link
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>

                        {referralCode && (
                          <p className="mt-3 text-xs text-cream/50">
                            Code: <span className="text-cream font-mono">{referralCode}</span>
                          </p>
                        )}
                      </div>

                      {/* Wallet connect (optional) */}
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gold/10 rounded-xl flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-gold" />
                            </div>
                            <div>
                              <p className="text-cream font-bold">Wallet (optional)</p>
                              <p className="text-sm text-cream/50">
                                You can attach a wallet to your claim for later on-chain delivery.
                              </p>
                            </div>
                          </div>

                          {!walletConnected ? (
                            <button
                              onClick={connectWallet}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
                            >
                              <Wallet className="w-4 h-4" />
                              Connect
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 bg-profit/20 text-profit text-sm font-bold rounded-xl">
                              {formatAddress(walletAddress)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Claim area */}
                      <div className="bg-gradient-to-r from-gold/10 to-profit/10 rounded-2xl p-6 border border-gold/20">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-cream font-bold text-lg">Your Allocation</p>
                          {eligible ? (
                            <span className="px-2 py-1 bg-profit/20 text-profit text-xs font-bold rounded-full">
                              Eligible
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-loss/20 text-loss text-xs font-bold rounded-full">
                              Locked
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2 mb-4">
                          <span className="text-5xl font-bold text-gold">
                            {eligible ? allocation.toLocaleString() : '0'}
                          </span>
                          <span className="text-xl text-cream/50">NOVA</span>
                        </div>

                        {!claimed ? (
                          <button
                            onClick={claimAirdrop}
                            disabled={!eligible || isClaiming}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-gold to-yellow-500 text-void font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {isClaiming ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                <Zap className="w-5 h-5" />
                                {eligible ? `Claim ${allocation.toLocaleString()} NOVA` : `Refer ${requiredReferrals} users to unlock`}
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="text-center py-2">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-profit/20 text-profit font-bold rounded-xl">
                              <CheckCircle className="w-5 h-5" />
                              Claimed
                            </div>
                            {claimInfo?.claimed_at && (
                              <p className="mt-2 text-xs text-cream/50">
                                Claimed at: <span className="text-cream">{new Date(claimInfo.claimed_at).toLocaleString()}</span>
                              </p>
                            )}
                          </div>
                        )}

                        <p className="text-center text-xs text-cream/40 mt-4">
                          Eligibility is verified server-side by your referral count (email verified users).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-cream mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-gold" />
                  How it works
                </h3>

                <div className="space-y-4">
                  {[
                    { step: 1, title: 'Share your link', desc: 'Send your referral link to friends' },
                    { step: 2, title: 'They sign up + verify', desc: 'We count only verified accounts' },
                    { step: 3, title: `Hit ${AIRDROP_CONFIG.requiredReferrals} verified referrals`, desc: 'Unlock claim automatically' },
                    { step: 4, title: 'Claim', desc: 'We record your claim in the database (production-safe)' },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-gold font-bold">{item.step}</span>
                      </div>
                      <div>
                        <p className="text-cream font-medium">{item.title}</p>
                        <p className="text-sm text-cream/50">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-profit/10 rounded-2xl border border-profit/20 p-6">
                <h3 className="text-lg font-bold text-cream mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-profit" />
                  Security
                </h3>
                <ul className="space-y-2 text-sm text-cream/70">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    Eligibility checked on server
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    One claim per user (unique index)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    No client-side “fake keys”
                  </li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <p className="text-sm text-cream/60">
                  Want this to actually send tokens on-chain later? We can add a “distribution job”
                  that reads <span className="text-cream font-mono">airdrop_claims</span> and transfers
                  tokens in batches — without changing this UI.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
