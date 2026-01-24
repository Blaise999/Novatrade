'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Bell,
  Shield,
  MessageCircle,
  Save,
  CheckCircle
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';

export default function AdminSettingsPage() {
  const { admin } = useAdminAuthStore();
  const [telegramHandle, setTelegramHandle] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-cream">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your admin preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-gold" />
          <h2 className="text-lg font-semibold text-cream">Profile</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Admin Name
            </label>
            <input
              type="text"
              value={admin?.name || ''}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream opacity-60 cursor-not-allowed"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Email
            </label>
            <input
              type="email"
              value={admin?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream opacity-60 cursor-not-allowed"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Role
            </label>
            <input
              type="text"
              value={admin?.role || ''}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream opacity-60 cursor-not-allowed capitalize"
            />
          </div>
        </div>
      </div>

      {/* Telegram Integration */}
      <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <MessageCircle className="w-5 h-5 text-electric" />
          <h2 className="text-lg font-semibold text-cream">Telegram Integration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Telegram Handle
            </label>
            <input
              type="text"
              value={telegramHandle}
              onChange={(e) => setTelegramHandle(e.target.value)}
              placeholder="@yourusername"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-electric/50"
            />
            <p className="text-xs text-slate-500 mt-2">
              Your Telegram handle for community signals
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-gold" />
          <h2 className="text-lg font-semibold text-cream">Notifications</h2>
        </div>
        
        <div className="space-y-4">
          {[
            { label: 'Session reminders', description: 'Get notified before sessions start', enabled: true },
            { label: 'Signal alerts', description: 'Real-time signal notifications', enabled: true },
            { label: 'System updates', description: 'Important platform updates', enabled: false },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div>
                <p className="text-cream font-medium">{item.label}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
              <button
                className={`w-12 h-6 rounded-full transition-all ${
                  item.enabled ? 'bg-profit' : 'bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                  item.enabled ? 'ml-6' : 'ml-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 py-4 bg-loss text-white font-bold rounded-xl hover:bg-loss/90 transition-all"
      >
        {saved ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Saved!
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Changes
          </>
        )}
      </button>
    </div>
  );
}
