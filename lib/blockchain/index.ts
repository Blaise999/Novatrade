// Blockchain Utilities for NOVATrADE
// Merkle tree generation, signature verification, and contract interaction helpers

import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export interface MerkleLeaf {
  address: string;
  amount: string;
}

export interface MerkleTree {
  root: string;
  leaves: MerkleLeaf[];
  proofs: Map<string, string[]>;
}

export interface PermitData {
  owner: string;
  spender: string;
  value: string;
  nonce: number;
  deadline: number;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface TransactionExplanation {
  action: string;
  details: string[];
  warnings: string[];
  approvalInfo?: {
    token: string;
    amount: string;
    spender: string;
    isUnlimited: boolean;
  };
}

// ============================================
// MERKLE TREE IMPLEMENTATION
// ============================================

function keccak256(data: string): string {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

export function createLeafHash(address: string, amount: string): string {
  const normalizedAddress = address.toLowerCase();
  const packed = normalizedAddress + amount.padStart(64, '0');
  return keccak256(packed);
}

function hashPair(a: string, b: string): string {
  const sorted = [a, b].sort();
  return keccak256(sorted[0] + sorted[1]);
}

export function buildMerkleTree(leaves: MerkleLeaf[]): MerkleTree {
  if (leaves.length === 0) {
    return { root: '0x0', leaves: [], proofs: new Map() };
  }

  const leafHashes = leaves.map(leaf => createLeafHash(leaf.address, leaf.amount));
  const tree: string[][] = [leafHashes];

  while (tree[tree.length - 1].length > 1) {
    const currentLevel = tree[tree.length - 1];
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(hashPair(currentLevel[i], currentLevel[i + 1]));
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }
    tree.push(nextLevel);
  }

  const root = tree[tree.length - 1][0];
  const proofs = new Map<string, string[]>();

  for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
    const proof: string[] = [];
    let index = leafIndex;
    for (let level = 0; level < tree.length - 1; level++) {
      const currentLevel = tree[level];
      const siblingIndex = index % 2 === 1 ? index - 1 : index + 1;
      if (siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      }
      index = Math.floor(index / 2);
    }
    proofs.set(leaves[leafIndex].address.toLowerCase(), proof);
  }

  return { root, leaves, proofs };
}

export function verifyMerkleProof(
  address: string,
  amount: string,
  proof: string[],
  root: string
): boolean {
  let hash = createLeafHash(address, amount);
  for (const proofElement of proof) {
    hash = hashPair(hash, proofElement);
  }
  return hash === root;
}

// ============================================
// AIRDROP DATA
// ============================================

const EXAMPLE_AIRDROP_ALLOCATIONS: MerkleLeaf[] = [
  { address: '0x1234567890123456789012345678901234567890', amount: '1000000000000000000000' },
  { address: '0x2345678901234567890123456789012345678901', amount: '750000000000000000000' },
  { address: '0x3456789012345678901234567890123456789012', amount: '500000000000000000000' },
  { address: '0x4567890123456789012345678901234567890123', amount: '250000000000000000000' },
  { address: '0x5678901234567890123456789012345678901234', amount: '100000000000000000000' },
];

let _airdropTree: MerkleTree | null = null;

function getAirdropTree(): MerkleTree {
  if (!_airdropTree) {
    _airdropTree = buildMerkleTree(EXAMPLE_AIRDROP_ALLOCATIONS);
  }
  return _airdropTree;
}

export function getAirdropMerkleRoot(): string {
  return getAirdropTree().root;
}

export function getAirdropProof(address: string): string[] | null {
  const tree = getAirdropTree();
  return tree.proofs.get(address.toLowerCase()) || null;
}

export function getAirdropAllocation(address: string): string | null {
  const tree = getAirdropTree();
  const leaf = tree.leaves.find(l => l.address.toLowerCase() === address.toLowerCase());
  return leaf?.amount || null;
}

export function isAirdropEligible(address: string): boolean {
  const tree = getAirdropTree();
  return tree.proofs.has(address.toLowerCase());
}

// ============================================
// EIP-712 TYPED DATA HELPERS
// ============================================

export function buildPermitTypedData(
  domain: EIP712Domain,
  permit: PermitData
): object {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    domain,
    message: permit,
  };
}

// ============================================
// TRANSACTION EXPLANATION
// ============================================

export function explainTransaction(
  functionName: string,
  params: Record<string, unknown>
): TransactionExplanation {
  const explanations: Record<string, () => TransactionExplanation> = {
    'claimWithPermit': () => ({
      action: 'Claim Airdrop with Permit',
      details: [
        `Amount to receive: ${params.amount} NOVA tokens`,
        `Claim fee: ${params.fee || '0.10'} USDC`,
        'Your signature approves EXACTLY the fee amount',
        'Tokens will be sent directly to YOUR wallet',
      ],
      warnings: [
        'Verify the fee amount matches what you expect',
        'Check the permit deadline is reasonable (not years away)',
      ],
    }),
    'approve': () => {
      const isUnlimited = params.amount === 'unlimited' ||
        params.amount === '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      return {
        action: 'Approve Token Spending',
        details: [
          `Token: ${params.token}`,
          `Spender: ${params.spender}`,
          `Amount: ${isUnlimited ? 'UNLIMITED' : params.amount}`,
        ],
        warnings: isUnlimited ? [
          '⚠️ This is an UNLIMITED approval',
          'The spender can take ALL of this token from your wallet',
          'Consider using a specific amount instead',
        ] : [],
        approvalInfo: {
          token: String(params.token),
          amount: String(params.amount),
          spender: String(params.spender),
          isUnlimited,
        },
      };
    },
    'permit': () => ({
      action: 'Sign Permit (Gasless Approval)',
      details: [
        `Token: ${params.token}`,
        `Spender: ${params.spender}`,
        `Amount: ${params.value}`,
        `Deadline: ${new Date(Number(params.deadline) * 1000).toLocaleString()}`,
      ],
      warnings: [],
      approvalInfo: {
        token: String(params.token),
        amount: String(params.value),
        spender: String(params.spender),
        isUnlimited: false,
      },
    }),
    'swap': () => ({
      action: 'Swap Tokens',
      details: [
        `Selling: ${params.amountIn} ${params.tokenIn}`,
        `Minimum receiving: ${params.minAmountOut} ${params.tokenOut}`,
        `Slippage protection: Yes`,
      ],
      warnings: Number(params.slippage) > 5 ? [
        `⚠️ High slippage tolerance: ${params.slippage}%`,
      ] : [],
    }),
  };

  const explain = explanations[functionName];
  if (!explain) {
    return {
      action: `Call: ${functionName}`,
      details: Object.entries(params).map(([k, v]) => `${k}: ${v}`),
      warnings: ['Unknown function - review carefully'],
    };
  }

  return explain();
}

// ============================================
// ADDRESS VALIDATION
// ============================================

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function checksumAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error('Invalid address');
  }
  const lower = address.toLowerCase().slice(2);
  const hash = crypto.createHash('sha256').update(lower).digest('hex');
  let checksummed = '0x';
  for (let i = 0; i < lower.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += lower[i].toUpperCase();
    } else {
      checksummed += lower[i];
    }
  }
  return checksummed;
}

// ============================================
// CHAIN CONFIGURATION
// ============================================

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    novaToken?: string;
    airdrop?: string;
    aggregator?: string;
  };
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contracts: {},
  },
  56: {
    id: 56,
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    contracts: {},
  },
  137: {
    id: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    contracts: {},
  },
};

export function getChainConfig(chainId: number): ChainConfig | null {
  return SUPPORTED_CHAINS[chainId] || null;
}
