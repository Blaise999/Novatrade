'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Bitcoin,
  Building2,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  Save,
  X,
  Settings,
  Users,
  DollarSign,
  Copy,
  Mail,
  MessageCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Image
} from 'lucide-react';
import { useDepositSettingsStore, CryptoWallet, BankAccount, PaymentProcessor, PendingDeposit } from '@/lib/deposit-settings';
import { useMembershipStore } from '@/lib/membership-tiers';
import { useAuthStore } from '@/lib/store';

type ActiveTab = 'pending' | 'crypto' | 'bank' | 'processors' | 'settings';

export default function AdminDepositsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
  const [editingCrypto, setEditingCrypto] = useState<CryptoWallet | null>(null);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null);
  const [showAddModal, setShowAddModal] = useState<'crypto' | 'bank' | 'processor' | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<PendingDeposit | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  
  const {
    cryptoWallets,
    bankAccounts,
    paymentProcessors,
    pendingDeposits,
    confirmedDeposits,
    globalMinDeposit,
    depositInstructions,
    supportEmail,
    supportWhatsApp,
    requireProof,
    addCryptoWallet,
    updateCryptoWallet,
    removeCryptoWallet,
    toggleCryptoWallet,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
    toggleBankAccount,
    addPaymentProcessor,
    updatePaymentProcessor,
    removePaymentProcessor,
    togglePaymentProcessor,
    confirmDeposit,
    rejectDeposit,
    updateGlobalSettings,
    getPendingDeposits,
  } = useDepositSettingsStore();

  const { adminAddBalance } = useMembershipStore();

  // Form states for adding new items
  const [newCrypto, setNewCrypto] = useState<Partial<CryptoWallet>>({
    symbol: '', name: '', network: '', address: '', icon: '₿', enabled: true, minDeposit: 50, confirmations: 6
  });
  const [newBank, setNewBank] = useState<Partial<BankAccount>>({
    bankName: '', accountName: '', accountNumber: '', country: '', currency: 'USD', enabled: true, minDeposit: 100
  });
  const [newProcessor, setNewProcessor] = useState<Partial<PaymentProcessor>>({
    name: '', type: 'ewallet', accountId: '', accountName: '', enabled: true, minDeposit: 50, fee: '0%', icon: '💳'
  });

  // Settings form
  const [settings, setSettings] = useState({
    globalMinDeposit,
    depositInstructions,
    supportEmail,
    supportWhatsApp: supportWhatsApp || '',
    requireProof
  });

  const pending = getPendingDeposits();

  const handleConfirmDeposit = (deposit: PendingDeposit) => {
    // Confirm the deposit
    const confirmed = confirmDeposit(deposit.id, 'admin');
    if (confirmed) {
      // Add balance to user's account
      adminAddBalance(deposit.amount, 'admin', `Deposit confirmed: ${deposit.methodName}`);
      setSelectedDeposit(null);
    }
  };

  const handleRejectDeposit = (deposit: PendingDeposit) => {
    rejectDeposit(deposit.id, 'admin', rejectNote);
    setSelectedDeposit(null);
    setRejectNote('');
  };

  const handleSaveCrypto = () => {
    if (editingCrypto) {
      updateCryptoWallet(editingCrypto.id, editingCrypto);
      setEditingCrypto(null);
    } else if (newCrypto.symbol && newCrypto.address) {
      addCryptoWallet(newCrypto as Omit<CryptoWallet, 'id'>);
      setNewCrypto({ symbol: '', name: '', network: '', address: '', icon: '₿', enabled: true, minDeposit: 50, confirmations: 6 });
      setShowAddModal(null);
    }
  };

  const handleSaveBank = () => {
    if (editingBank) {
      updateBankAccount(editingBank.id, editingBank);
      setEditingBank(null);
    } else if (newBank.bankName && newBank.accountNumber) {
      addBankAccount(newBank as Omit<BankAccount, 'id'>);
      setNewBank({ bankName: '', accountName: '', accountNumber: '', country: '', currency: 'USD', enabled: true, minDeposit: 100 });
      setShowAddModal(null);
    }
  };

  const handleSaveProcessor = () => {
    if (editingProcessor) {
      updatePaymentProcessor(editingProcessor.id, editingProcessor);
      setEditingProcessor(null);
    } else if (newProcessor.name && newProcessor.accountId) {
      addPaymentProcessor(newProcessor as Omit<PaymentProcessor, 'id'>);
      setNewProcessor({ name: '', type: 'ewallet', accountId: '', accountName: '', enabled: true, minDeposit: 50, fee: '0%', icon: '💳' });
      setShowAddModal(null);
    }
  };

  const handleSaveSettings = () => {
    updateGlobalSettings(settings);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cream">Deposit Management</h1>
        <p className="text-slate-400 mt-1">Configure payment methods and process deposits</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-cream">{pending.length}</p>
              <p className="text-sm text-yellow-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-profit/10 rounded-xl p-4 border border-profit/20">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-profit" />
            <div>
              <p className="text-2xl font-bold text-cream">{confirmedDeposits.filter(d => d.status === 'confirmed').length}</p>
              <p className="text-sm text-profit">Confirmed</p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <Bitcoin className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-cream">{cryptoWallets.filter(w => w.enabled).length}</p>
              <p className="text-sm text-cream/60">Active Crypto</p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-cream">{bankAccounts.filter(b => b.enabled).length + paymentProcessors.filter(p => p.enabled).length}</p>
              <p className="text-sm text-cream/60">Other Methods</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'pending', label: 'Pending Deposits', icon: Clock, badge: pending.length },
          { id: 'crypto', label: 'Crypto Wallets', icon: Bitcoin },
          { id: 'bank', label: 'Bank Accounts', icon: Building2 },
          { id: 'processors', label: 'Other Methods', icon: CreditCard },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-gold text-void' : 'bg-white/5 text-cream/60 hover:text-cream hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-2 py-0.5 bg-loss text-white text-xs rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
        {/* Pending Deposits */}
        {activeTab === 'pending' && (
          <div>
            <h2 className="text-lg font-semibold text-cream mb-4">Pending Deposit Requests</h2>
            {pending.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-profit/20 mx-auto mb-4" />
                <p className="text-cream/60">No pending deposits</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pending.map((deposit) => (
                  <div key={deposit.id} className="p-4 bg-void/50 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-cream">${deposit.amount.toLocaleString()}</p>
                          <p className="text-xs text-cream/50">{deposit.userEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-cream">{deposit.methodName}</p>
                        <p className="text-xs text-cream/50">{new Date(deposit.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {deposit.transactionRef && (
                      <div className="mb-3 p-2 bg-white/5 rounded-lg">
                        <p className="text-xs text-cream/50 mb-1">Transaction Reference</p>
                        <p className="text-sm text-cream font-mono break-all">{deposit.transactionRef}</p>
                      </div>
                    )}
                    
                    {deposit.proofImage && (
                      <div className="mb-3">
                        <p className="text-xs text-cream/50 mb-1">Payment Proof</p>
                        <img src={deposit.proofImage} alt="Proof" className="w-full max-w-md h-40 object-cover rounded-lg" />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmDeposit(deposit)}
                        className="flex-1 py-2 bg-profit text-void font-medium rounded-lg hover:bg-profit/90 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm
                      </button>
                      <button
                        onClick={() => setSelectedDeposit(deposit)}
                        className="flex-1 py-2 bg-loss/20 text-loss font-medium rounded-lg hover:bg-loss/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Crypto Wallets */}
        {activeTab === 'crypto' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-cream">Cryptocurrency Wallets</h2>
              <button
                onClick={() => setShowAddModal('crypto')}
                className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-medium rounded-lg hover:bg-gold/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Wallet
              </button>
            </div>

            <div className="space-y-3">
              {cryptoWallets.map((wallet) => (
                <div key={wallet.id} className={`p-4 rounded-xl border ${wallet.enabled ? 'bg-void/50 border-white/10' : 'bg-void/20 border-white/5 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center text-lg">
                        {wallet.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-cream">{wallet.name}</p>
                          <span className="text-xs px-2 py-0.5 bg-white/10 rounded">{wallet.symbol}</span>
                        </div>
                        <p className="text-xs text-cream/50">{wallet.network} • Min: ${wallet.minDeposit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCryptoWallet(wallet.id)}
                        className={`p-2 rounded-lg transition-colors ${wallet.enabled ? 'bg-profit/20 text-profit' : 'bg-white/5 text-cream/40'}`}
                      >
                        {wallet.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingCrypto(wallet)}
                        className="p-2 bg-white/5 rounded-lg text-cream/60 hover:text-cream transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeCryptoWallet(wallet.id)}
                        className="p-2 bg-loss/10 rounded-lg text-loss hover:bg-loss/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-cream/50 font-mono break-all">{wallet.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bank Accounts */}
        {activeTab === 'bank' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-cream">Bank Accounts</h2>
              <button
                onClick={() => setShowAddModal('bank')}
                className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-medium rounded-lg hover:bg-gold/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Bank
              </button>
            </div>

            <div className="space-y-3">
              {bankAccounts.map((bank) => (
                <div key={bank.id} className={`p-4 rounded-xl border ${bank.enabled ? 'bg-void/50 border-white/10' : 'bg-void/20 border-white/5 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-cream">{bank.bankName}</p>
                        <p className="text-xs text-cream/50">{bank.country} • {bank.currency} • Min: ${bank.minDeposit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBankAccount(bank.id)}
                        className={`p-2 rounded-lg transition-colors ${bank.enabled ? 'bg-profit/20 text-profit' : 'bg-white/5 text-cream/40'}`}
                      >
                        {bank.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingBank(bank)}
                        className="p-2 bg-white/5 rounded-lg text-cream/60 hover:text-cream transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeBankAccount(bank.id)}
                        className="p-2 bg-loss/10 rounded-lg text-loss hover:bg-loss/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-white/5 rounded-lg">
                      <p className="text-xs text-cream/50">Account Name</p>
                      <p className="text-cream">{bank.accountName}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded-lg">
                      <p className="text-xs text-cream/50">Account Number</p>
                      <p className="text-cream font-mono">{bank.accountNumber}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Processors */}
        {activeTab === 'processors' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-cream">Payment Processors</h2>
              <button
                onClick={() => setShowAddModal('processor')}
                className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-medium rounded-lg hover:bg-gold/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Method
              </button>
            </div>

            <div className="space-y-3">
              {paymentProcessors.map((processor) => (
                <div key={processor.id} className={`p-4 rounded-xl border ${processor.enabled ? 'bg-void/50 border-white/10' : 'bg-void/20 border-white/5 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-lg">
                        {processor.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-cream">{processor.name}</p>
                        <p className="text-xs text-cream/50">Fee: {processor.fee} • Min: ${processor.minDeposit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePaymentProcessor(processor.id)}
                        className={`p-2 rounded-lg transition-colors ${processor.enabled ? 'bg-profit/20 text-profit' : 'bg-white/5 text-cream/40'}`}
                      >
                        {processor.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingProcessor(processor)}
                        className="p-2 bg-white/5 rounded-lg text-cream/60 hover:text-cream transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removePaymentProcessor(processor.id)}
                        className="p-2 bg-loss/10 rounded-lg text-loss hover:bg-loss/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-cream/50">Account: {processor.accountId}</p>
                    <p className="text-xs text-cream/50">Name: {processor.accountName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-lg font-semibold text-cream mb-4">Deposit Settings</h2>
            
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="text-sm text-cream/60 mb-2 block">Global Minimum Deposit ($)</label>
                <input
                  type="number"
                  value={settings.globalMinDeposit}
                  onChange={(e) => setSettings({ ...settings, globalMinDeposit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-cream/60 mb-2 block">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-cream/60 mb-2 block">Support WhatsApp</label>
                <input
                  type="text"
                  value={settings.supportWhatsApp}
                  onChange={(e) => setSettings({ ...settings, supportWhatsApp: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-cream/60 mb-2 block">Deposit Instructions</label>
                <textarea
                  value={settings.depositInstructions}
                  onChange={(e) => setSettings({ ...settings, depositInstructions: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream focus:border-gold focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-void/50 rounded-xl">
                <div>
                  <p className="text-cream font-medium">Require Payment Proof</p>
                  <p className="text-sm text-cream/50">Users must upload a screenshot</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, requireProof: !settings.requireProof })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.requireProof ? 'bg-profit' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.requireProof ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <button
                onClick={handleSaveSettings}
                className="w-full py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> Save Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Crypto Modal */}
      <AnimatePresence>
        {showAddModal === 'crypto' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-semibold text-cream mb-4">Add Crypto Wallet</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Symbol</label>
                    <input
                      type="text"
                      value={newCrypto.symbol}
                      onChange={(e) => setNewCrypto({ ...newCrypto, symbol: e.target.value.toUpperCase() })}
                      placeholder="BTC"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Icon</label>
                    <input
                      type="text"
                      value={newCrypto.icon}
                      onChange={(e) => setNewCrypto({ ...newCrypto, icon: e.target.value })}
                      placeholder="₿"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Name</label>
                  <input
                    type="text"
                    value={newCrypto.name}
                    onChange={(e) => setNewCrypto({ ...newCrypto, name: e.target.value })}
                    placeholder="Bitcoin"
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Network</label>
                  <input
                    type="text"
                    value={newCrypto.network}
                    onChange={(e) => setNewCrypto({ ...newCrypto, network: e.target.value })}
                    placeholder="Bitcoin / ERC-20 / TRC-20"
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Wallet Address</label>
                  <input
                    type="text"
                    value={newCrypto.address}
                    onChange={(e) => setNewCrypto({ ...newCrypto, address: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream font-mono focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Minimum Deposit ($)</label>
                  <input
                    type="number"
                    value={newCrypto.minDeposit}
                    onChange={(e) => setNewCrypto({ ...newCrypto, minDeposit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 py-2 bg-white/10 text-cream font-medium rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCrypto}
                  className="flex-1 py-2 bg-gold text-void font-medium rounded-lg hover:bg-gold/90 transition-colors"
                >
                  Add Wallet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Bank Modal */}
      <AnimatePresence>
        {showAddModal === 'bank' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-semibold text-cream mb-4">Add Bank Account</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Bank Name</label>
                  <input
                    type="text"
                    value={newBank.bankName}
                    onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                    placeholder="First National Bank"
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Account Name</label>
                  <input
                    type="text"
                    value={newBank.accountName}
                    onChange={(e) => setNewBank({ ...newBank, accountName: e.target.value })}
                    placeholder="Nova Trade Ltd"
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Account Number</label>
                  <input
                    type="text"
                    value={newBank.accountNumber}
                    onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream font-mono focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Country</label>
                    <input
                      type="text"
                      value={newBank.country}
                      onChange={(e) => setNewBank({ ...newBank, country: e.target.value })}
                      placeholder="United States"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Currency</label>
                    <input
                      type="text"
                      value={newBank.currency}
                      onChange={(e) => setNewBank({ ...newBank, currency: e.target.value.toUpperCase() })}
                      placeholder="USD"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Routing Number (Optional)</label>
                  <input
                    type="text"
                    value={newBank.routingNumber || ''}
                    onChange={(e) => setNewBank({ ...newBank, routingNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream font-mono focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">SWIFT Code (Optional)</label>
                  <input
                    type="text"
                    value={newBank.swiftCode || ''}
                    onChange={(e) => setNewBank({ ...newBank, swiftCode: e.target.value })}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream font-mono focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Instructions (Optional)</label>
                  <textarea
                    value={newBank.instructions || ''}
                    onChange={(e) => setNewBank({ ...newBank, instructions: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Minimum Deposit ($)</label>
                  <input
                    type="number"
                    value={newBank.minDeposit}
                    onChange={(e) => setNewBank({ ...newBank, minDeposit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 py-2 bg-white/10 text-cream font-medium rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBank}
                  className="flex-1 py-2 bg-gold text-void font-medium rounded-lg hover:bg-gold/90 transition-colors"
                >
                  Add Bank
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Processor Modal */}
      <AnimatePresence>
        {showAddModal === 'processor' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-semibold text-cream mb-4">Add Payment Method</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Name</label>
                    <input
                      type="text"
                      value={newProcessor.name}
                      onChange={(e) => setNewProcessor({ ...newProcessor, name: e.target.value })}
                      placeholder="PayPal"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Icon (Emoji)</label>
                    <input
                      type="text"
                      value={newProcessor.icon}
                      onChange={(e) => setNewProcessor({ ...newProcessor, icon: e.target.value })}
                      placeholder="💳"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Account ID (Email/Phone/Tag)</label>
                  <input
                    type="text"
                    value={newProcessor.accountId}
                    onChange={(e) => setNewProcessor({ ...newProcessor, accountId: e.target.value })}
                    placeholder="payments@example.com"
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Account Name</label>
                  <input
                    type="text"
                    value={newProcessor.accountName}
                    onChange={(e) => setNewProcessor({ ...newProcessor, accountName: e.target.value })}
                    placeholder="Nova Trade Ltd"
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Fee</label>
                    <input
                      type="text"
                      value={newProcessor.fee}
                      onChange={(e) => setNewProcessor({ ...newProcessor, fee: e.target.value })}
                      placeholder="0%"
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-cream/60 mb-1 block">Min Deposit ($)</label>
                    <input
                      type="number"
                      value={newProcessor.minDeposit}
                      onChange={(e) => setNewProcessor({ ...newProcessor, minDeposit: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-cream/60 mb-1 block">Instructions (Optional)</label>
                  <textarea
                    value={newProcessor.instructions || ''}
                    onChange={(e) => setNewProcessor({ ...newProcessor, instructions: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 py-2 bg-white/10 text-cream font-medium rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProcessor}
                  className="flex-1 py-2 bg-gold text-void font-medium rounded-lg hover:bg-gold/90 transition-colors"
                >
                  Add Method
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Deposit Modal */}
      <AnimatePresence>
        {selectedDeposit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedDeposit(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-charcoal rounded-2xl border border-white/10 p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-semibold text-cream mb-4">Reject Deposit</h3>
              <p className="text-cream/70 mb-4">
                Are you sure you want to reject this ${selectedDeposit.amount} deposit from {selectedDeposit.userEmail}?
              </p>
              <div className="mb-4">
                <label className="text-sm text-cream/60 mb-2 block">Reason (Optional)</label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Invalid payment proof, incorrect amount, etc."
                  rows={3}
                  className="w-full px-3 py-2 bg-void/50 border border-white/10 rounded-lg text-cream focus:border-gold focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedDeposit(null); setRejectNote(''); }}
                  className="flex-1 py-2 bg-white/10 text-cream font-medium rounded-lg hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRejectDeposit(selectedDeposit)}
                  className="flex-1 py-2 bg-loss text-white font-medium rounded-lg hover:bg-loss/90 transition-colors"
                >
                  Reject Deposit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
