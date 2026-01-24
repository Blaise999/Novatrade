'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  TrendingUp,
  Wallet,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { useAuthStore, useWalletStore } from '@/lib/store';

// Simulated wallet providers (in production, use actual RainbowKit)
const walletProviders = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect using MetaMask browser extension',
    popular: true,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🔵',
    description: 'Connect using Coinbase Wallet',
    popular: true,
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    description: 'Scan QR code with any compatible wallet',
    popular: true,
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    icon: '🌈',
    description: 'Connect using Rainbow wallet',
    popular: false,
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: '🛡️',
    description: 'Connect using Trust Wallet',
    popular: false,
  },
  {
    id: 'ledger',
    name: 'Ledger',
    icon: '📟',
    description: 'Connect using Ledger hardware wallet',
    popular: false,
  },
];

const supportedNetworks = [
  { id: 1, name: 'Ethereum', symbol: 'ETH', icon: '⟠' },
  { id: 56, name: 'BNB Chain', symbol: 'BNB', icon: '🔶' },
  { id: 137, name: 'Polygon', symbol: 'MATIC', icon: '🟣' },
  { id: 42161, name: 'Arbitrum', symbol: 'ARB', icon: '🔵' },
  { id: 10, name: 'Optimism', symbol: 'OP', icon: '🔴' },
];

export default function ConnectWalletPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { setWallet, setConnecting, isConnecting, address, isConnected } = useWalletStore();
  
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [connectionStep, setConnectionStep] = useState<'select' | 'connecting' | 'connected'>('select');
  const [showAllWallets, setShowAllWallets] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  // Generate mock wallet address
  const generateMockAddress = () => {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  };

  const handleConnectWallet = async (walletId: string) => {
    setSelectedWallet(walletId);
    setConnectionStep('connecting');
    setConnecting(true);
    setError(null);

    try {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful connection
      const mockAddress = generateMockAddress();
      setWallet(mockAddress, 1); // Ethereum mainnet
      
      // Update user with wallet connection
      if (user) {
        setUser({
          ...user,
          walletConnected: true,
          walletAddress: mockAddress,
        });
      }

      setConnectionStep('connected');
    } catch (err) {
      setError('Failed to connect wallet. Please try again.');
      setConnectionStep('select');
    } finally {
      setConnecting(false);
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const popularWallets = walletProviders.filter(w => w.popular);
  const otherWallets = walletProviders.filter(w => !w.popular);
  const displayedWallets = showAllWallets ? walletProviders : popularWallets;

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-gold to-gold/60 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-void" />
            </div>
            <span className="text-xl font-display font-bold text-cream">
              NOVA<span className="text-gold">TRADE</span>
            </span>
          </Link>
          
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-400 hover:text-cream transition-colors"
          >
            Skip for now
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        {connectionStep === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-electric/20 to-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-gold" />
              </div>
              <h1 className="text-3xl font-display font-bold text-cream">Connect Wallet</h1>
              <p className="mt-2 text-slate-400">
                Connect your crypto wallet to deposit, withdraw, and trade cryptocurrencies.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-loss/10 border border-loss/20 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-loss flex-shrink-0" />
                <p className="text-sm text-loss">{error}</p>
              </motion.div>
            )}

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: 'Secure', desc: 'Non-custodial' },
                { icon: Zap, label: 'Instant', desc: 'Fast deposits' },
                { icon: Wallet, label: 'Multi-chain', desc: '5+ networks' },
              ].map((benefit, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                  <benefit.icon className="w-5 h-5 text-gold mx-auto mb-1" />
                  <p className="text-xs font-medium text-cream">{benefit.label}</p>
                  <p className="text-[10px] text-slate-500">{benefit.desc}</p>
                </div>
              ))}
            </div>

            {/* Wallet Options */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-cream">Choose a wallet</p>
              
              {displayedWallets.map((wallet) => (
                <motion.button
                  key={wallet.id}
                  onClick={() => handleConnectWallet(wallet.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <span className="text-3xl">{wallet.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-cream group-hover:text-gold transition-colors">
                      {wallet.name}
                    </p>
                    <p className="text-xs text-slate-500">{wallet.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-gold group-hover:translate-x-1 transition-all" />
                </motion.button>
              ))}

              {!showAllWallets && otherWallets.length > 0 && (
                <button
                  onClick={() => setShowAllWallets(true)}
                  className="w-full py-3 text-sm text-slate-400 hover:text-cream transition-colors"
                >
                  Show {otherWallets.length} more wallets
                </button>
              )}
            </div>

            {/* Supported Networks */}
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center">Supported networks</p>
              <div className="flex justify-center gap-2">
                {supportedNetworks.map((network) => (
                  <div
                    key={network.id}
                    className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-sm"
                    title={network.name}
                  >
                    {network.icon}
                  </div>
                ))}
              </div>
            </div>

            {/* Security Note */}
            <p className="text-center text-xs text-slate-500">
              🔒 We never have access to your private keys
            </p>
          </motion.div>
        )}

        {connectionStep === 'connecting' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-12"
          >
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-gold/20 rounded-full animate-ping" />
              <div className="relative w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <span className="text-4xl">
                  {walletProviders.find(w => w.id === selectedWallet)?.icon}
                </span>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-display font-bold text-cream">
                Connecting to {walletProviders.find(w => w.id === selectedWallet)?.name}
              </h2>
              <p className="mt-2 text-slate-400">
                Please approve the connection request in your wallet
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-gold">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Waiting for approval...</span>
            </div>

            <button
              onClick={() => {
                setConnectionStep('select');
                setConnecting(false);
              }}
              className="text-sm text-slate-400 hover:text-cream transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}

        {connectionStep === 'connected' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-24 h-24 bg-profit/20 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle className="w-12 h-12 text-profit" />
            </motion.div>

            <div>
              <h2 className="text-3xl font-display font-bold text-cream">Wallet Connected!</h2>
              <p className="mt-2 text-slate-400">
                Your {walletProviders.find(w => w.id === selectedWallet)?.name} wallet is now connected.
              </p>
            </div>

            {/* Connected Wallet Info */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Connected Address</span>
                <span className="text-sm text-profit">Ethereum Mainnet</span>
              </div>
              <div className="flex items-center justify-center gap-3 p-3 bg-void rounded-lg">
                <span className="text-lg font-mono text-cream">{formatAddress(address || '')}</span>
                <button
                  onClick={handleCopyAddress}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-profit" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <a
                  href={`https://etherscan.io/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>

            {/* What's Next */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-cream">What you can do now:</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Deposit Crypto', desc: 'Fund your account' },
                  { label: 'Trade Crypto', desc: '200+ pairs' },
                  { label: 'Copy Trading', desc: 'Follow experts' },
                  { label: 'Earn Rewards', desc: 'Staking & more' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 text-left">
                    <p className="text-sm font-medium text-cream">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => router.push('/dashboard/wallet')}
                className="w-full py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2"
              >
                Deposit Funds
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-4 bg-white/5 border border-white/10 text-cream font-semibold rounded-xl hover:bg-white/10 transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
