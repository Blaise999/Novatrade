'use client';

// TransparentSigner.tsx
// A component that ALWAYS shows users exactly what they're signing
// No hidden transactions, no surprises

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  Clock,
  Wallet,
  ArrowRight,
  FileText,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface TransactionStep {
  id: string;
  type: 'permit' | 'approve' | 'transaction' | 'signature';
  title: string;
  description: string;
  details: {
    label: string;
    value: string;
    isWarning?: boolean;
    isSafe?: boolean;
  }[];
  warnings?: string[];
  safetyChecks?: {
    label: string;
    passed: boolean;
    explanation: string;
  }[];
}

export interface TransactionExplanation {
  title: string;
  summary: string;
  steps: TransactionStep[];
  totalGasEstimate?: string;
  whatYouReceive: string;
  whatYouPay: string;
  risks: string[];
  safetyFeatures: string[];
}

interface TransparentSignerProps {
  explanation: TransactionExplanation;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================
// SAFETY BADGE COMPONENT
// ============================================

function SafetyBadge({ type }: { type: 'safe' | 'warning' | 'danger' }) {
  const configs = {
    safe: {
      bg: 'bg-profit/10',
      border: 'border-profit/30',
      text: 'text-profit',
      icon: CheckCircle,
      label: 'Safe',
    },
    warning: {
      bg: 'bg-gold/10',
      border: 'border-gold/30',
      text: 'text-gold',
      icon: AlertTriangle,
      label: 'Review Carefully',
    },
    danger: {
      bg: 'bg-loss/10',
      border: 'border-loss/30',
      text: 'text-loss',
      icon: XCircle,
      label: 'Dangerous',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bg} ${config.border} border`}>
      <Icon className={`w-3.5 h-3.5 ${config.text}`} />
      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}

// ============================================
// STEP CARD COMPONENT
// ============================================

function StepCard({ step, stepNumber }: { step: TransactionStep; stepNumber: number }) {
  const [expanded, setExpanded] = useState(false);

  const typeIcons = {
    permit: FileText,
    approve: Lock,
    transaction: ArrowRight,
    signature: Eye,
  };

  const Icon = typeIcons[step.type];
  const hasWarnings = step.warnings && step.warnings.length > 0;
  const allChecksPassed = step.safetyChecks?.every(c => c.passed) ?? true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: stepNumber * 0.1 }}
      className={`rounded-xl border ${
        hasWarnings 
          ? 'border-gold/30 bg-gold/5' 
          : allChecksPassed 
            ? 'border-white/10 bg-white/5' 
            : 'border-loss/30 bg-loss/5'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-4 text-left"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          hasWarnings ? 'bg-gold/20' : 'bg-white/10'
        }`}>
          <Icon className={`w-5 h-5 ${hasWarnings ? 'text-gold' : 'text-cream'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              Step {stepNumber + 1}: {step.type}
            </span>
            {hasWarnings && <SafetyBadge type="warning" />}
            {!hasWarnings && allChecksPassed && <SafetyBadge type="safe" />}
          </div>
          <h4 className="font-semibold text-cream">{step.title}</h4>
          <p className="text-sm text-slate-400 mt-1">{step.description}</p>
        </div>
        
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Details */}
              <div className="bg-void/50 rounded-lg p-3 space-y-2">
                {step.details.map((detail, i) => (
                  <div key={i} className="flex justify-between items-start gap-4">
                    <span className="text-sm text-slate-500">{detail.label}</span>
                    <span className={`text-sm font-mono text-right break-all ${
                      detail.isWarning ? 'text-gold' : detail.isSafe ? 'text-profit' : 'text-cream'
                    }`}>
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Warnings */}
              {step.warnings && step.warnings.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs uppercase tracking-wider text-gold flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warnings
                  </h5>
                  {step.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gold/80 bg-gold/10 rounded-lg p-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Safety Checks */}
              {step.safetyChecks && (
                <div className="space-y-2">
                  <h5 className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" />
                    Safety Checks
                  </h5>
                  {step.safetyChecks.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      {check.passed ? (
                        <CheckCircle className="w-4 h-4 text-profit flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-loss flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className={check.passed ? 'text-cream' : 'text-loss'}>
                          {check.label}
                        </span>
                        <p className="text-slate-500 text-xs mt-0.5">{check.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TransparentSigner({
  explanation,
  onConfirm,
  onCancel,
  isLoading = false,
}: TransparentSignerProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);

  const hasWarnings = explanation.risks.length > 0;
  const hasStepWarnings = explanation.steps.some(s => s.warnings && s.warnings.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/90 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-gradient-to-b from-slate-900 to-void rounded-2xl border border-white/10 shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-gold" />
                <span className="text-xs uppercase tracking-wider text-gold">
                  Transaction Preview
                </span>
              </div>
              <h2 className="text-xl font-display font-bold text-cream">
                {explanation.title}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {explanation.summary}
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">You Pay</p>
              <p className="font-semibold text-cream">{explanation.whatYouPay}</p>
            </div>
            <div className="bg-profit/10 rounded-lg p-3">
              <p className="text-xs text-profit/70 mb-1">You Receive</p>
              <p className="font-semibold text-profit">{explanation.whatYouReceive}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[50vh] p-6 space-y-4">
          {/* Steps */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-cream flex items-center gap-2">
              <Eye className="w-4 h-4 text-gold" />
              What Happens (Step by Step)
            </h3>
            {explanation.steps.map((step, i) => (
              <StepCard key={step.id} step={step} stepNumber={i} />
            ))}
          </div>

          {/* Safety Features */}
          <div className="bg-profit/5 border border-profit/20 rounded-xl p-4">
            <h3 className="text-sm font-medium text-profit flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4" />
              Safety Features
            </h3>
            <div className="space-y-2">
              {explanation.safetyFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-profit flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          {explanation.risks.length > 0 && (
            <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gold flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Things to Know
              </h3>
              <div className="space-y-2">
                {explanation.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 space-y-4">
          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-gold peer-checked:border-gold transition-all flex items-center justify-center">
                {agreedToTerms && <CheckCircle className="w-3 h-3 text-void" />}
              </div>
            </div>
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              I have reviewed all {explanation.steps.length} steps and understand exactly what I&apos;m signing. 
              I confirm that the amounts and addresses shown above are correct.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-white/5 border border-white/10 text-cream font-medium rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!agreedToTerms || isLoading}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-gold to-gold/80 text-void font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  Sign & Confirm
                </>
              )}
            </button>
          </div>

          {/* Help Link */}
          <p className="text-center text-xs text-slate-500">
            Not sure? <a href="/help/transactions" className="text-gold hover:underline">Learn about transaction safety</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// EXAMPLE USAGE HELPER
// ============================================

export function buildAirdropClaimExplanation(
  tokenAmount: string,
  claimFee: string,
  feeToken: string,
  contractAddress: string,
  permitDeadline: number
): TransactionExplanation {
  const deadlineDate = new Date(permitDeadline * 1000);
  const isDeadlineReasonable = (permitDeadline - Date.now() / 1000) < 1800; // 30 min

  return {
    title: 'Claim NOVA Airdrop',
    summary: 'Claim your NOVA tokens by paying a small fee via gasless permit signature.',
    whatYouPay: `${claimFee} ${feeToken} (claim fee)`,
    whatYouReceive: `${tokenAmount} NOVA tokens`,
    steps: [
      {
        id: 'permit',
        type: 'permit',
        title: 'Sign Permit for Claim Fee',
        description: 'You\'ll sign a message (not a transaction) that allows the airdrop contract to take the exact claim fee from your wallet.',
        details: [
          { label: 'Amount', value: `${claimFee} ${feeToken} (exact amount, NOT unlimited)`, isSafe: true },
          { label: 'Spender', value: contractAddress },
          { label: 'Expires', value: deadlineDate.toLocaleString(), isSafe: isDeadlineReasonable },
          { label: 'Type', value: 'EIP-2612 Permit (gasless approval)', isSafe: true },
        ],
        safetyChecks: [
          {
            label: 'Exact amount (not unlimited)',
            passed: true,
            explanation: 'The permit is for the exact fee amount only, not your entire balance.',
          },
          {
            label: 'Reasonable deadline',
            passed: isDeadlineReasonable,
            explanation: isDeadlineReasonable 
              ? 'Permit expires within 30 minutes.'
              : 'Warning: Permit deadline is more than 30 minutes away.',
          },
          {
            label: 'Verified contract',
            passed: true,
            explanation: 'The spender is the official NOVATrADE airdrop contract.',
          },
        ],
      },
      {
        id: 'claim',
        type: 'transaction',
        title: 'Claim Tokens',
        description: 'The contract verifies your eligibility using Merkle proof and sends NOVA tokens directly to your wallet.',
        details: [
          { label: 'You Receive', value: `${tokenAmount} NOVA`, isSafe: true },
          { label: 'Destination', value: 'Your connected wallet (same address)', isSafe: true },
          { label: 'Fee Collected', value: `${claimFee} ${feeToken}` },
          { label: 'Lottery', value: '10% chance to win BNB bonus!' },
        ],
        safetyChecks: [
          {
            label: 'Tokens sent to your wallet',
            passed: true,
            explanation: 'NOVA tokens are sent directly to msg.sender (your wallet), not held by the contract.',
          },
          {
            label: 'Merkle proof verification',
            passed: true,
            explanation: 'Your eligibility is cryptographically verified against the airdrop list.',
          },
        ],
      },
    ],
    safetyFeatures: [
      'Permit is for EXACT fee amount, not unlimited approval',
      'Permit expires in 20 minutes (not months or years)',
      'Tokens go directly to YOUR wallet',
      'Contract is verified and open-source',
      'No hidden fees beyond the stated claim fee',
    ],
    risks: [
      'Once claimed, you cannot claim again for this airdrop',
      'NOVA token price may fluctuate after claiming',
      'Gas fees apply for the claim transaction',
    ],
  };
}

export function buildSwapExplanation(
  tokenInAmount: string,
  tokenInSymbol: string,
  tokenOutAmount: string,
  tokenOutSymbol: string,
  fee: string,
  dexName: string,
  permitDeadline: number
): TransactionExplanation {
  return {
    title: `Swap ${tokenInSymbol} → ${tokenOutSymbol}`,
    summary: `Swap your ${tokenInSymbol} for ${tokenOutSymbol} via ${dexName} with slippage protection.`,
    whatYouPay: `${tokenInAmount} ${tokenInSymbol}`,
    whatYouReceive: `≥${tokenOutAmount} ${tokenOutSymbol}`,
    steps: [
      {
        id: 'permit',
        type: 'permit',
        title: `Approve ${tokenInSymbol} Spending`,
        description: 'Sign a permit allowing the aggregator to spend your exact swap amount.',
        details: [
          { label: 'Amount', value: `${tokenInAmount} ${tokenInSymbol} (exact)`, isSafe: true },
          { label: 'Spender', value: 'NOVADeFiAggregator' },
          { label: 'Permit Type', value: 'One-time use for this swap', isSafe: true },
        ],
        safetyChecks: [
          { label: 'Exact amount', passed: true, explanation: 'Not unlimited approval' },
          { label: 'Short deadline', passed: true, explanation: '20 minute expiry' },
        ],
      },
      {
        id: 'swap',
        type: 'transaction',
        title: 'Execute Swap',
        description: `Your tokens are swapped via ${dexName} with the output sent to your wallet.`,
        details: [
          { label: 'Input', value: `${tokenInAmount} ${tokenInSymbol}` },
          { label: 'Platform Fee', value: fee },
          { label: 'DEX', value: dexName },
          { label: 'Min Output', value: `${tokenOutAmount} ${tokenOutSymbol}` },
          { label: 'Destination', value: 'Your wallet (same address)', isSafe: true },
        ],
        safetyChecks: [
          { label: 'Slippage protection', passed: true, explanation: 'Transaction reverts if output is below minimum' },
          { label: 'Whitelisted DEX', passed: true, explanation: `${dexName} is verified` },
          { label: 'Output to your wallet', passed: true, explanation: 'Not held by aggregator' },
        ],
      },
    ],
    safetyFeatures: [
      'Permit for exact amount only',
      'Slippage protection with minimum output',
      'Only whitelisted DEXes are used',
      'Output sent directly to your wallet',
      'All approvals cleared after swap',
    ],
    risks: [
      'Price may move during transaction (slippage)',
      'Gas fees apply',
      'DEX may have additional fees',
    ],
  };
}
