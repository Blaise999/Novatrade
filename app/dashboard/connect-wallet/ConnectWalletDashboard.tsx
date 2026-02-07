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
  Wallet, Shield, Check, Copy, ExternalLink,
  Zap, Lock, Globe, CheckCircle, RefreshCw,
} from "lucide-react";
import { useStore } from "@/lib/supabase/store-supabase";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectWalletDashboard() {
  const router = useRouter();
  const { user, updateProfile, updateRegistrationStatus, refreshUser, isAuthenticated } = useStore();
  const { address, isConnected, isConnecting, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: balance } = useBalance({ address });

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const alreadyConnected = !!user?.walletAddress;

  // When wagmi reports connected + we have an address, save it
  useEffect(() => {
    if (!isConnected || !address || saving || saved) return;
    if (!isAuthenticated) return;

    const saveWallet = async () => {
      setSaving(true);
      try {
        await updateProfile({ walletAddress: address });
        if (user?.registrationStatus && user.registrationStatus !== 'complete') {
          await updateRegistrationStatus('complete');
        }
        await refreshUser();
        setSaved(true);
      } catch (err) {
        console.error("Failed to save wallet:", err);
      } finally {
        setSaving(false);
      }
    };

    saveWallet();
  }, [isConnected, address, saving, saved, isAuthenticated]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    disconnect();
    await updateProfile({ walletAddress: undefined });
    await refreshUser();
    setSaved(false);
  };

  const features = [
    { icon: Shield, title: "Non-Custodial", description: "You always control your keys" },
    { icon: Lock, title: "Secure", description: "Industry-standard encryption" },
    { icon: Globe, title: "Multi-Chain", description: "Ethereum & Sepolia supported" },
    { icon: Zap, title: "Fast", description: "Instant connection & signing" },
  ];

  const connectedAddress = address || user?.walletAddress;
  const showConnected = isConnected || alreadyConnected;

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-cream">Connect Wallet</h1>
        <p className="text-slate-400 mt-1">Link your Web3 wallet to access DeFi features</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 bg-obsidian/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
        >
          {/* Status Header */}
          <div className="p-6 border-b border-white/10 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              showConnected ? 'bg-profit/20' : 'bg-gradient-to-br from-gold/20 to-electric/20'
            }`}>
              {showConnected ? (
                <CheckCircle className="w-8 h-8 text-profit" />
              ) : (
                <Wallet className="w-8 h-8 text-gold" />
              )}
            </div>
            <h2 className="text-xl font-display font-bold text-cream">
              {showConnected ? "Wallet Connected" : "Connect Your Wallet"}
            </h2>
            <p className="text-sm text-cream/60 mt-2">
              {showConnected
                ? "Your wallet is linked to your NovaTrade account"
                : "Connect your wallet to access Web3 features"}
            </p>
          </div>

          <div className="p-6">
            {/* Connected State */}
            {showConnected && connectedAddress ? (
              <div className="space-y-4">
                {/* Wallet Info */}
                <div className="p-4 bg-profit/10 rounded-xl border border-profit/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-cream/50">Connected Address</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${chain?.id === mainnet.id ? "bg-profit" : isConnected ? "bg-yellow-500" : "bg-slate-500"} ${isConnected ? 'animate-pulse' : ''}`} />
                      <span className="text-xs text-cream/50">
                        {isConnected ? (chain?.name || "Connected") : "Saved (not live)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono text-cream flex-1">
                      {ensName || truncateAddress(connectedAddress)}
                    </p>
                    <button onClick={copyAddress} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      {copied ? <Check className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4 text-cream/50" />}
                    </button>
                    <a
                      href={`https://${chain?.id === mainnet.id ? "" : "sepolia."}etherscan.io/address/${connectedAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-cream/50" />
                    </a>
                  </div>

                  {balance && isConnected && (
                    <p className="text-2xl font-bold text-cream mt-3">
                      {parseFloat(formatEther(balance.value)).toFixed(4)} {balance.symbol}
                    </p>
                  )}
                </div>

                {saving && (
                  <div className="text-center py-2">
                    <div className="w-6 h-6 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-cream/60">Saving to your account...</p>
                  </div>
                )}

                {saved && (
                  <div className="flex items-center justify-center gap-2 py-2 px-4 bg-profit/10 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-profit" />
                    <span className="text-sm text-profit font-medium">Wallet saved to your account</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button
                        onClick={openConnectModal}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 text-cream/70 font-medium rounded-xl hover:bg-white/10 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Change Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                  {isConnected && (
                    <button
                      onClick={handleDisconnect}
                      className="flex-1 py-3 bg-loss/10 text-loss font-medium rounded-xl hover:bg-loss/20 transition-all"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ) : isConnecting ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
                <p className="text-cream/60">Connecting...</p>
              </div>
            ) : (
              /* Not Connected */
              <div className="space-y-4">
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

                <p className="text-xs text-cream/40 text-center">
                  Supports MetaMask, Coinbase Wallet, WalletConnect, and more
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Features sidebar */}
        <div className="lg:col-span-2 space-y-4">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/5"
            >
              <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-cream">{feature.title}</p>
                <p className="text-xs text-cream/50 mt-0.5">{feature.description}</p>
              </div>
            </motion.div>
          ))}

          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <p className="text-xs text-blue-400">
              New to crypto wallets?{" "}
              <Link href="/academy" className="text-gold hover:underline font-medium">
                Learn how to set one up →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
