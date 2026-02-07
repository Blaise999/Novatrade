"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAccount, useDisconnect, useBalance, useEnsName } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";
import { formatEther } from "viem";
import {
  Wallet, Shield, ArrowLeft, Check, Copy, ExternalLink,
  Zap, Lock, Globe, CheckCircle,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useStore } from "@/lib/supabase/store-supabase";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectWalletClient() {
  const router = useRouter();
  const { user, updateProfile, updateRegistrationStatus, refreshUser, isAuthenticated, isLoading: authLoading } = useStore();
  const { address, isConnected, isConnecting, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: balance } = useBalance({ address });

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const alreadyConnected = !!user?.walletAddress;

  // When wagmi reports connected + we have an address, save it
  useEffect(() => {
    if (!isConnected || !address || saving || saved || redirecting) return;
    if (authLoading) return;
    if (!isAuthenticated) return;

    const saveWallet = async () => {
      setSaving(true);
      try {
        // Step 1: Save wallet address to profile
        await updateProfile({ walletAddress: address });

        // Step 2: If registration isn't complete, complete it
        if (user?.registrationStatus && user.registrationStatus !== 'complete') {
          await updateRegistrationStatus('complete');
        }

        // Step 3: Refresh user data to ensure everything is synced
        await refreshUser();

        setSaved(true);
        setSaving(false);

        // Step 4: Redirect after showing success
        setTimeout(() => {
          setRedirecting(true);
          router.replace("/dashboard");
        }, 1200);
      } catch (err) {
        console.error("Failed to save wallet:", err);
        setSaving(false);
      }
    };

    saveWallet();
  }, [isConnected, address, saving, saved, redirecting, authLoading, isAuthenticated]);

  const handleSkip = async () => {
    if (user?.registrationStatus && user.registrationStatus !== 'complete') {
      await updateRegistrationStatus("complete");
    }
    router.replace("/dashboard");
  };

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const features = [
    { icon: Shield, title: "Non-Custodial", description: "You always control your keys" },
    { icon: Lock, title: "Secure", description: "Industry-standard encryption" },
    { icon: Globe, title: "Multi-Chain", description: "Ethereum & Sepolia supported" },
    { icon: Zap, title: "Fast", description: "Instant connection & signing" },
  ];

  return (
    <div className="min-h-screen bg-void">
      <Navigation />

      <main className="pt-24 sm:pt-32 pb-20">
        <div className="max-w-lg mx-auto px-4">
          <Link
            href={isAuthenticated ? "/dashboard" : "/"}
            className="inline-flex items-center gap-2 text-cream/60 hover:text-cream mb-6 sm:mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-obsidian/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden"
          >
            <div className="p-6 sm:p-8 border-b border-white/10 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gold/20 to-electric/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-cream">
                {saved || redirecting ? "Wallet Connected!" : isConnected ? "Wallet Connected" : alreadyConnected ? "Wallet Already Connected" : "Connect Your Wallet"}
              </h1>
              <p className="text-sm text-cream/60 mt-2">
                {saved || redirecting
                  ? "Redirecting to your dashboard..."
                  : isConnected
                  ? "Saving your wallet to your account..."
                  : alreadyConnected
                  ? `Connected: ${user?.walletAddress?.slice(0, 6)}...${user?.walletAddress?.slice(-4)}`
                  : "Connect your wallet to access Web3 features"}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              {/* Already connected to this account */}
              {alreadyConnected && !isConnected && (
                <div className="space-y-6">
                  <div className="p-4 bg-profit/10 rounded-xl border border-profit/20">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-profit" />
                      <div>
                        <p className="text-sm font-semibold text-cream">Wallet Connected</p>
                        <p className="text-xs font-mono text-cream/50">{user?.walletAddress}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-cream/50 text-center">Want to change your wallet? Connect a new one below.</p>

                  <div className="flex justify-center">
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <button
                          onClick={openConnectModal}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-white/10 text-cream font-semibold text-lg rounded-xl hover:bg-white/15 transition-all"
                        >
                          <Wallet className="w-5 h-5" />
                          Connect Different Wallet
                        </button>
                      )}
                    </ConnectButton.Custom>
                  </div>

                  <Link
                    href="/dashboard"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              )}

              {isConnecting && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-cream/60">Connecting...</p>
                </div>
              )}

              {isConnected && address && (
                <div className="space-y-6">
                  {saved || redirecting ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-profit/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-profit" />
                      </div>
                      <p className="text-lg font-semibold text-cream mb-2">Wallet Saved!</p>
                      <p className="text-cream/60">Redirecting to dashboard...</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-cream/50">Connected Address</span>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${chain?.id === mainnet.id ? "bg-profit" : "bg-yellow-500"}`} />
                            <span className="text-xs text-cream/50">{chain?.name || "Unknown"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-mono text-cream flex-1">
                            {ensName || truncateAddress(address)}
                          </p>
                          <button onClick={copyAddress} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            {copied ? <Check className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4 text-cream/50" />}
                          </button>
                          <a href={`https://${chain?.id === mainnet.id ? "" : "sepolia."}etherscan.io/address/${address}`}
                            target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ExternalLink className="w-4 h-4 text-cream/50" />
                          </a>
                        </div>
                        {balance && (
                          <p className="text-2xl font-bold text-cream mt-3">
                            {parseFloat(formatEther(balance.value)).toFixed(4)} {balance.symbol}
                          </p>
                        )}
                      </div>
                      {saving && (
                        <div className="text-center">
                          <div className="w-6 h-6 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-sm text-cream/60">Saving to your account...</p>
                        </div>
                      )}
                    </>
                  )}
                  {!saved && !redirecting && (
                    <div className="flex justify-center gap-3">
                      <button onClick={() => disconnect()}
                        className="px-4 py-2 text-sm rounded-xl bg-white/5 text-cream/70 hover:bg-white/10 hover:text-cream transition-all">
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isConnected && !isConnecting && !alreadyConnected && (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <button onClick={openConnectModal}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold text-lg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all">
                          <Wallet className="w-5 h-5" />
                          Connect Wallet
                        </button>
                      )}
                    </ConnectButton.Custom>
                  </div>
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
                  <div className="pt-4 border-t border-white/10">
                    <button onClick={handleSkip}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 text-cream/70 font-medium rounded-xl hover:bg-white/10 hover:text-cream transition-all">
                      Skip for now
                    </button>
                    <p className="text-xs text-cream/40 text-center mt-2">You can connect your wallet later from settings</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <p className="text-center text-xs text-cream/40 mt-6">
            New to crypto wallets?{" "}
            <Link href="/academy" className="text-gold hover:underline">Learn how to set one up</Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
