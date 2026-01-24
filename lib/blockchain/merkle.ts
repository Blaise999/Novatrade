// Merkle Tree utility for NOVA Airdrop
// Generates and verifies Merkle proofs for airdrop eligibility

import { keccak256, encodePacked, getAddress, type Address } from 'viem';

/**
 * Airdrop allocation entry
 */
export interface AirdropAllocation {
  address: Address;
  amount: bigint;
}

/**
 * Merkle tree node
 */
interface MerkleNode {
  hash: `0x${string}`;
  left?: MerkleNode;
  right?: MerkleNode;
}

/**
 * Merkle proof result
 */
export interface MerkleProofResult {
  proof: `0x${string}`[];
  leaf: `0x${string}`;
  root: `0x${string}`;
  index: number;
}

/**
 * Generate a leaf hash from address and amount
 * Must match the contract: keccak256(abi.encodePacked(address, amount))
 */
export function generateLeaf(address: Address, amount: bigint): `0x${string}` {
  // Normalize address
  const normalizedAddress = getAddress(address);
  
  // Pack and hash (matches Solidity's abi.encodePacked)
  const packed = encodePacked(
    ['address', 'uint256'],
    [normalizedAddress, amount]
  );
  
  return keccak256(packed);
}

/**
 * Sort two hashes for consistent tree building
 */
function sortPair(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

/**
 * Hash two nodes together
 */
function hashPair(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
  const [left, right] = sortPair(a, b);
  return keccak256(encodePacked(['bytes32', 'bytes32'], [left, right]));
}

/**
 * Build a Merkle tree from allocations
 */
export function buildMerkleTree(allocations: AirdropAllocation[]): {
  root: `0x${string}`;
  leaves: `0x${string}`[];
  tree: `0x${string}`[][];
} {
  if (allocations.length === 0) {
    throw new Error('Cannot build tree with no allocations');
  }
  
  // Generate leaves
  const leaves = allocations.map(a => generateLeaf(a.address, a.amount));
  
  // Build tree layers
  const tree: `0x${string}`[][] = [leaves];
  let currentLayer = leaves;
  
  while (currentLayer.length > 1) {
    const nextLayer: `0x${string}`[] = [];
    
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left; // Duplicate if odd
      nextLayer.push(hashPair(left, right));
    }
    
    tree.push(nextLayer);
    currentLayer = nextLayer;
  }
  
  return {
    root: tree[tree.length - 1][0],
    leaves,
    tree
  };
}

/**
 * Generate Merkle proof for a specific allocation
 */
export function generateMerkleProof(
  allocations: AirdropAllocation[],
  targetAddress: Address
): MerkleProofResult | null {
  const normalizedTarget = getAddress(targetAddress);
  
  // Find the allocation
  const allocationIndex = allocations.findIndex(
    a => getAddress(a.address) === normalizedTarget
  );
  
  if (allocationIndex === -1) {
    return null; // Address not found
  }
  
  const allocation = allocations[allocationIndex];
  const { root, leaves, tree } = buildMerkleTree(allocations);
  
  const proof: `0x${string}`[] = [];
  let index = allocationIndex;
  
  // Walk up the tree, collecting sibling hashes
  for (let layer = 0; layer < tree.length - 1; layer++) {
    const currentLayer = tree[layer];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    
    if (siblingIndex < currentLayer.length) {
      proof.push(currentLayer[siblingIndex]);
    } else {
      // Odd layer, use self as sibling
      proof.push(currentLayer[index]);
    }
    
    index = Math.floor(index / 2);
  }
  
  return {
    proof,
    leaf: leaves[allocationIndex],
    root,
    index: allocationIndex
  };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(
  proof: `0x${string}`[],
  leaf: `0x${string}`,
  root: `0x${string}`
): boolean {
  let computedHash = leaf;
  
  for (const proofElement of proof) {
    computedHash = hashPair(computedHash, proofElement);
  }
  
  return computedHash.toLowerCase() === root.toLowerCase();
}

/**
 * Verify an allocation is in the tree
 */
export function verifyAllocation(
  address: Address,
  amount: bigint,
  proof: `0x${string}`[],
  root: `0x${string}`
): boolean {
  const leaf = generateLeaf(address, amount);
  return verifyMerkleProof(proof, leaf, root);
}

/**
 * Generate full airdrop data structure
 */
export interface AirdropData {
  merkleRoot: `0x${string}`;
  totalAmount: bigint;
  allocations: {
    address: Address;
    amount: bigint;
    leaf: `0x${string}`;
    proof: `0x${string}`[];
  }[];
}

export function generateAirdropData(
  allocations: AirdropAllocation[]
): AirdropData {
  const { root, leaves, tree } = buildMerkleTree(allocations);
  
  const totalAmount = allocations.reduce(
    (sum, a) => sum + a.amount,
    BigInt(0)
  );
  
  const enrichedAllocations = allocations.map((allocation, index) => {
    const proofResult = generateMerkleProof(allocations, allocation.address);
    
    return {
      address: getAddress(allocation.address),
      amount: allocation.amount,
      leaf: leaves[index],
      proof: proofResult?.proof || []
    };
  });
  
  return {
    merkleRoot: root,
    totalAmount,
    allocations: enrichedAllocations
  };
}

/**
 * Export airdrop data as JSON (for storage/API)
 */
export function exportAirdropJSON(data: AirdropData): string {
  return JSON.stringify({
    merkleRoot: data.merkleRoot,
    totalAmount: data.totalAmount.toString(),
    allocations: data.allocations.map(a => ({
      address: a.address,
      amount: a.amount.toString(),
      leaf: a.leaf,
      proof: a.proof
    }))
  }, null, 2);
}

/**
 * Import airdrop data from JSON
 */
export function importAirdropJSON(json: string): AirdropData {
  const parsed = JSON.parse(json);
  
  return {
    merkleRoot: parsed.merkleRoot as `0x${string}`,
    totalAmount: BigInt(parsed.totalAmount),
    allocations: parsed.allocations.map((a: any) => ({
      address: a.address as Address,
      amount: BigInt(a.amount),
      leaf: a.leaf as `0x${string}`,
      proof: a.proof as `0x${string}`[]
    }))
  };
}
