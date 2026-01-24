// Blockchain module exports
// Centralized exports for all blockchain utilities

// Merkle tree utilities
export {
  generateLeaf,
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  verifyAllocation,
  generateAirdropData,
  exportAirdropJSON,
  importAirdropJSON,
  type AirdropAllocation,
  type MerkleProofResult,
  type AirdropData
} from './merkle';

// Contract ABIs and service
export {
  NOVA_AIRDROP_ABI,
  NOVA_AGGREGATOR_ABI,
  NOVA_VAULT_ABI,
  ERC20_PERMIT_ABI,
  SUPPORTED_CHAINS,
  CONTRACT_ADDRESSES,
  BlockchainService,
  getBlockchainService,
  type SupportedChain
} from './contracts';

// Permit utilities
export {
  buildPermitTypedData,
  parseSignature,
  createPermitRequest,
  generatePermitExplanation,
  PERMIT_SCENARIOS,
  type PermitData,
  type PermitDomain,
  type PermitSignature,
  type PermitRequest,
  type PermitScenario
} from './permit';
