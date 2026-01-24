// Permit (EIP-2612) signature utilities
// Helps users sign permits for gasless approvals

import { type Address, type Hash, encodeFunctionData } from 'viem';

/**
 * EIP-2612 Permit typed data
 */
export interface PermitData {
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

/**
 * Permit domain data
 */
export interface PermitDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

/**
 * Parsed permit signature
 */
export interface PermitSignature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

/**
 * Full permit request for UI display
 */
export interface PermitRequest {
  // What the user sees
  description: string;
  tokenName: string;
  tokenSymbol: string;
  amount: string;  // Human readable
  amountRaw: bigint;
  spenderName: string;
  spenderAddress: Address;
  deadline: Date;
  deadlineTimestamp: bigint;
  
  // Technical details
  domain: PermitDomain;
  message: PermitData;
  
  // Safety checks
  isUnlimited: boolean;
  expiresIn: string;  // Human readable
  warnings: string[];
}

/**
 * Build permit typed data for signing
 */
export function buildPermitTypedData(
  domain: PermitDomain,
  message: PermitData
) {
  return {
    domain,
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    primaryType: 'Permit' as const,
    message: {
      owner: message.owner,
      spender: message.spender,
      value: message.value,
      nonce: message.nonce,
      deadline: message.deadline
    }
  };
}

/**
 * Parse signature into v, r, s components
 */
export function parseSignature(signature: `0x${string}`): PermitSignature {
  // Remove 0x prefix
  const sig = signature.slice(2);
  
  // Split into components (each 32 bytes = 64 hex chars, v is 1 byte = 2 hex chars)
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
  let v = parseInt(sig.slice(128, 130), 16);
  
  // Adjust v if needed (EIP-155 compatibility)
  if (v < 27) {
    v += 27;
  }
  
  return { v, r, s };
}

/**
 * Create a permit request with full transparency info
 */
export function createPermitRequest(params: {
  owner: Address;
  spender: Address;
  spenderName: string;
  tokenAddress: Address;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: bigint;
  nonce: bigint;
  chainId: number;
  deadlineMinutes?: number;
  purpose: string;
}): PermitRequest {
  const {
    owner,
    spender,
    spenderName,
    tokenAddress,
    tokenName,
    tokenSymbol,
    tokenDecimals,
    amount,
    nonce,
    chainId,
    deadlineMinutes = 20,
    purpose
  } = params;
  
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);
  const deadlineDate = new Date(Number(deadline) * 1000);
  
  // Check if this is an "unlimited" approval
  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  const isUnlimited = amount >= MAX_UINT256 / BigInt(2);
  
  // Calculate human-readable expiry
  const expiresIn = `${deadlineMinutes} minutes`;
  
  // Format amount for display
  const amountFormatted = isUnlimited 
    ? 'UNLIMITED (DANGEROUS!)' 
    : formatTokenAmount(amount, tokenDecimals);
  
  // Generate warnings
  const warnings: string[] = [];
  
  if (isUnlimited) {
    warnings.push('⚠️ This is an UNLIMITED approval - the spender can take ALL your tokens');
    warnings.push('⚠️ We strongly recommend using exact amounts instead');
  }
  
  if (deadlineMinutes > 60) {
    warnings.push(`⚠️ This permit is valid for ${deadlineMinutes} minutes - consider a shorter deadline`);
  }
  
  return {
    description: purpose,
    tokenName,
    tokenSymbol,
    amount: amountFormatted,
    amountRaw: amount,
    spenderName,
    spenderAddress: spender,
    deadline: deadlineDate,
    deadlineTimestamp: deadline,
    
    domain: {
      name: tokenName,
      version: '1',
      chainId,
      verifyingContract: tokenAddress
    },
    
    message: {
      owner,
      spender,
      value: amount,
      nonce,
      deadline
    },
    
    isUnlimited,
    expiresIn,
    warnings
  };
}

/**
 * Format token amount for display
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmedFraction = fractionStr.replace(/0+$/, '');
  
  return `${whole}.${trimmedFraction}`;
}

/**
 * Generate user-friendly permit explanation
 * This is what gets displayed in the UI
 */
export function generatePermitExplanation(request: PermitRequest): {
  title: string;
  summary: string;
  details: { label: string; value: string }[];
  safetyInfo: string[];
  isRecommended: boolean;
} {
  const isExactAmount = !request.isUnlimited;
  
  return {
    title: `Approve ${request.tokenSymbol} Spending`,
    
    summary: isExactAmount
      ? `You are allowing ${request.spenderName} to spend exactly ${request.amount} ${request.tokenSymbol} from your wallet.`
      : `⚠️ WARNING: You are granting UNLIMITED access to your ${request.tokenSymbol} tokens.`,
    
    details: [
      { label: 'Token', value: `${request.tokenName} (${request.tokenSymbol})` },
      { label: 'Amount', value: `${request.amount} ${request.tokenSymbol}` },
      { label: 'Spender', value: request.spenderName },
      { label: 'Spender Address', value: request.spenderAddress },
      { label: 'Valid Until', value: request.deadline.toLocaleString() },
      { label: 'Expires In', value: request.expiresIn },
      { label: 'Purpose', value: request.description }
    ],
    
    safetyInfo: [
      isExactAmount 
        ? '✅ This approval is for an EXACT amount - safe and recommended'
        : '❌ This approval is UNLIMITED - consider rejecting',
      `✅ This approval expires in ${request.expiresIn}`,
      '✅ This approval can only be used by the specified contract',
      '✅ You can revoke this approval at any time on Revoke.cash'
    ],
    
    isRecommended: isExactAmount && request.warnings.length === 0
  };
}

/**
 * Common permit scenarios for NOVATrADE
 */
export const PERMIT_SCENARIOS = {
  AIRDROP_CLAIM: {
    purpose: 'Pay claim fee to receive airdrop tokens',
    expectedBehavior: 'Contract will take the claim fee and send you your airdrop tokens'
  },
  SWAP: {
    purpose: 'Swap tokens via DEX aggregator',
    expectedBehavior: 'Contract will take your input tokens and send you the output tokens'
  },
  VAULT_DEPOSIT: {
    purpose: 'Deposit tokens into yield vault',
    expectedBehavior: 'Contract will take your tokens and give you vault shares representing your stake'
  },
  BRIDGE: {
    purpose: 'Bridge tokens to another network',
    expectedBehavior: 'Contract will lock your tokens and you will receive them on the destination chain'
  }
} as const;

export type PermitScenario = keyof typeof PERMIT_SCENARIOS;
