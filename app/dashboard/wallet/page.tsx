'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  CheckCircle,
  CreditCard,
  Bitcoin,
  Building2,
  QrCode,
  ExternalLink,
  Clock,
  Shield,
  Zap,
  ChevronRight,
  X,
  AlertCircle,
  TrendingUp,
  Bot,
  Coins,
  Gift,
  ArrowRight
} from 'lucide-react';
import { useAuthStore, useWalletStore } from '@/lib/store';

// Deposit methods
const depositMethods = [
  { 
    id: 'crypto', 
    name: 'Cryptocurrency', 
    description: 'BTC, ETH, USDT & more',
    icon: Bitcoin, 
    fee: '0%',
    time: 'Instant',
    minAmount: 10,
    color: 'from-orange-500 to-yellow-500'
  },
  { 
    id: 'card', 
    name: 'Credit/Debit Card', 
    description: 'Visa, Mastercard',
    icon: CreditCard, 
    fee: '2.5%',
    time: '1-3 min',
    minAmount: 10,
    color: 'from-blue-500 to-indigo-500'
  },
  { 
    id: 'bank', 
    name: 'Bank Transfer', 
    description: 'Wire transfer',
    icon: Building2, 
    fee: '0%',
    time: '1-3 days',
    minAmount: 100,
    color: 'from-green-500 to-emerald-500'
  },
];

// Crypto options for deposit
const cryptoOptions = [
  { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', icon: '₿', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
  { symbol: 'ETH', name: 'Ethereum', network: 'ERC-20', icon: 'Ξ', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1' },
  { symbol: 'USDT', name: 'Tether', network: 'TRC-20', icon: '₮', address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9' },
  { symbol: 'SOL', name: 'Solana', network: 'Solana', icon: '◎', address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d' },
];

// Investment plan info
const investmentPlans: Record<string, { name: string; roi: string; min: number }> = {
  'starter': { name: 'Starter Plan', roi: '5%', min: 100 },
  'growth': { name: 'Growth Plan', roi: '12%', min: 1000 },
  'premium': { name: 'Premium Plan', roi: '20%', min: 10000 },
  'elite': { name: 'Elite Plan', roi: '35%', min: 50000 },
};

// Bot info
const botInfo: Record<string, { name: string; min: number }> = {
  'grid-bot': { name: 'Grid Trading Bot', min: 100 },
  'dca-bot': { name: 'DCA Bot', min: 50 },
  'arbitrage-bot': { name: 'Arbitrage Bot', min: 500 },
  'momentum-bot': { name: 'Momentum Bot', min: 250 },
  'copy-bot': { name: 'Copy Trading Bot', min: 100 },
  'ai-bot': { name: 'AI Trading Bot', min: 1000 },
};

// Recent transactions mock
const recentTransactions = [
  { id: 1, type: 'deposit', method: 'Bitcoin', amount: 500, status: 'completed', date: '2024-01-20 14:30' },
  { id: 2, type: 'withdraw', method: 'Bank Transfer', amount: 200, status: 'pending', date: '2024-01-19 10:15' },
  { id: 3, type: 'deposit', method: 'Credit Card', amount: 100, status: 'completed', date: '2024-01-18 16:45' },
  { id: 4, type: 'deposit', method: 'Ethereum', amount: 1000, status: 'completed', date: '2024-01-17 09:20' },
  { id: 5, type: 'withdraw', method: 'Bitcoin', amount: 300, status: 'completed', date: '2024-01-15 11:00' },
];

function WalletContent() {
  const { user, updateBalance } = useAuthStore();
  const { address: walletAddress, isConnected } = useWalletStore();
  const searchParams = useSearchParams();
  
  // Get query parameters for context
  const planId = searchParams.get('plan');
  const stakeToken = searchParams.get('stake');
  const botId = searchParams.get('bot');
  
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState(cryptoOptions[0]);
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // Get context info
  const selectedPlan = planId ? investmentPlans[planId] : null;
  const selectedBot = botId ? botInfo[botId] : null;
  const hasContext = selectedPlan || stakeToken || selectedBot;

  // Set minimum amount based on context
  useEffect(() => {
    if (selectedPlan) {
      setAmount(selectedPlan.min.toString());
    } else if (selectedBot) {
      setAmount(selectedBot.min.toString());
    }
  }, [selectedPlan, selectedBot]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = () => {
    const depositAmount = parseFloat(amount);
    if (depositAmount > 0 && user) {
      // Simulate deposit
      updateBalance({
        available: user.balance.available + depositAmount
      });
      setShowSuccess(true);
      setAmount('');
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const quickAmounts = [50, 100, 250, 500, 1000];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-cream">Wallet</h1>
        <p className="text-slate-400 mt-1">Manage your funds and transactions</p>
      </div>

      {/* Context Banner - Shows when coming from investment/staking/bot pages */}
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
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cream">
                    {selectedPlan && `You selected: ${selectedPlan.name}`}
                    {stakeToken && `You want to stake: ${stakeToken}`}
                    {selectedBot && `You selected: ${selectedBot.name}`}
                  </h3>
                  <p className="text-sm text-cream/70 mt-1">
                    {selectedPlan && (
                      <>
                        Deposit at least <span className="text-gold font-bold">${selectedPlan.min.toLocaleString()}</span> to activate this plan and earn <span className="text-profit font-bold">{selectedPlan.roi} ROI</span>
                      </>
                    )}
                    {stakeToken && (
                      <>
                        Deposit funds to start staking <span className="text-gold font-bold">{stakeToken}</span> and earn rewards
                      </>
                    )}
                    {selectedBot && (
                      <>
                        Deposit at least <span className="text-gold font-bold">${selectedBot.min.toLocaleString()}</span> to activate your trading bot
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="flex items-center gap-1 text-xs text-cream/50">
                      <CheckCircle className="w-3 h-3 text-profit" />
                      Instant activation
                    </span>
                    <span className="flex items-center gap-1 text-xs text-cream/50">
                      <Shield className="w-3 h-3 text-profit" />
                      Secure & insured
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setDismissedBanner(true)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-cream/50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balance Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-gradient-to-br from-gold/20 to-gold/5 rounded-2xl border border-gold/20"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Available Balance</p>
            <Wallet className="w-5 h-5 text-gold" />
          </div>
          <p className="text-3xl font-bold text-cream">
            ${user?.balance.available.toLocaleString() || '0.00'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Ready to trade</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Bonus Balance</p>
            <Zap className="w-5 h-5 text-profit" />
          </div>
          <p className="text-3xl font-bold text-profit">
            ${user?.balance.bonus.toLocaleString() || '0.00'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Non-withdrawable</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">In Trades</p>
            <Clock className="w-5 h-5 text-electric" />
          </div>
          <p className="text-3xl font-bold text-cream">
            ${user?.balance.inTrade?.toLocaleString() || '0.00'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Active positions</p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Main Panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Deposit/Withdraw Tabs */}
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex border-b border-white/5">
              <button
                onClick={() => { setActiveTab('deposit'); setSelectedMethod(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all ${
                  activeTab === 'deposit'
                    ? 'bg-profit/10 text-profit border-b-2 border-profit'
                    : 'text-slate-400 hover:text-cream'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                Deposit
              </button>
              <button
                onClick={() => { setActiveTab('withdraw'); setSelectedMethod(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all ${
                  activeTab === 'withdraw'
                    ? 'bg-loss/10 text-loss border-b-2 border-loss'
                    : 'text-slate-400 hover:text-cream'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </button>
            </div>

            <div className="p-6">
              {/* Method Selection */}
              {!selectedMethod ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-cream/70 mb-4">
                    Select {activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} Method
                  </h3>
                  {depositMethods.map((method) => (
                    <motion.button
                      key={method.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedMethod(method.id)}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/10 transition-all text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${method.color} flex items-center justify-center`}>
                        <method.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-cream font-medium">{method.name}</h4>
                        <p className="text-sm text-slate-500">{method.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-profit">{method.fee} fee</p>
                        <p className="text-xs text-slate-500">{method.time}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </motion.button>
                  ))}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedMethod}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    {/* Back Button */}
                    <button
                      onClick={() => setSelectedMethod(null)}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-cream mb-6 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Back to methods
                    </button>

                    {/* Crypto Deposit */}
                    {selectedMethod === 'crypto' && activeTab === 'deposit' && (
                      <div className="space-y-6">
                        {/* Crypto Selector */}
                        <div>
                          <label className="block text-sm font-medium text-cream/70 mb-3">
                            Select Cryptocurrency
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {cryptoOptions.map((crypto) => (
                              <button
                                key={crypto.symbol}
                                onClick={() => setSelectedCrypto(crypto)}
                                className={`p-3 rounded-xl border text-center transition-all ${
                                  selectedCrypto.symbol === crypto.symbol
                                    ? 'bg-gold/10 border-gold/30'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                }`}
                              >
                                <span className="text-2xl block mb-1">{crypto.icon}</span>
                                <span className="text-xs text-cream font-medium">{crypto.symbol}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Deposit Address */}
                        <div>
                          <label className="block text-sm font-medium text-cream/70 mb-3">
                            Send {selectedCrypto.symbol} to this address
                          </label>
                          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-center mb-4">
                              <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center">
                                <QrCode className="w-32 h-32 text-void" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={selectedCrypto.address}
                                readOnly
                                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream text-sm font-mono"
                              />
                              <button
                                onClick={() => handleCopy(selectedCrypto.address)}
                                className="p-3 bg-gold text-void rounded-xl hover:bg-gold/90 transition-colors"
                              >
                                {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 text-center">
                              Network: <span className="text-cream">{selectedCrypto.network}</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-cream/70">
                            <p className="font-medium text-cream mb-1">Important</p>
                            <p>
                              Only send {selectedCrypto.symbol} to this address. Sending any other cryptocurrency 
                              may result in permanent loss.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Amount Input for Card/Bank */}
                    {(selectedMethod === 'card' || selectedMethod === 'bank' || activeTab === 'withdraw') && (
                      <div className="space-y-6">
                        {/* Amount Input */}
                        <div>
                          <label className="block text-sm font-medium text-cream/70 mb-3">
                            {activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} Amount
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/50 text-xl">$</span>
                            <input
                              type="number"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-cream text-2xl font-bold focus:outline-none focus:border-gold"
                            />
                          </div>
                          <div className="flex gap-2 mt-3">
                            {quickAmounts.map((quickAmount) => (
                              <button
                                key={quickAmount}
                                onClick={() => setAmount(quickAmount.toString())}
                                className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                                  amount === quickAmount.toString()
                                    ? 'bg-gold text-void'
                                    : 'bg-white/5 text-cream/50 hover:bg-white/10'
                                }`}
                              >
                                ${quickAmount}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Card Details for Card Payment */}
                        {selectedMethod === 'card' && activeTab === 'deposit' && (
                          <div className="space-y-4">
                            <input
                              type="text"
                              placeholder="Card Number"
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                placeholder="MM/YY"
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                              />
                              <input
                                type="text"
                                placeholder="CVV"
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                              />
                            </div>
                          </div>
                        )}

                        {/* Fee Summary */}
                        <div className="p-4 bg-white/5 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Amount</span>
                            <span className="text-cream">${amount || '0.00'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Fee ({selectedMethod === 'card' ? '2.5%' : '0%'})</span>
                            <span className="text-cream">
                              ${selectedMethod === 'card' ? ((parseFloat(amount) || 0) * 0.025).toFixed(2) : '0.00'}
                            </span>
                          </div>
                          <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Total</span>
                            <span className="text-lg font-bold text-gold">
                              ${selectedMethod === 'card' 
                                ? ((parseFloat(amount) || 0) * 1.025).toFixed(2)
                                : (parseFloat(amount) || 0).toFixed(2)
                              }
                            </span>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          onClick={handleDeposit}
                          disabled={!amount || parseFloat(amount) <= 0}
                          className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'deposit'
                              ? 'bg-profit hover:bg-profit/90 text-void disabled:opacity-50'
                              : 'bg-loss hover:bg-loss/90 text-white disabled:opacity-50'
                          }`}
                        >
                          {activeTab === 'deposit' ? (
                            <>
                              <ArrowDownLeft className="w-5 h-5" />
                              Deposit ${amount || '0.00'}
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-5 h-5" />
                              Withdraw ${amount || '0.00'}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Connected Wallet */}
          {isConnected && walletAddress && (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-electric to-gold rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-void" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">Connected Wallet</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(walletAddress)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-4">
            <Link 
              href="/dashboard/trade/fx"
              className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all text-center group"
            >
              <TrendingUp className="w-6 h-6 text-gold mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm text-cream font-medium">Trade FX</p>
            </Link>
            <Link 
              href="/dashboard/trade/crypto"
              className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all text-center group"
            >
              <Bitcoin className="w-6 h-6 text-gold mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm text-cream font-medium">Trade Crypto</p>
            </Link>
            <Link 
              href="/invest/plans"
              className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all text-center group"
            >
              <Gift className="w-6 h-6 text-gold mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm text-cream font-medium">Invest</p>
            </Link>
          </div>
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-cream">Recent Transactions</h2>
              <Link href="/dashboard/history" className="text-sm text-gold hover:text-gold/80 transition-colors">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    tx.type === 'deposit' ? 'bg-profit/10' : 'bg-loss/10'
                  }`}>
                    {tx.type === 'deposit' ? (
                      <ArrowDownLeft className={`w-5 h-5 ${tx.type === 'deposit' ? 'text-profit' : 'text-loss'}`} />
                    ) : (
                      <ArrowUpRight className={`w-5 h-5 ${tx.type === 'deposit' ? 'text-profit' : 'text-loss'}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-cream capitalize">{tx.type}</p>
                    <p className="text-xs text-slate-500">{tx.method}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.type === 'deposit' ? 'text-profit' : 'text-loss'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount}
                    </p>
                    <p className={`text-xs ${
                      tx.status === 'completed' ? 'text-profit' : 'text-yellow-500'
                    }`}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-4 p-4 bg-electric/5 rounded-xl border border-electric/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-electric flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-cream">Bank-Grade Security</p>
                <p className="text-xs text-slate-400 mt-1">
                  All transactions are encrypted with 256-bit SSL. Your funds are stored in cold storage with multi-signature protection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-profit/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-profit" />
              </div>
              <h3 className="text-xl font-semibold text-cream mb-2">
                {activeTab === 'deposit' ? 'Deposit Successful!' : 'Withdrawal Initiated!'}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {activeTab === 'deposit'
                  ? 'Your funds have been added to your account.'
                  : 'Your withdrawal is being processed.'}
              </p>
              
              {/* Show context-specific next step */}
              {hasContext && (
                <div className="mb-4 p-3 bg-gold/10 rounded-lg border border-gold/20">
                  <p className="text-sm text-cream/70">
                    {selectedPlan && `Your ${selectedPlan.name} is now active!`}
                    {stakeToken && `You can now stake ${stakeToken}!`}
                    {selectedBot && `Your ${selectedBot.name} is ready!`}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSuccess(false)}
                  className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors"
                >
                  Continue Trading
                </button>
                {hasContext && (
                  <Link
                    href={selectedPlan ? '/invest/plans' : stakeToken ? '/invest/staking' : '/invest/bots'}
                    className="flex-1 py-3 bg-white/10 text-cream font-semibold rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                  >
                    View Status
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={
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
    }>
      <WalletContent />
    </Suspense>
  );
}
