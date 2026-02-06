'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Plus, Copy, Download, Check, X, Search, Filter,
  Clock, CheckCircle, XCircle, Shield, Bot, Grid3X3,
  Image as ImageIcon, Loader2, RefreshCw, AlertTriangle, Trash2,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';

interface ActivationKey {
  id: string;
  activation_key: string;
  bot_type: 'dca' | 'grid';
  status: 'unused' | 'active' | 'revoked';
  user_id?: string;
  user_email?: string;
  generated_by?: string;
  activated_at?: string;
  revoked_at?: string;
  notes?: string;
  created_at: string;
}

interface KeyStats {
  total: number;
  unused: number;
  active: number;
  revoked: number;
}

export default function AdminBotKeysPage() {
  const { admin } = useAdminAuthStore();
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [stats, setStats] = useState<KeyStats>({ total: 0, unused: 0, active: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unused' | 'active' | 'revoked'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dca' | 'grid'>('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showImage, setShowImage] = useState<{ key: string; botType: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch keys
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bots/keys?action=list');
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys);
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch keys:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  // Generate key
  const handleGenerate = async (botType: 'dca' | 'grid') => {
    setGenerating(true);
    try {
      const res = await fetch('/api/bots/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          botType,
          adminId: admin?.email || 'admin',
        }),
      });
      const data = await res.json();
      if (data.success && data.keys.length > 0) {
        const newKey = data.keys[0];
        setKeys(prev => [newKey, ...prev]);
        setStats(prev => ({ ...prev, total: prev.total + 1, unused: prev.unused + 1 }));
        setShowImage({ key: newKey.activation_key, botType });
        notify('success', `${botType.toUpperCase()} key generated: ${newKey.activation_key}`);
      } else {
        notify('error', data.error || 'Failed to generate key');
      }
    } catch {
      notify('error', 'Network error');
    }
    setGenerating(false);
  };

  // Revoke key
  const handleRevoke = async (keyId: string) => {
    if (!confirm('Revoke this key? This will also disable the user\'s bot access.')) return;
    try {
      const res = await fetch('/api/bots/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, action: 'revoke' }),
      });
      const data = await res.json();
      if (data.success) {
        setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'revoked' as const } : k));
        notify('success', 'Key revoked');
      }
    } catch {
      notify('error', 'Failed to revoke');
    }
  };

  // Copy key
  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered keys
  const filteredKeys = keys.filter(k => {
    if (filter !== 'all' && k.status !== filter) return false;
    if (typeFilter !== 'all' && k.bot_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return k.activation_key.toLowerCase().includes(q) || (k.user_email || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 ${notification.type === 'success' ? 'bg-profit/20 border border-profit/30' : 'bg-loss/20 border border-loss/30'}`}>
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-profit" /> : <AlertTriangle className="w-5 h-5 text-loss" />}
            <span className={notification.type === 'success' ? 'text-profit' : 'text-loss'}>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream flex items-center gap-3">
            <Key className="w-6 h-6 text-gold" /> Bot Activation Keys
          </h1>
          <p className="text-sm text-cream/50 mt-1">Generate, manage, and track activation keys for DCA & Grid bots</p>
        </div>
        <button onClick={fetchKeys} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Refresh">
          <RefreshCw className={`w-5 h-5 text-cream/50 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Keys', value: stats.total, icon: Key, color: 'electric', gradient: 'from-electric/20 to-electric/5', border: 'border-electric/20' },
          { label: 'Unused', value: stats.unused, icon: Clock, color: 'gold', gradient: 'from-gold/20 to-gold/5', border: 'border-gold/20' },
          { label: 'Active', value: stats.active, icon: CheckCircle, color: 'profit', gradient: 'from-profit/20 to-profit/5', border: 'border-profit/20' },
          { label: 'Revoked', value: stats.revoked, icon: XCircle, color: 'loss', gradient: 'from-loss/20 to-loss/5', border: 'border-loss/20' },
        ].map((s, i) => (
          <div key={i} className={`bg-gradient-to-br ${s.gradient} rounded-xl border ${s.border} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 text-${s.color}`} />
              <span className="text-xs text-cream/50">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-cream">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Generate buttons */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => handleGenerate('dca')}
          disabled={generating}
          className="flex items-center justify-center gap-3 p-5 bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 rounded-xl hover:border-purple-400/40 transition-all disabled:opacity-50 group"
        >
          {generating ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin" /> : <Bot className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />}
          <div className="text-left">
            <p className="font-bold text-cream">Generate DCA Key</p>
            <p className="text-xs text-cream/50">DCA Master bot activation</p>
          </div>
          <Plus className="w-5 h-5 text-purple-400 ml-auto" />
        </button>

        <button
          onClick={() => handleGenerate('grid')}
          disabled={generating}
          className="flex items-center justify-center gap-3 p-5 bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/20 rounded-xl hover:border-orange-400/40 transition-all disabled:opacity-50 group"
        >
          {generating ? <Loader2 className="w-6 h-6 text-orange-400 animate-spin" /> : <Grid3X3 className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform" />}
          <div className="text-left">
            <p className="font-bold text-cream">Generate Grid Key</p>
            <p className="text-xs text-cream/50">Grid Warrior bot activation</p>
          </div>
          <Plus className="w-5 h-5 text-orange-400 ml-auto" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream text-sm outline-none focus:border-electric/50"
            placeholder="Search by key or email..." />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {(['all','unused','active','revoked'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-electric text-void' : 'text-cream/50 hover:text-cream'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {(['all','dca','grid'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === t ? 'bg-gold text-void' : 'text-cream/50 hover:text-cream'}`}>
              {t === 'all' ? 'All Types' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Keys table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-cream/50 text-xs">
                <th className="text-left px-4 py-3 font-medium">Key</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-5 h-5 text-electric animate-spin mx-auto" /></td></tr>
              ) : filteredKeys.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-cream/30">No keys found</td></tr>
              ) : (
                filteredKeys.map(k => (
                  <tr key={k.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-cream text-xs bg-white/5 px-2 py-1 rounded">{k.activation_key}</code>
                        <button onClick={() => copyKey(k.activation_key)} className="p-1 hover:bg-white/10 rounded transition-colors" title="Copy">
                          {copied === k.activation_key ? <Check className="w-3.5 h-3.5 text-profit" /> : <Copy className="w-3.5 h-3.5 text-cream/30" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${k.bot_type === 'dca' ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'}`}>
                        {k.bot_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs ${
                        k.status === 'unused' ? 'text-gold' : k.status === 'active' ? 'text-profit' : 'text-loss'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          k.status === 'unused' ? 'bg-gold' : k.status === 'active' ? 'bg-profit' : 'bg-loss'
                        }`} />
                        {k.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cream/50 text-xs">{k.user_email || '—'}</td>
                    <td className="px-4 py-3 text-cream/40 text-xs">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowImage({ key: k.activation_key, botType: k.bot_type })} className="p-1.5 hover:bg-white/10 rounded-lg" title="View Image">
                          <ImageIcon className="w-4 h-4 text-cream/40" />
                        </button>
                        {k.status !== 'revoked' && (
                          <button onClick={() => handleRevoke(k.id)} className="p-1.5 hover:bg-loss/20 rounded-lg" title="Revoke">
                            <Trash2 className="w-4 h-4 text-loss/50" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thank You Image Modal */}
      <AnimatePresence>
        {showImage && (
          <ThankYouImageModal
            activationKey={showImage.key}
            botType={showImage.botType}
            onClose={() => setShowImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// THANK YOU IMAGE GENERATOR (Canvas API)
// ============================================
function ThankYouImageModal({ activationKey, botType, onClose }: {
  activationKey: string; botType: string; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 800;
    const H = 500;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    if (botType === 'dca') {
      grad.addColorStop(0, '#1a0a2e');
      grad.addColorStop(0.5, '#16082a');
      grad.addColorStop(1, '#0f0518');
    } else {
      grad.addColorStop(0, '#2e1a0a');
      grad.addColorStop(0.5, '#2a1608');
      grad.addColorStop(1, '#180f05');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative border
    ctx.strokeStyle = botType === 'dca' ? 'rgba(168,85,247,0.4)' : 'rgba(249,115,22,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Inner border
    ctx.strokeStyle = botType === 'dca' ? 'rgba(168,85,247,0.15)' : 'rgba(249,115,22,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    // Decorative dots / stars
    for (let i = 0; i < 30; i++) {
      const x = 40 + Math.random() * (W - 80);
      const y = 40 + Math.random() * (H - 80);
      const r = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15 + 0.03})`;
      ctx.fill();
    }

    // Glowing circle accent top-right
    const glowGrad = ctx.createRadialGradient(W - 100, 80, 0, W - 100, 80, 150);
    glowGrad.addColorStop(0, botType === 'dca' ? 'rgba(168,85,247,0.15)' : 'rgba(249,115,22,0.15)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // Bot icon area
    const iconColor = botType === 'dca' ? '#a855f7' : '#f97316';
    ctx.beginPath();
    ctx.arc(W / 2, 100, 35, 0, Math.PI * 2);
    ctx.fillStyle = botType === 'dca' ? 'rgba(168,85,247,0.2)' : 'rgba(249,115,22,0.2)';
    ctx.fill();
    ctx.strokeStyle = iconColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bot icon text
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = iconColor;
    ctx.textAlign = 'center';
    ctx.fillText(botType === 'dca' ? '⏰' : '⊞', W / 2, 110);

    // "Thank you for your purchase!"
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#f5f0e8';
    ctx.textAlign = 'center';
    ctx.fillText('Thank You For Your Purchase!', W / 2, 180);

    // Bot type label
    const botLabel = botType === 'dca' ? 'DCA Master Bot' : 'Grid Warrior Bot';
    ctx.font = '20px sans-serif';
    ctx.fillStyle = iconColor;
    ctx.fillText(botLabel, W / 2, 215);

    // Divider
    ctx.beginPath();
    ctx.moveTo(W / 2 - 120, 240);
    ctx.lineTo(W / 2 + 120, 240);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // "Your Activation Key" label
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(245,240,232,0.5)';
    ctx.fillText('YOUR ACTIVATION KEY', W / 2, 275);

    // Key box
    const boxW = 400;
    const boxH = 56;
    const boxX = (W - boxW) / 2;
    const boxY = 290;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = iconColor;
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    // Key text
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#f5f0e8';
    ctx.textAlign = 'center';
    ctx.fillText(activationKey, W / 2, boxY + 38);

    // Instructions
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(245,240,232,0.4)';
    ctx.fillText('Enter this key in your Dashboard → Trading Bots to activate', W / 2, 380);

    // Warning
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(250,204,21,0.6)';
    ctx.fillText('⚠ This key is single-use. Do not share it publicly.', W / 2, 405);

    // Footer
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(245,240,232,0.2)';
    ctx.fillText('NOVA Trading Platform • novatrade.io', W / 2, 460);

    setRendered(true);
  }, [activationKey, botType]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `activation-${activationKey}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      // Fallback: just download
      handleDownload();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="max-w-[860px] w-full bg-[#0f1118] border border-white/10 rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-bold text-cream flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gold" /> Activation Key Image
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyImage} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg text-xs text-cream/70 hover:bg-white/10 border border-white/10">
              <Copy className="w-3.5 h-3.5" /> Copy Image
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-electric/20 rounded-lg text-xs text-electric hover:bg-electric/30 border border-electric/20">
              <Download className="w-3.5 h-3.5" /> Download PNG
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-cream/50" />
            </button>
          </div>
        </div>
        <div className="p-6 flex justify-center bg-black/30">
          <canvas ref={canvasRef} className="rounded-xl shadow-2xl max-w-full" style={{ maxWidth: 800, height: 'auto' }} />
        </div>
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-cream/40">Send this image to the user via email or messaging. They'll enter the key in their dashboard to activate the bot.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Canvas helper for rounded rects
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
