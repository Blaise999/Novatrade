'use client';

import { useState, useEffect } from 'react';
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
  ExternalLink,
  Copy,
  Shield,
  Zap,
  Trophy,
  Star,
  Loader2,
  Check,
  X,
  Info
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

// Airdrop Configuration
const AIRDROP_CONFIG = {
  name: 'NOVA Airdrop Season 1',
  totalPool: 10000000, // 10M NOVA tokens
  bnbPool: 100, // 100 BNB giveaway
  claimFee: 0.10, // $0.10 USDC fee
  feeToken: 'USDC',
  feeTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum (example)
  airdropContractAddress: '0x...YourAirdropContract',
  chainId: 1, // Ethereum mainnet (change as needed)
  endDate: new Date('2025-03-31'),
  baseAllocation: 500, // Base NOVA tokens per eligible user
  bnbChance: 0.1, // 10% chance to win BNB
};

// Eligibility tiers
const eligibilityTiers = [
  { name: 'Early Adopter', requirement: 'Signed up before Jan 2025', bonus: 2.0, icon: '🌟' },
  { name: 'Active Trader', requirement: '10+ trades completed', bonus: 1.5, icon: '📈' },
  { name: 'Referrer', requirement: '3+ successful referrals', bonus: 1.3, icon: '👥' },
  { name: 'Staker', requirement: 'Active staking position', bonus: 1.2, icon: '🔒' },
  { name: 'Holder', requirement: 'Holding 100+ NOVA', bonus: 1.1, icon: '💎' },
];

// Claim steps
const claimSteps = [
  { id: 1, name: 'Connect Wallet', description: 'Connect your Web3 wallet' },
  { id: 2, name: 'Check Eligibility', description: 'Verify your airdrop allocation' },
  { id: 3, name: 'Sign Permit', description: 'Sign fee approval (no gas)' },
  { id: 4, name: 'Claim Tokens', description: 'Receive your NOVA tokens' },
];

export default function NovaAirdropPage() {
  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  
  // Claim state
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [allocation, setAllocation] = useState(0);
  const [bonusMultiplier, setBonusMultiplier] = useState(1);
  const [userTiers, setUserTiers] = useState<string[]>([]);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState('');
  const [wonBnb, setWonBnb] = useState(false);
  const [bnbAmount, setBnbAmount] = useState(0);
  
  // UI state
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalClaimed: 4521893,
    totalClaimers: 12847,
    bnbWinners: 1284,
    timeLeft: '',
  });

  // Calculate time left
  useEffect(() => {
    const updateTimeLeft = () => {
      const now = new Date();
      const diff = AIRDROP_CONFIG.endDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setStats(s => ({ ...s, timeLeft: 'Ended' }));
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setStats(s => ({ ...s, timeLeft: `${days}d ${hours}h ${minutes}m` }));
    };
    
    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, []);

  // Connect wallet function
  const connectWallet = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Check if MetaMask or similar is installed
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        
        // Request account access
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        
        // Get chain ID
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(chainIdHex, 16);
        
        setWalletAddress(address);
        setChainId(currentChainId);
        setWalletConnected(true);
        setCurrentStep(2);
        
        // Auto-check eligibility
        await checkEligibility(address);
        
      } else {
        setError('No Web3 wallet detected. Please install MetaMask or a compatible wallet.');
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  // Check eligibility (simulated - would be Merkle proof in production)
  const checkEligibility = async (address: string) => {
    setIsLoading(true);
    
    // Simulate API call to check eligibility
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulated eligibility check (in production, verify against Merkle tree)
    const isUserEligible = true; // Simulated
    const userBonusTiers = ['Early Adopter', 'Active Trader']; // Simulated
    
    if (isUserEligible) {
      // Calculate allocation based on tiers
      let multiplier = 1;
      userBonusTiers.forEach(tierName => {
        const tier = eligibilityTiers.find(t => t.name === tierName);
        if (tier && tier.bonus > multiplier) {
          multiplier = tier.bonus;
        }
      });
      
      const totalAllocation = Math.floor(AIRDROP_CONFIG.baseAllocation * multiplier);
      
      setIsEligible(true);
      setAllocation(totalAllocation);
      setBonusMultiplier(multiplier);
      setUserTiers(userBonusTiers);
      setCurrentStep(3);
    } else {
      setIsEligible(false);
    }
    
    setIsLoading(false);
  };

  // Sign permit and claim
  const signPermitAndClaim = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const ethereum = (window as any).ethereum;
      
      // In production, you would:
      // 1. Get nonce from fee token contract
      // 2. Build EIP-712 typed data for permit
      // 3. Request signature from wallet
      // 4. Call contract with permit + claim
      
      // Simulated permit signing
      console.log('Requesting permit signature...');
      
      // This is the actual permit signing code structure:
      /*
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      
      // Get token info
      const feeToken = new ethers.Contract(AIRDROP_CONFIG.feeTokenAddress, ERC20_PERMIT_ABI, provider);
      const tokenName = await feeToken.name();
      const nonce = await feeToken.nonces(walletAddress);
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 mins
      const feeAmount = ethers.parseUnits(AIRDROP_CONFIG.claimFee.toString(), 6); // USDC has 6 decimals
      
      const domain = {
        name: tokenName,
        version: "1",
        chainId: chainId,
        verifyingContract: AIRDROP_CONFIG.feeTokenAddress,
      };
      
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      
      const message = {
        owner: walletAddress,
        spender: AIRDROP_CONFIG.airdropContractAddress,
        value: feeAmount,
        nonce,
        deadline,
      };
      
      // Sign permit
      const sig = await signer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);
      
      // Call claim function
      const airdropContract = new ethers.Contract(AIRDROP_CONFIG.airdropContractAddress, AIRDROP_ABI, signer);
      const tx = await airdropContract.claimWithPermitFee(allocation, merkleProof, deadline, v, r, s);
      const receipt = await tx.wait();
      */
      
      // Simulate the process for demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful claim
      const fakeTxHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      setClaimTxHash(fakeTxHash);
      
      // Simulate BNB lottery (10% chance)
      const wonLottery = Math.random() < AIRDROP_CONFIG.bnbChance;
      if (wonLottery) {
        setWonBnb(true);
        setBnbAmount(0.1 + Math.random() * 0.4); // 0.1 - 0.5 BNB
      }
      
      setHasClaimed(true);
      setCurrentStep(4);
      
    } catch (err: any) {
      console.error('Claim error:', err);
      if (err.code === 4001) {
        setError('Transaction rejected by user');
      } else {
        setError(err.message || 'Failed to claim airdrop');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Copy address
  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format address
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
              <span className="text-gold text-sm font-medium">Season 1 Airdrop Live!</span>
              <Sparkles className="w-4 h-4 text-gold animate-pulse" />
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-cream mb-4">
              NOVA Airdrop
              <br />
              <span className="gradient-text-gold">+ BNB Giveaway</span>
            </h1>
            <p className="text-lg text-cream/60 max-w-2xl mx-auto">
              Claim your free NOVA tokens and get a chance to win BNB! 
              Pay only a small ${AIRDROP_CONFIG.claimFee} fee to claim.
            </p>
          </div>

          {/* Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: 'Total Pool', value: `${(AIRDROP_CONFIG.totalPool / 1000000).toFixed(0)}M NOVA`, icon: Coins, color: 'text-gold' },
              { label: 'BNB Giveaway', value: `${AIRDROP_CONFIG.bnbPool} BNB`, icon: Gift, color: 'text-profit' },
              { label: 'Claimed', value: stats.totalClaimers.toLocaleString(), icon: Users, color: 'text-electric' },
              { label: 'Time Left', value: stats.timeLeft, icon: Clock, color: 'text-loss' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10 text-center"
              >
                <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-cream/50">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Main Claim Card */}
            <div className="lg:col-span-3">
              <div className="bg-gradient-to-b from-charcoal to-charcoal/50 rounded-3xl border border-gold/20 overflow-hidden">
                {/* Card Header */}
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-gold/10 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center">
                        <Gift className="w-6 h-6 text-gold" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-cream">Claim Your Airdrop</h2>
                        <p className="text-sm text-cream/50">One-click claim with permit</p>
                      </div>
                    </div>
                    {walletConnected && (
                      <button
                        onClick={copyAddress}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-sm text-cream/70 hover:bg-white/10 transition-colors"
                      >
                        {formatAddress(walletAddress)}
                        {copied ? <Check className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    {claimSteps.map((step, index) => (
                      <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                            currentStep > step.id 
                              ? 'bg-profit text-void' 
                              : currentStep === step.id 
                                ? 'bg-gold text-void' 
                                : 'bg-white/10 text-cream/50'
                          }`}>
                            {currentStep > step.id ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              step.id
                            )}
                          </div>
                          <p className={`text-xs mt-2 text-center max-w-[80px] ${
                            currentStep >= step.id ? 'text-cream' : 'text-cream/40'
                          }`}>
                            {step.name}
                          </p>
                        </div>
                        {index < claimSteps.length - 1 && (
                          <div className={`w-12 md:w-20 h-0.5 mx-2 ${
                            currentStep > step.id ? 'bg-profit' : 'bg-white/10'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="p-6">
                  {/* Error Display */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 p-4 bg-loss/10 border border-loss/20 rounded-xl flex items-center gap-3"
                      >
                        <AlertCircle className="w-5 h-5 text-loss flex-shrink-0" />
                        <p className="text-sm text-loss">{error}</p>
                        <button onClick={() => setError('')} className="ml-auto">
                          <X className="w-4 h-4 text-loss" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Step 1: Connect Wallet */}
                  {!walletConnected && (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Wallet className="w-10 h-10 text-gold" />
                      </div>
                      <h3 className="text-xl font-bold text-cream mb-2">Connect Your Wallet</h3>
                      <p className="text-cream/60 mb-6 max-w-md mx-auto">
                        Connect your Web3 wallet to check eligibility and claim your NOVA tokens.
                      </p>
                      <button
                        onClick={connectWallet}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Wallet className="w-5 h-5" />
                            Connect Wallet
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Step 2 & 3: Eligibility & Claim */}
                  {walletConnected && !hasClaimed && (
                    <div>
                      {isEligible === null && isLoading && (
                        <div className="text-center py-8">
                          <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto mb-4" />
                          <p className="text-cream">Checking eligibility...</p>
                        </div>
                      )}

                      {isEligible === false && (
                        <div className="text-center py-8">
                          <div className="w-20 h-20 bg-loss/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <X className="w-10 h-10 text-loss" />
                          </div>
                          <h3 className="text-xl font-bold text-cream mb-2">Not Eligible</h3>
                          <p className="text-cream/60 mb-6">
                            Sorry, this wallet is not eligible for the airdrop. 
                            Make sure you're using the correct wallet.
                          </p>
                          <Link
                            href="/earn/airdrops"
                            className="text-gold hover:underline"
                          >
                            View other airdrops →
                          </Link>
                        </div>
                      )}

                      {isEligible === true && (
                        <div>
                          {/* Allocation Display */}
                          <div className="bg-gradient-to-r from-gold/10 to-profit/10 rounded-2xl p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-cream/70">Your Allocation</span>
                              {bonusMultiplier > 1 && (
                                <span className="px-2 py-1 bg-profit/20 text-profit text-xs font-bold rounded-full">
                                  {bonusMultiplier}x BONUS
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2 mb-4">
                              <span className="text-5xl font-bold text-gold">{allocation.toLocaleString()}</span>
                              <span className="text-xl text-cream/50">NOVA</span>
                            </div>
                            
                            {/* User Tiers */}
                            {userTiers.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {userTiers.map((tierName) => {
                                  const tier = eligibilityTiers.find(t => t.name === tierName);
                                  return (
                                    <span key={tierName} className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-lg text-xs text-cream/70">
                                      <span>{tier?.icon}</span>
                                      {tierName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* BNB Lottery Info */}
                          <div className="bg-white/5 rounded-xl p-4 mb-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                              <Trophy className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div className="flex-1">
                              <p className="text-cream font-medium">BNB Lottery Included!</p>
                              <p className="text-sm text-cream/50">
                                {Math.round(AIRDROP_CONFIG.bnbChance * 100)}% chance to win up to 0.5 BNB
                              </p>
                            </div>
                          </div>

                          {/* Fee Info */}
                          <div className="bg-white/5 rounded-xl p-4 mb-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Info className="w-5 h-5 text-electric" />
                                <div>
                                  <p className="text-cream font-medium">Claim Fee</p>
                                  <p className="text-sm text-cream/50">One-time fee via permit (no approve tx needed)</p>
                                </div>
                              </div>
                              <span className="text-lg font-bold text-cream">
                                ${AIRDROP_CONFIG.claimFee} {AIRDROP_CONFIG.feeToken}
                              </span>
                            </div>
                          </div>

                          {/* Claim Button */}
                          <button
                            onClick={signPermitAndClaim}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-gold to-yellow-500 text-void font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {currentStep === 3 ? 'Signing Permit...' : 'Claiming...'}
                              </>
                            ) : (
                              <>
                                <Zap className="w-5 h-5" />
                                Claim {allocation.toLocaleString()} NOVA
                              </>
                            )}
                          </button>

                          <p className="text-center text-xs text-cream/40 mt-4">
                            By claiming, you agree to pay ${AIRDROP_CONFIG.claimFee} {AIRDROP_CONFIG.feeToken} fee
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Success */}
                  {hasClaimed && (
                    <div className="text-center py-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-24 h-24 bg-profit/20 rounded-full flex items-center justify-center mx-auto mb-6"
                      >
                        <CheckCircle className="w-12 h-12 text-profit" />
                      </motion.div>
                      
                      <h3 className="text-2xl font-bold text-cream mb-2">
                        Claim Successful! 🎉
                      </h3>
                      <p className="text-cream/60 mb-6">
                        You have received <span className="text-gold font-bold">{allocation.toLocaleString()} NOVA</span>
                      </p>

                      {/* BNB Win Announcement */}
                      {wonBnb && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mb-6 p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30"
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                            <span className="text-yellow-500 font-bold text-lg">CONGRATULATIONS!</span>
                            <Trophy className="w-6 h-6 text-yellow-500" />
                          </div>
                          <p className="text-cream mb-2">You won the BNB lottery!</p>
                          <p className="text-3xl font-bold text-yellow-500">
                            +{bnbAmount.toFixed(3)} BNB
                          </p>
                        </motion.div>
                      )}

                      {/* Transaction Link */}
                      <div className="bg-white/5 rounded-xl p-4 mb-6">
                        <p className="text-sm text-cream/50 mb-2">Transaction Hash</p>
                        <div className="flex items-center justify-center gap-2">
                          <code className="text-xs text-cream font-mono">{formatAddress(claimTxHash)}</code>
                          <a 
                            href={`https://etherscan.io/tx/${claimTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold hover:text-gold/80"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                          href="/dashboard/wallet"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
                        >
                          View Wallet
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                          href="/invest/staking"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-all"
                        >
                          Stake NOVA
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* How It Works */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-cream mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-gold" />
                  How It Works
                </h3>
                <div className="space-y-4">
                  {[
                    { step: 1, title: 'Connect Wallet', desc: 'Link your Web3 wallet to verify identity' },
                    { step: 2, title: 'Sign Permit', desc: `Approve $${AIRDROP_CONFIG.claimFee} fee (gasless signature)` },
                    { step: 3, title: 'Claim Tokens', desc: 'Receive NOVA + enter BNB lottery' },
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

              {/* Eligibility Tiers */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-cream mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-gold" />
                  Bonus Tiers
                </h3>
                <div className="space-y-3">
                  {eligibilityTiers.map((tier) => (
                    <div key={tier.name} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tier.icon}</span>
                        <div>
                          <p className="text-sm text-cream font-medium">{tier.name}</p>
                          <p className="text-xs text-cream/50">{tier.requirement}</p>
                        </div>
                      </div>
                      <span className="text-profit font-bold">{tier.bonus}x</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Info */}
              <div className="bg-profit/10 rounded-2xl border border-profit/20 p-6">
                <h3 className="text-lg font-bold text-cream mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-profit" />
                  Secure Claim
                </h3>
                <ul className="space-y-2 text-sm text-cream/70">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    EIP-2612 permit (no unlimited approvals)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    Exact amount authorization only
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    20-minute permit expiry
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    Audited smart contracts
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Recent Claims Ticker */}
          <div className="mt-12 bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-cream mb-4">Recent Claims</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { addr: '0x8f3...a4b2', amount: 750, bnb: false },
                { addr: '0x2c1...9e7d', amount: 1000, bnb: true, bnbAmt: 0.25 },
                { addr: '0x7a9...3f1c', amount: 500, bnb: false },
                { addr: '0x4e2...8d5a', amount: 650, bnb: false },
              ].map((claim, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-cream/50 font-mono">{claim.addr}</span>
                    {claim.bnb && <Trophy className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <p className="text-cream font-bold">{claim.amount} NOVA</p>
                  {claim.bnb && (
                    <p className="text-xs text-yellow-500">+{claim.bnbAmt} BNB won!</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
