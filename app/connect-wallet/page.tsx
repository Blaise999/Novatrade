'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAccount, useDisconnect, useBalance, useEnsName } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';
import { formatEther } from 'viem';
import {
  Wallet,
  Shield,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
  Zap,
  Lock,
  Globe,
  Sparkles
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

// Truncate address
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectWalletPage() {
  const router = useRouter();
  const { address, isConnected, isConnecting, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: balance } = useBalance({ address });
  const [copied, setCopied] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);

  // Auto-redirect to dashboard when wallet connects (for onboarding flow)
  useEffect(() => {
    if (isConnected && address && !hasRedirected) {
      // Small delay to show success state before redirect
      const timer = setTimeout(() => {
        setHasRedirected(true);
        router.push('/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, hasRedirected, router]);

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const features = [
    { icon: Shield, title: 'Non-Custodial', description: 'You always control your keys' },
    { icon: Lock, title: 'Secure', description: 'Industry-standard encryption' },
    { icon: Globe, title: 'Multi-Chain', description: 'Ethereum & Sepolia supported' },
    { icon: Zap, title: 'Fast', description: 'Instant connection & signing' },
  ];

  return (
    <div className="min-h-screen bg-void">
      <Navigation />

      <main className="pt-24 sm:pt-32 pb-20">
        <div className="max-w-lg mx-auto px-4">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-cream/60 hover:text-cream mb-6 sm:mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>

          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-obsidian/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-white/10 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gold/20 to-electric/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-cream">
                {isConnected ? 'Wallet Connected' : 'Connect Your Wallet'}
              </h1>
              <p className="text-sm text-cream/60 mt-2">
                {isConnected 
                  ? 'Your wallet is connected and ready to use'
                  : 'Connect your wallet to access Web3 features'
                }
              </p>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8">
              {isConnecting ? (
                // Loading State
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-cream/60">Connecting...</p>
                </div>
              ) : isConnected && address ? (
                // Connected State - Redirecting
                <div className="space-y-6">
                  {hasRedirected ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-profit/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-profit" />
                      </div>
                      <p className="text-lg font-semibold text-cream mb-2">Wallet Connected!</p>
                      <p className="text-cream/60">Redirecting to dashboard...</p>
                    </div>
                  ) : (
                    <>
                      {/* Wallet Info */}
                      <div className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-cream/50">Connected Address</span>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${chain?.id === 1 ? 'bg-profit' : 'bg-yellow-500'}`} />
                            <span className="text-xs text-cream/50">{chain?.name || 'Unknown'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-mono text-cream flex-1">
                            {ensName || truncateAddress(address)}
                          </p>
                          <button
                            onClick={copyAddress}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-profit" />
                            ) : (
                              <Copy className="w-4 h-4 text-cream/50" />
                            )}
                          </button>
                          <a
                            href={`https://${chain?.id === 1 ? '' : 'sepolia.'}etherscan.io/address/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-cream/50" />
                          </a>
                        </div>
                        {balance && (
                          <p className="text-2xl font-bold text-cream mt-3">
                            {parseFloat(formatEther(balance.value)).toFixed(4)} {balance.symbol}
                          </p>
                        )}
                      </div>

                      {/* Redirecting indicator */}
                      <div className="text-center">
                        <div className="w-6 h-6 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm text-cream/60">Redirecting to dashboard...</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // Disconnected State
                <div className="space-y-6">
                  {/* Connect Button */}
                  <div className="flex justify-center">
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <button
                          onClick={openConnectModal}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold text-lg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
                        >
                          <Wallet className="w-5 h-5" />
                          Connect Wallet
                        </button>
                      )}
                    </ConnectButton.Custom>
                  </div>

                  {/* Supported Wallets */}
                  <div className="text-center">
                    <p className="text-xs text-cream/40 mb-3">Supported Wallets</p>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {['MetaMask', 'WalletConnect', 'Coinbase', 'Rainbow'].map((wallet) => (
                        <span
                          key={wallet}
                          className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-cream/60"
                        >
                          {wallet}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                    {features.map((feature) => (
                      <div key={feature.title} className="flex items-start gap-2 p-2">
                        <feature.icon className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-cream">{feature.title}</p>
                          <p className="text-[10px] text-cream/50">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Skip Option */}
                  <div className="pt-4 border-t border-white/10">
                    <Link
                      href="/dashboard"
                      className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 text-cream/70 font-medium rounded-xl hover:bg-white/10 hover:text-cream transition-all"
                    >
                      Skip for now
                    </Link>
                    <p className="text-xs text-cream/40 text-center mt-2">
                      You can connect your wallet later from settings
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Help Text */}
          <p className="text-center text-xs text-cream/40 mt-6">
            New to crypto wallets?{' '}
            <Link href="/academy" className="text-gold hover:underline">
              Learn how to set one up
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
