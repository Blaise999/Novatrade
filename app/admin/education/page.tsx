'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  Activity,
  X,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  Play,
  Pause,
  Clock,
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';
import { adminService, type EducationalScenario } from '@/lib/services/admin-service';

const TREND_TYPES = [
  { value: 'steady_rise', label: 'Steady Rise', icon: TrendingUp, color: 'text-profit', description: 'Consistent upward movement for trend following practice' },
  { value: 'steady_fall', label: 'Steady Fall', icon: TrendingDown, color: 'text-loss', description: 'Consistent downward movement for short selling practice' },
  { value: 'range_bound', label: 'Range Bound', icon: Minus, color: 'text-gold', description: 'Price oscillates between support and resistance' },
  { value: 'breakout', label: 'Breakout', icon: Zap, color: 'text-electric', description: 'Consolidation followed by strong directional move' },
  { value: 'fakeout', label: 'Fakeout', icon: Target, color: 'text-orange-400', description: 'False breakout that reverses - trap avoidance training' },
  { value: 'high_volatility', label: 'High Volatility', icon: Activity, color: 'text-purple-400', description: 'Extreme price swings for risk management training' },
];

const DEFAULT_SCENARIOS: Omit<EducationalScenario, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Bullish Trend Training',
    description: 'Practice identifying and riding uptrends',
    trend_type: 'steady_rise',
    trend_strength: 0.7,
    volatility: 0.3,
    pullback_frequency: 0.2,
    spike_chance: 0.05,
    duration_minutes: 30,
    base_price: 100,
    is_active: true,
  },
  {
    name: 'Bearish Trend Training',
    description: 'Practice short selling in downtrends',
    trend_type: 'steady_fall',
    trend_strength: 0.6,
    volatility: 0.35,
    pullback_frequency: 0.15,
    spike_chance: 0.05,
    duration_minutes: 30,
    base_price: 100,
    is_active: true,
  },
  {
    name: 'Support/Resistance Trading',
    description: 'Practice range trading strategies',
    trend_type: 'range_bound',
    trend_strength: 0.2,
    volatility: 0.4,
    pullback_frequency: 0.5,
    spike_chance: 0.02,
    duration_minutes: 45,
    base_price: 100,
    is_active: true,
  },
  {
    name: 'Breakout Momentum',
    description: 'Catch strong moves after consolidation',
    trend_type: 'breakout',
    trend_strength: 0.9,
    volatility: 0.5,
    pullback_frequency: 0.1,
    spike_chance: 0.15,
    duration_minutes: 20,
    base_price: 100,
    is_active: true,
  },
  {
    name: 'Trap Avoidance',
    description: 'Learn to avoid false breakouts',
    trend_type: 'fakeout',
    trend_strength: 0.5,
    volatility: 0.6,
    pullback_frequency: 0.3,
    spike_chance: 0.2,
    duration_minutes: 25,
    base_price: 100,
    is_active: true,
  },
  {
    name: 'Extreme Conditions',
    description: 'High volatility risk management',
    trend_type: 'high_volatility',
    trend_strength: 0.4,
    volatility: 0.9,
    pullback_frequency: 0.4,
    spike_chance: 0.3,
    duration_minutes: 15,
    base_price: 100,
    is_active: true,
  },
];

export default function AdminEducationPage() {
  const { admin, isAuthenticated } = useAdminAuthStore();
  const [scenarios, setScenarios] = useState<EducationalScenario[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<EducationalScenario | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trend_type: 'steady_rise' as EducationalScenario['trend_type'],
    trend_strength: 0.5,
    volatility: 0.3,
    pullback_frequency: 0.2,
    spike_chance: 0.05,
    duration_minutes: 30,
    base_price: 100,
    is_active: true,
  });

  useEffect(() => {
    if (admin?.id) {
      adminService.setAdminId(admin.id);
    }
    loadScenarios();
  }, [admin]);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await adminService.getEducationalScenarios();
      if (data && data.length > 0) {
        setScenarios(data);
      } else {
        // Use default scenarios if none exist
        setScenarios(DEFAULT_SCENARIOS.map((s, i) => ({
          ...s,
          id: `default-${i}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })));
      }
    } catch (error) {
      // Use default scenarios on error
      setScenarios(DEFAULT_SCENARIOS.map((s, i) => ({
        ...s,
        id: `default-${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setProcessing(true);
    try {
      const { data, error } = await adminService.createEducationalScenario(formData);
      if (error) throw error;
      
      setNotification({ type: 'success', message: 'Scenario created successfully' });
      setShowCreateModal(false);
      resetForm();
      loadScenarios();
    } catch (error) {
      // For demo, add locally
      const newScenario: EducationalScenario = {
        ...formData,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setScenarios(prev => [...prev, newScenario]);
      setNotification({ type: 'success', message: 'Scenario created locally' });
      setShowCreateModal(false);
      resetForm();
    }
    setProcessing(false);
  };

  const handleUpdate = async () => {
    if (!selectedScenario) return;
    
    setProcessing(true);
    try {
      const { data, error } = await adminService.updateEducationalScenario(selectedScenario.id, formData);
      if (error) throw error;
      
      setNotification({ type: 'success', message: 'Scenario updated successfully' });
      setShowEditModal(false);
      setSelectedScenario(null);
      resetForm();
      loadScenarios();
    } catch (error) {
      // For demo, update locally
      setScenarios(prev => prev.map(s => 
        s.id === selectedScenario.id ? { ...s, ...formData, updated_at: new Date().toISOString() } : s
      ));
      setNotification({ type: 'success', message: 'Scenario updated locally' });
      setShowEditModal(false);
      setSelectedScenario(null);
      resetForm();
    }
    setProcessing(false);
  };

  const handleDelete = async (scenario: EducationalScenario) => {
    if (!confirm(`Are you sure you want to delete "${scenario.name}"?`)) return;
    
    try {
      const { error } = await adminService.deleteEducationalScenario(scenario.id);
      if (error) throw error;
      
      setNotification({ type: 'success', message: 'Scenario deleted successfully' });
      loadScenarios();
    } catch (error) {
      // For demo, delete locally
      setScenarios(prev => prev.filter(s => s.id !== scenario.id));
      setNotification({ type: 'success', message: 'Scenario deleted locally' });
    }
  };

  const toggleScenarioActive = async (scenario: EducationalScenario) => {
    try {
      await adminService.updateEducationalScenario(scenario.id, { is_active: !scenario.is_active });
      loadScenarios();
    } catch (error) {
      // For demo, toggle locally
      setScenarios(prev => prev.map(s => 
        s.id === scenario.id ? { ...s, is_active: !s.is_active } : s
      ));
    }
  };

  const openEditModal = (scenario: EducationalScenario) => {
    setSelectedScenario(scenario);
    setFormData({
      name: scenario.name,
      description: scenario.description || '',
      trend_type: scenario.trend_type,
      trend_strength: scenario.trend_strength,
      volatility: scenario.volatility,
      pullback_frequency: scenario.pullback_frequency,
      spike_chance: scenario.spike_chance,
      duration_minutes: scenario.duration_minutes,
      base_price: scenario.base_price,
      is_active: scenario.is_active,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trend_type: 'steady_rise',
      trend_strength: 0.5,
      volatility: 0.3,
      pullback_frequency: 0.2,
      spike_chance: 0.05,
      duration_minutes: 30,
      base_price: 100,
      is_active: true,
    });
  };

  const getTrendIcon = (type: string) => {
    const trend = TREND_TYPES.find(t => t.value === type);
    return trend ? trend.icon : Activity;
  };

  const getTrendColor = (type: string) => {
    const trend = TREND_TYPES.find(t => t.value === type);
    return trend?.color || 'text-slate-400';
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
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-profit/20 border border-profit/30' : 'bg-loss/20 border border-loss/30'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-profit" />
            ) : (
              <AlertCircle className="w-5 h-5 text-loss" />
            )}
            <span className={notification.type === 'success' ? 'text-profit' : 'text-loss'}>
              {notification.message}
            </span>
            <button onClick={() => setNotification(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-gold" />
            Educational Scenarios
          </h1>
          <p className="text-slate-400 mt-1">Configure chart scenarios for educational trading mode</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadScenarios}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-void font-semibold rounded-lg hover:bg-gold/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Scenario
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-electric/10 border border-electric/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-electric mt-0.5" />
          <div>
            <h3 className="text-cream font-medium">How Educational Scenarios Work</h3>
            <p className="text-sm text-slate-400 mt-1">
              Each scenario defines price behavior patterns. When users select educational mode, the simulator generates realistic candles based on these parameters. Trades in educational mode use the same shared balance as live trading.
            </p>
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center p-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : scenarios.length === 0 ? (
          <div className="col-span-full text-center p-12">
            <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No scenarios created yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-gold hover:text-gold/80"
            >
              Create your first scenario
            </button>
          </div>
        ) : (
          scenarios.map((scenario) => {
            const TrendIcon = getTrendIcon(scenario.trend_type);
            const trendColor = getTrendColor(scenario.trend_type);
            
            return (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white/5 rounded-xl border ${scenario.is_active ? 'border-gold/30' : 'border-white/10'} overflow-hidden`}
              >
                {/* Header */}
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white/5 ${trendColor}`}>
                        <TrendIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-cream font-medium">{scenario.name}</h3>
                        <p className="text-xs text-slate-500 capitalize">{scenario.trend_type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleScenarioActive(scenario)}
                      className={`p-1.5 rounded-lg transition-all ${
                        scenario.is_active ? 'bg-profit/20 text-profit' : 'bg-white/5 text-slate-500'
                      }`}
                      title={scenario.is_active ? 'Active' : 'Inactive'}
                    >
                      {scenario.is_active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Description */}
                {scenario.description && (
                  <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-sm text-slate-400">{scenario.description}</p>
                  </div>
                )}

                {/* Parameters */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Trend Strength</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gold rounded-full" style={{ width: `${scenario.trend_strength * 100}%` }} />
                        </div>
                        <span className="text-cream">{Math.round(scenario.trend_strength * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-500">Volatility</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-electric rounded-full" style={{ width: `${scenario.volatility * 100}%` }} />
                        </div>
                        <span className="text-cream">{Math.round(scenario.volatility * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-500">Pullbacks</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-loss rounded-full" style={{ width: `${scenario.pullback_frequency * 100}%` }} />
                        </div>
                        <span className="text-cream">{Math.round(scenario.pullback_frequency * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-500">Spike Chance</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full" style={{ width: `${scenario.spike_chance * 100}%` }} />
                        </div>
                        <span className="text-cream">{Math.round(scenario.spike_chance * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Clock className="w-4 h-4" />
                      {scenario.duration_minutes} min
                    </div>
                    <div className="text-sm text-slate-400">
                      Base: ${scenario.base_price}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(scenario)}
                    className="p-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-all"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(scenario)}
                    className="p-2 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || showEditModal) && (
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
                <h3 className="text-xl font-semibold text-cream">
                  {showEditModal ? 'Edit Scenario' : 'Create Scenario'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedScenario(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Scenario Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Bullish Trend Training"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this scenario teaches..."
                    rows={2}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold resize-none"
                  />
                </div>

                {/* Trend Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Trend Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TREND_TYPES.map((trend) => (
                      <button
                        key={trend.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, trend_type: trend.value as EducationalScenario['trend_type'] }))}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          formData.trend_type === trend.value
                            ? 'border-gold bg-gold/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <trend.icon className={`w-4 h-4 ${trend.color}`} />
                          <span className="text-sm text-cream">{trend.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Trend Strength: {Math.round(formData.trend_strength * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.trend_strength}
                      onChange={(e) => setFormData(prev => ({ ...prev, trend_strength: parseFloat(e.target.value) }))}
                      className="w-full accent-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Volatility: {Math.round(formData.volatility * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.volatility}
                      onChange={(e) => setFormData(prev => ({ ...prev, volatility: parseFloat(e.target.value) }))}
                      className="w-full accent-electric"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Pullback Frequency: {Math.round(formData.pullback_frequency * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.pullback_frequency}
                      onChange={(e) => setFormData(prev => ({ ...prev, pullback_frequency: parseFloat(e.target.value) }))}
                      className="w-full accent-loss"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Spike Chance: {Math.round(formData.spike_chance * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={formData.spike_chance}
                      onChange={(e) => setFormData(prev => ({ ...prev, spike_chance: parseFloat(e.target.value) }))}
                      className="w-full accent-purple-400"
                    />
                  </div>
                </div>

                {/* Duration and Base Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 30 }))}
                      min="5"
                      max="120"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Base Price ($)</label>
                    <input
                      type="number"
                      value={formData.base_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 100 }))}
                      min="1"
                      step="0.01"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-cream focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-cream">Active</p>
                    <p className="text-xs text-slate-500">Enable this scenario for users</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`w-12 h-6 rounded-full transition-all ${
                      formData.is_active ? 'bg-profit' : 'bg-white/20'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                      formData.is_active ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setSelectedScenario(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 bg-white/5 text-slate-400 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showEditModal ? handleUpdate : handleCreate}
                    disabled={!formData.name || processing}
                    className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {showEditModal ? 'Save Changes' : 'Create Scenario'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
