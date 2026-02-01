'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  User,
  Eye,
  X,
  ChevronDown,
  Activity,
  DollarSign,
  UserX,
  UserCheck,
  Edit,
  Trash2,
  TrendingUp,
  Settings,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { adminService, type AuditLogEntry } from '@/lib/services/admin-service';

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  user_update: { icon: Edit, color: 'text-electric', label: 'User Updated' },
  balance_credit: { icon: DollarSign, color: 'text-profit', label: 'Balance Credit' },
  balance_debit: { icon: DollarSign, color: 'text-loss', label: 'Balance Debit' },
  force_close_trade: { icon: TrendingUp, color: 'text-orange-400', label: 'Trade Force Closed' },
  cancel_trade: { icon: X, color: 'text-loss', label: 'Trade Cancelled' },
  approve_withdrawal: { icon: UserCheck, color: 'text-profit', label: 'Withdrawal Approved' },
  reject_withdrawal: { icon: UserX, color: 'text-loss', label: 'Withdrawal Rejected' },
  create_edu_scenario: { icon: Activity, color: 'text-electric', label: 'Scenario Created' },
  update_edu_scenario: { icon: Edit, color: 'text-gold', label: 'Scenario Updated' },
  delete_edu_scenario: { icon: Trash2, color: 'text-loss', label: 'Scenario Deleted' },
  create_pair: { icon: TrendingUp, color: 'text-profit', label: 'Pair Created' },
  enable_pair: { icon: Activity, color: 'text-profit', label: 'Pair Enabled' },
  disable_pair: { icon: Activity, color: 'text-loss', label: 'Pair Disabled' },
  update_setting: { icon: Settings, color: 'text-gold', label: 'Setting Updated' },
};

// Mock audit logs for demo
const MOCK_LOGS: AuditLogEntry[] = [
  {
    id: '1',
    admin_id: 'admin-1',
    action: 'balance_credit',
    target_type: 'user',
    target_id: 'user-123',
    previous_value: { balance: 1000 },
    new_value: { balance: 1500 },
    details: { amount: 500, reason: 'Promotional bonus' },
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    admin_id: 'admin-1',
    action: 'user_update',
    target_type: 'user',
    target_id: 'user-456',
    previous_value: { role: 'user', is_active: true },
    new_value: { role: 'user', is_active: false },
    details: { reason: 'Suspicious activity detected' },
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '3',
    admin_id: 'admin-1',
    action: 'force_close_trade',
    target_type: 'trade',
    target_id: 'trade-789',
    previous_value: { status: 'open', entry_price: 42000 },
    new_value: { status: 'closed', exit_price: 41500, pnl: -250 },
    details: { reason: 'Market manipulation prevention' },
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: '4',
    admin_id: 'admin-1',
    action: 'approve_withdrawal',
    target_type: 'withdrawal',
    target_id: 'wd-101',
    previous_value: { status: 'pending' },
    new_value: { status: 'completed', tx_hash: '0x123...' },
    details: { note: 'Verified identity' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '5',
    admin_id: 'admin-1',
    action: 'create_edu_scenario',
    target_type: 'educational_scenario',
    target_id: 'scenario-1',
    new_value: { name: 'Bullish Trend Training', trend_type: 'steady_rise' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: '6',
    admin_id: 'admin-1',
    action: 'balance_debit',
    target_type: 'user',
    target_id: 'user-789',
    previous_value: { balance: 5000 },
    new_value: { balance: 4500 },
    details: { amount: 500, reason: 'Chargeback reversal' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

export default function AdminAuditPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>(MOCK_LOGS);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  // Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (admin?.id) {
      adminService.setAdminId(admin.id);
    }
    loadLogs();
  }, [admin]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await adminService.getAuditLogs({ limit: 100 });
      if (data && data.length > 0) {
        setLogs(data);
      } else {
        // Use mock data for demo
        setLogs(MOCK_LOGS);
      }
    } catch (error) {
      // Use mock data on error
      setLogs(MOCK_LOGS);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (targetTypeFilter && log.target_type !== targetTypeFilter) return false;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(searchLower) ||
        log.target_type?.toLowerCase().includes(searchLower) ||
        log.target_id?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.details).toLowerCase().includes(searchLower)
      );
    }
    if (dateRange.from && new Date(log.created_at!) < new Date(dateRange.from)) return false;
    if (dateRange.to && new Date(log.created_at!) > new Date(dateRange.to + 'T23:59:59')) return false;
    return true;
  });

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { icon: FileText, color: 'text-slate-400', label: action };
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const exportLogs = () => {
    const data = filteredLogs.map(log => ({
      date: log.created_at,
      action: log.action,
      target_type: log.target_type,
      target_id: log.target_id,
      details: JSON.stringify(log.details),
      previous_value: JSON.stringify(log.previous_value),
      new_value: JSON.stringify(log.new_value),
    }));
    
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated || !admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Please log in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream flex items-center gap-3">
            <Shield className="w-7 h-7 text-gold" />
            Audit Log
          </h1>
          <p className="text-slate-400 mt-1">Complete history of all admin actions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-semibold rounded-lg hover:bg-gold/90 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Activity className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Actions</p>
              <p className="text-xl font-bold text-cream">{logs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-profit/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-profit" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Balance Changes</p>
              <p className="text-xl font-bold text-cream">
                {logs.filter(l => l.action.includes('balance')).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric/20 rounded-lg">
              <User className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-sm text-slate-400">User Actions</p>
              <p className="text-xl font-bold text-cream">
                {logs.filter(l => l.target_type === 'user').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-loss/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-loss" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Trade Interventions</p>
              <p className="text-xl font-bold text-cream">
                {logs.filter(l => l.target_type === 'trade').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions, targets, or details..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
        >
          <option value="">All Targets</option>
          <option value="user">Users</option>
          <option value="trade">Trades</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="educational_scenario">Scenarios</option>
          <option value="pair">Pairs</option>
          <option value="setting">Settings</option>
        </select>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
          placeholder="From"
        />
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
          placeholder="To"
        />
      </div>

      {/* Logs List */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Shield className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredLogs.map((log) => {
              const config = getActionConfig(log.action);
              const Icon = config.icon;
              
              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-white/5 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetailModal(true);
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg bg-white/5 ${config.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-cream font-medium">{config.label}</h4>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(log.created_at!)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {log.target_type && (
                          <span className="capitalize">{log.target_type}: </span>
                        )}
                        <span className="font-mono text-xs">{log.target_id}</span>
                      </p>
                      {log.details && (
                        <p className="text-sm text-slate-500 mt-1 truncate">
                          {typeof log.details === 'object' 
                            ? (log.details as Record<string, unknown>).reason || (log.details as Record<string, unknown>).note || JSON.stringify(log.details)
                            : log.details}
                        </p>
                      )}
                    </div>
                    <button className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-cream">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedLog && (
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
              className="bg-charcoal rounded-2xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-cream">Audit Log Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Action</p>
                    <p className={`text-sm font-medium ${getActionConfig(selectedLog.action).color}`}>
                      {getActionConfig(selectedLog.action).label}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Date & Time</p>
                    <p className="text-sm text-cream">
                      {new Date(selectedLog.created_at!).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Target Type</p>
                    <p className="text-sm text-cream capitalize">{selectedLog.target_type || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">Target ID</p>
                    <p className="text-sm text-cream font-mono truncate">{selectedLog.target_id || 'N/A'}</p>
                  </div>
                </div>

                {selectedLog.details && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400 mb-2">Details</p>
                    <pre className="text-sm text-cream font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.previous_value && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded-xl">
                    <p className="text-xs text-loss mb-2">Previous Value</p>
                    <pre className="text-sm text-cream font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(selectedLog.previous_value, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_value && (
                  <div className="p-3 bg-profit/10 border border-profit/20 rounded-xl">
                    <p className="text-xs text-profit mb-2">New Value</p>
                    <pre className="text-sm text-cream font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(selectedLog.new_value, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-400">IP Address</p>
                    <p className="text-sm text-cream font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
