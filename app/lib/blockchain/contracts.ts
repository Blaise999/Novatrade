// Blockchain service for NOVA platform
// Contains contract ABIs and interaction utilities

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
} from "viem";
import { mainnet, sepolia, bsc, polygon, arbitrum, base } from "viem/chains";

// ============================================
// CONTRACT ABIS
// ============================================

export const NOVA_AIRDROP_ABI = [
  // Read functions
  {
    name: "canClaim",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [
      { name: "eligible", type: "bool" },
      { name: "reason", type: "string" },
    ],
  },
  {
    name: "hasClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "claimedAmount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "claimFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "merkleRoot",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "airdropEndTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalClaimed", type: "uint256" },
      { name: "_totalFeesCollected", type: "uint256" },
      { name: "_remainingTokens", type: "uint256" },
      { name: "_timeRemaining", type: "uint256" },
      { name: "_isActive", type: "bool" },
    ],
  },
  // Write functions
  {
    name: "claimWithPermit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "claimWithApproval",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  // Events
  {
    name: "Claimed",
    type: "event",
    inputs: [
      { name: "claimant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "feePaid", type: "uint256", indexed: false },
      { name: "proof", type: "bytes32[]", indexed: false },
    ],
  },
] as const;

export const NOVA_AGGREGATOR_ABI = [
  {
    name: "executeAggregatedOperation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "operation",
        type: "tuple",
        components: [
          {
            name: "swap",
            type: "tuple",
            components: [
              { name: "tokenIn", type: "address" },
              { name: "tokenOut", type: "address" },
              { name: "amountIn", type: "uint256" },
              { name: "minAmountOut", type: "uint256" },
              { name: "path", type: "address[]" },
              { name: "dexRouter", type: "address" },
              { name: "deadline", type: "uint256" },
            ],
          },
          {
            name: "bridge",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
              { name: "destinationChain", type: "uint256" },
              { name: "recipient", type: "address" },
              { name: "bridgeContract", type: "address" },
              { name: "bridgeData", type: "bytes" },
            ],
          },
          {
            name: "deposit",
            type: "tuple",
            components: [
              { name: "vault", type: "address" },
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
              { name: "minShares", type: "uint256" },
            ],
          },
          { name: "includeSwap", type: "bool" },
          { name: "includeBridge", type: "bool" },
          { name: "includeDeposit", type: "bool" },
        ],
      },
    ],
    outputs: [{ name: "operationHash", type: "bytes32" }],
  },
  {
    name: "swapWithPermit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "swap",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "dexRouter", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "previewSwap",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "swap",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "dexRouter", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "estimatedOutput", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
      { name: "netOutput", type: "uint256" },
      { name: "dexName", type: "string" },
      { name: "isWhitelisted", type: "bool" },
    ],
  },
  // Events
  {
    name: "SwapExecuted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: true },
      { name: "tokenOut", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "dexRouter", type: "address", indexed: false },
      { name: "path", type: "address[]", indexed: false },
    ],
  },
  {
    name: "ApprovalUsed",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "exactAmount", type: "uint256", indexed: false },
      { name: "purpose", type: "string", indexed: false },
    ],
  },
] as const;

export const NOVA_VAULT_ABI = [
  {
    name: "getUserInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "stakedAmount", type: "uint256" },
      { name: "sharesBalance", type: "uint256" },
      { name: "pendingRewards", type: "uint256" },
      { name: "lockEndTime", type: "uint256" },
      { name: "lockPeriod", type: "uint256" },
      { name: "bonusMultiplier", type: "uint256" },
      { name: "effectiveAPY", type: "uint256" },
    ],
  },
  {
    name: "getVaultStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalValueLocked", type: "uint256" },
      { name: "_totalShares", type: "uint256" },
      { name: "_rewardRate", type: "uint256" },
      { name: "_baseAPY", type: "uint256" },
      { name: "_availableRewards", type: "uint256" },
    ],
  },
  {
    name: "earned",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "lockPeriod", type: "uint256" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "claimReward",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  // Events
  {
    name: "Deposited",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
      { name: "lockPeriod", type: "uint256", indexed: false },
      { name: "lockEndTime", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Withdrawn",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "shares", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "penalty", type: "uint256", indexed: false },
      { name: "earlyWithdrawal", type: "bool", indexed: false },
    ],
  },
  {
    name: "RewardPaid",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_PERMIT_ABI = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { name: "DOMAIN_SEPARATOR", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "permit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

// ============================================
// CHAIN CONFIGURATION
// ============================================

export const SUPPORTED_CHAINS = {
  ethereum: mainnet,
  sepolia: sepolia,
  bsc: bsc,
  polygon: polygon,
  arbitrum: arbitrum,
  base: base,
} as const;

export type SupportedChain = keyof typeof SUPPORTED_CHAINS;

// Contract addresses per chain (to be filled with deployed addresses)
export const CONTRACT_ADDRESSES: Record<
  SupportedChain,
  {
    novaToken?: Address;
    airdrop?: Address;
    aggregator?: Address;
    vault?: Address;
    feeToken?: Address;
  }
> = {
  ethereum: {},
  sepolia: {
    // Testnet addresses - deploy and fill
    novaToken: "0x0000000000000000000000000000000000000000",
    airdrop: "0x0000000000000000000000000000000000000000",
    aggregator: "0x0000000000000000000000000000000000000000",
    vault: "0x0000000000000000000000000000000000000000",
    feeToken: "0x0000000000000000000000000000000000000000",
  },
  bsc: {},
  polygon: {},
  arbitrum: {},
  base: {},
};

// ============================================
// BLOCKCHAIN SERVICE CLASS
// ============================================

export class BlockchainService {
  private publicClient!: ReturnType<typeof createPublicClient>;

  private chain: SupportedChain;

  constructor(chain: SupportedChain, rpcUrl?: string) {
    this.chain = chain;

    // IMPORTANT: cast to avoid duplicate-viem-type TS2719 on some pnpm graphs
    this.publicClient = createPublicClient({
      chain: SUPPORTED_CHAINS[chain],
      transport: http(rpcUrl),
    }) as unknown as ReturnType<typeof createPublicClient>;
  }

  // ============================================
  // AIRDROP FUNCTIONS
  // ============================================

  async getAirdropStats() {
    const airdropAddress = CONTRACT_ADDRESSES[this.chain].airdrop;
    if (!airdropAddress) throw new Error("Airdrop not deployed on this chain");

    const stats = await this.publicClient.readContract({
      address: airdropAddress,
      abi: NOVA_AIRDROP_ABI,
      functionName: "getStats",
    });

    return {
      totalClaimed: stats[0],
      totalFeesCollected: stats[1],
      remainingTokens: stats[2],
      timeRemaining: stats[3],
      isActive: stats[4],
    };
  }

  async checkClaimEligibility(account: Address, amount: bigint, proof: `0x${string}`[]) {
    const airdropAddress = CONTRACT_ADDRESSES[this.chain].airdrop;
    if (!airdropAddress) throw new Error("Airdrop not deployed on this chain");

    const result = await this.publicClient.readContract({
      address: airdropAddress,
      abi: NOVA_AIRDROP_ABI,
      functionName: "canClaim",
      args: [account, amount, proof],
    });

    return {
      eligible: result[0],
      reason: result[1],
    };
  }

  async hasClaimed(account: Address): Promise<boolean> {
    const airdropAddress = CONTRACT_ADDRESSES[this.chain].airdrop;
    if (!airdropAddress) throw new Error("Airdrop not deployed on this chain");

    return this.publicClient.readContract({
      address: airdropAddress,
      abi: NOVA_AIRDROP_ABI,
      functionName: "hasClaimed",
      args: [account],
    });
  }

  async getClaimFee(): Promise<bigint> {
    const airdropAddress = CONTRACT_ADDRESSES[this.chain].airdrop;
    if (!airdropAddress) throw new Error("Airdrop not deployed on this chain");

    return this.publicClient.readContract({
      address: airdropAddress,
      abi: NOVA_AIRDROP_ABI,
      functionName: "claimFee",
    });
  }

  // ============================================
  // VAULT FUNCTIONS
  // ============================================

  async getVaultStats() {
    const vaultAddress = CONTRACT_ADDRESSES[this.chain].vault;
    if (!vaultAddress) throw new Error("Vault not deployed on this chain");

    const stats = await this.publicClient.readContract({
      address: vaultAddress,
      abi: NOVA_VAULT_ABI,
      functionName: "getVaultStats",
    });

    return {
      totalValueLocked: stats[0],
      totalShares: stats[1],
      rewardRate: stats[2],
      baseAPY: stats[3],
      availableRewards: stats[4],
    };
  }

  async getUserVaultInfo(account: Address) {
    const vaultAddress = CONTRACT_ADDRESSES[this.chain].vault;
    if (!vaultAddress) throw new Error("Vault not deployed on this chain");

    const info = await this.publicClient.readContract({
      address: vaultAddress,
      abi: NOVA_VAULT_ABI,
      functionName: "getUserInfo",
      args: [account],
    });

    return {
      stakedAmount: info[0],
      sharesBalance: info[1],
      pendingRewards: info[2],
      lockEndTime: info[3],
      lockPeriod: info[4],
      bonusMultiplier: info[5],
      effectiveAPY: info[6],
    };
  }

  // ============================================
  // TOKEN FUNCTIONS
  // ============================================

  async getTokenBalance(token: Address, account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: ERC20_PERMIT_ABI,
      functionName: "balanceOf",
      args: [account],
    });
  }

  async getTokenAllowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: ERC20_PERMIT_ABI,
      functionName: "allowance",
      args: [owner, spender],
    });
  }

  async getPermitNonce(token: Address, owner: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: ERC20_PERMIT_ABI,
      functionName: "nonces",
      args: [owner],
    });
  }

  async getTokenInfo(token: Address) {
    const [name, symbol, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: token,
        abi: ERC20_PERMIT_ABI,
        functionName: "name",
      }),
      this.publicClient.readContract({
        address: token,
        abi: ERC20_PERMIT_ABI,
        functionName: "symbol",
      }),
      this.publicClient.readContract({
        address: token,
        abi: ERC20_PERMIT_ABI,
        functionName: "decimals",
      }),
    ]);

    return { name, symbol, decimals };
  }
}

// Export singleton instance for default chain
let defaultService: BlockchainService | null = null;

export function getBlockchainService(chain: SupportedChain = "sepolia", rpcUrl?: string): BlockchainService {
  if (!defaultService || chain !== "sepolia") {
    defaultService = new BlockchainService(chain, rpcUrl);
  }
  return defaultService;
}
