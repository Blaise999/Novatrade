'use client';

import { useState } from 'react';
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
  AlertCircle
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

// Recent transactions mock
const recentTransactions = [
  { id: 1, type: 'deposit', method: 'Bitcoin', amount: 500, status: 'completed', date: '2024-01-20 14:30' },
  { id: 2, type: 'withdraw', method: 'Bank Transfer', amount: 200, status: 'pending', date: '2024-01-19 10:15' },
  { id: 3, type: 'deposit', method: 'Credit Card', amount: 100, status: 'completed', date: '2024-01-18 16:45' },
  { id: 4, type: 'deposit', method: 'Ethereum', amount: 1000, status: 'completed', date: '2024-01-17 09:20' },
  { id: 5, type: 'withdraw', method: 'Bitcoin', amount: 300, status: 'completed', date: '2024-01-15 11:00' },
];

export default function WalletPage() {
  const { user, updateBalance } = useAuthStore();
  const { address: walletAddress, isConnected } = useWalletStore();
  
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState(cryptoOptions[0]);
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

            <div className="p-5">
              <AnimatePresence mode="wait">
                {!selectedMethod ? (
                  <motion.div
                    key="methods"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-slate-400 mb-4">
                      Select {activeTab} method
                    </p>
                    {depositMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/10 transition-all group"
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${method.color} flex items-center justify-center`}>
                          <method.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-cream">{method.name}</p>
                          <p className="text-xs text-slate-500">{method.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Fee: {method.fee}</p>
                          <p className="text-xs text-profit">{method.time}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-gold group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </motion.div>
                ) : selectedMethod === 'crypto' ? (
                  <motion.div
                    key="crypto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <button
                      onClick={() => setSelectedMethod(null)}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-cream transition-colors"
                    >
                      ← Back to methods
                    </button>

                    {/* Crypto Selection */}
                    <div className="grid grid-cols-4 gap-2">
                      {cryptoOptions.map((crypto) => (
                        <button
                          key={crypto.symbol}
                          onClick={() => setSelectedCrypto(crypto)}
                          className={`p-3 rounded-xl border transition-all ${
                            selectedCrypto.symbol === crypto.symbol
                              ? 'bg-gold/10 border-gold text-gold'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                          }`}
                        >
                          <span className="text-xl">{crypto.icon}</span>
                          <p className="text-xs mt-1">{crypto.symbol}</p>
                        </button>
                      ))}
                    </div>

                    {/* Deposit Address */}
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-slate-400">
                          {selectedCrypto.name} Deposit Address
                        </p>
                        <span className="text-xs px-2 py-1 bg-profit/10 text-profit rounded-full">
                          {selectedCrypto.network}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 p-3 bg-void rounded-lg">
                        <code className="flex-1 text-sm text-cream font-mono break-all">
                          {selectedCrypto.address}
                        </code>
                        <button
                          onClick={() => handleCopy(selectedCrypto.address)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {copied ? (
                            <CheckCircle className="w-4 h-4 text-profit" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>

                      {/* QR Code Placeholder */}
                      <div className="mt-4 flex justify-center">
                        <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center">
                          <QrCode className="w-24 h-24 text-void" />
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-yellow-200">
                            <p className="font-medium">Important:</p>
                            <p className="text-yellow-200/80 mt-1">
                              Only send {selectedCrypto.symbol} to this address. Sending other assets may result in permanent loss.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="card-bank"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <button
                      onClick={() => setSelectedMethod(null)}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-cream transition-colors"
                    >
                      ← Back to methods
                    </button>

                    {/* Amount Input */}
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">
                        {activeTab === 'deposit' ? 'Deposit' : 'Withdraw'} Amount (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-xl font-semibold text-cream focus:outline-none focus:border-gold"
                        />
                      </div>
                    </div>

                    {/* Quick Amounts */}
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setAmount(amt.toString())}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            amount === amt.toString()
                              ? 'bg-gold text-void'
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>

                    {/* Card Details (for card method) */}
                    {selectedMethod === 'card' && activeTab === 'deposit' && (
                      <div className="space-y-3">
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
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-cream">Recent Transactions</h2>
              <button className="text-sm text-gold hover:text-gold/80 transition-colors">
                View All
              </button>
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
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors"
              >
                Continue Trading
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
