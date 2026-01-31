'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  CreditCard,
  Key,
  Smartphone,
  Mail,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Fingerprint,
  LogOut
} from 'lucide-react';
import { useStore } from '@/lib/store-supabase';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Palette },
];

export default function SettingsPage() {
  const { user, logout } = useStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    tradeAlerts: true,
    priceAlerts: true,
    copyTradeUpdates: true,
    promotions: false,
    newsletter: false,
    smsAlerts: false,
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    language: 'en',
    timezone: 'UTC',
    defaultAmount: 100,
    defaultDuration: 60,
    soundEffects: true,
    confirmTrades: true,
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-cream">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="flex lg:flex-col gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gold/10 text-gold'
                    : 'text-slate-400 hover:bg-white/5 hover:text-cream'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Profile Picture */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Profile Picture</h2>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-electric to-gold rounded-2xl flex items-center justify-center text-void text-2xl font-bold">
                    {user?.firstName?.[0] || user?.email[0].toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    <button className="px-4 py-2 bg-gold text-void text-sm font-medium rounded-lg hover:bg-gold/90 transition-colors">
                      Upload Photo
                    </button>
                    <p className="text-xs text-slate-500">JPG, PNG or GIF. Max 2MB</p>
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Personal Information</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">First Name</label>
                    <input
                      type="text"
                      defaultValue={user?.firstName || ''}
                      placeholder="Enter first name"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Last Name</label>
                    <input
                      type="text"
                      defaultValue={user?.lastName || ''}
                      placeholder="Enter last name"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Phone</label>
                    <input
                      type="tel"
                      defaultValue={user?.phone || ''}
                      placeholder="Enter phone number"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
                <button className="mt-4 px-6 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors">
                  Save Changes
                </button>
              </div>

              {/* KYC Status */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-cream">Verification Status</h2>
                    <p className="text-sm text-slate-400 mt-1">Complete KYC to unlock all features</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    user?.kycStatus === 'approved' ? 'bg-profit/10 text-profit' :
                    user?.kycStatus === 'pending' || user?.kycStatus === 'in_review' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {user?.kycStatus === 'approved' ? 'Verified' :
                     user?.kycStatus === 'pending' || user?.kycStatus === 'in_review' ? 'In Review' :
                     'Not Verified'}
                  </span>
                </div>
                {user?.kycStatus !== 'approved' && (
                  <a
                    href="/kyc"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-electric/10 text-electric text-sm font-medium rounded-lg hover:bg-electric/20 transition-colors"
                  >
                    Complete Verification
                    <ChevronRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Change Password */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Change Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter current password"
                        className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-600 focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
                <button className="mt-4 px-6 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-colors">
                  Update Password
                </button>
              </div>

              {/* Two-Factor Auth */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-electric" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-cream">Two-Factor Authentication</h2>
                      <p className="text-sm text-slate-400">Add an extra layer of security</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      twoFactorEnabled ? 'bg-profit' : 'bg-white/10'
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      twoFactorEnabled ? 'left-8' : 'left-1'
                    }`} />
                  </button>
                </div>
                {twoFactorEnabled && (
                  <div className="p-4 bg-profit/10 rounded-xl border border-profit/20">
                    <div className="flex items-center gap-2 text-profit text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Two-factor authentication is enabled
                    </div>
                  </div>
                )}
              </div>

              {/* Active Sessions */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Active Sessions</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-profit/10 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-profit" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-cream">Chrome on Windows</p>
                        <p className="text-xs text-slate-500">Current session</p>
                      </div>
                    </div>
                    <span className="text-xs text-profit">Active now</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-cream">Safari on iPhone</p>
                        <p className="text-xs text-slate-500">Last active 2 hours ago</p>
                      </div>
                    </div>
                    <button className="text-xs text-loss hover:text-loss/80 transition-colors">
                      Revoke
                    </button>
                  </div>
                </div>
                <button className="mt-4 text-sm text-loss hover:text-loss/80 transition-colors">
                  Sign out all other sessions
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Email Notifications</h2>
                <div className="space-y-4">
                  {[
                    { key: 'tradeAlerts', label: 'Trade Alerts', desc: 'Get notified when trades are executed' },
                    { key: 'priceAlerts', label: 'Price Alerts', desc: 'Receive alerts when prices hit your targets' },
                    { key: 'copyTradeUpdates', label: 'Copy Trading Updates', desc: 'Updates from traders you follow' },
                    { key: 'promotions', label: 'Promotions', desc: 'Special offers and bonuses' },
                    { key: 'newsletter', label: 'Newsletter', desc: 'Weekly market updates and analysis' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-cream">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({
                          ...notifications,
                          [item.key]: !notifications[item.key as keyof typeof notifications]
                        })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          notifications[item.key as keyof typeof notifications] ? 'bg-profit' : 'bg-white/10'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notifications[item.key as keyof typeof notifications] ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">SMS Notifications</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-cream">SMS Alerts</p>
                    <p className="text-xs text-slate-500">Receive critical alerts via SMS</p>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, smsAlerts: !notifications.smsAlerts })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      notifications.smsAlerts ? 'bg-profit' : 'bg-white/10'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      notifications.smsAlerts ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'preferences' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Trading Preferences */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Trading Preferences</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Default Trade Amount</label>
                    <select
                      value={preferences.defaultAmount}
                      onChange={(e) => setPreferences({ ...preferences, defaultAmount: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                    >
                      <option value="10">$10</option>
                      <option value="25">$25</option>
                      <option value="50">$50</option>
                      <option value="100">$100</option>
                      <option value="250">$250</option>
                      <option value="500">$500</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Default Duration</label>
                    <select
                      value={preferences.defaultDuration}
                      onChange={(e) => setPreferences({ ...preferences, defaultDuration: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                    >
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="120">2 minutes</option>
                      <option value="300">5 minutes</option>
                      <option value="900">15 minutes</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-cream">Sound Effects</p>
                      <p className="text-xs text-slate-500">Play sounds on trade execution</p>
                    </div>
                    <button
                      onClick={() => setPreferences({ ...preferences, soundEffects: !preferences.soundEffects })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        preferences.soundEffects ? 'bg-profit' : 'bg-white/10'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        preferences.soundEffects ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-cream">Confirm Trades</p>
                      <p className="text-xs text-slate-500">Show confirmation before executing</p>
                    </div>
                    <button
                      onClick={() => setPreferences({ ...preferences, confirmTrades: !preferences.confirmTrades })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        preferences.confirmTrades ? 'bg-profit' : 'bg-white/10'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        preferences.confirmTrades ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Display Preferences */}
              <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-cream mb-4">Display</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Language</label>
                    <select
                      value={preferences.language}
                      onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="pt">Português</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Timezone</label>
                    <select
                      value={preferences.timezone}
                      onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                    >
                      <option value="UTC">UTC</option>
                      <option value="EST">Eastern Time (EST)</option>
                      <option value="PST">Pacific Time (PST)</option>
                      <option value="GMT">GMT</option>
                      <option value="CET">Central European Time</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-loss/5 rounded-2xl border border-loss/20 p-6">
                <h2 className="text-lg font-semibold text-loss mb-2">Danger Zone</h2>
                <p className="text-sm text-slate-400 mb-4">
                  These actions are irreversible. Please proceed with caution.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-white/5 text-cream text-sm font-medium rounded-lg hover:bg-white/10 transition-colors">
                    Download Data
                  </button>
                  <button className="px-4 py-2 bg-loss/10 text-loss text-sm font-medium rounded-lg hover:bg-loss/20 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
