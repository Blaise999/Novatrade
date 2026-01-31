// scripts/deploy.ts
// Deployment script for all NOVATrADE contracts

import "dotenv/config";

// Make sure the ethers plugin + typings are loaded for Hardhat
import "@nomicfoundation/hardhat-ethers";

import hre from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TS-safe access to hre.ethers (your typings currently don’t include it)
const ethers = (hre as any).ethers;

// ============================================
// CONFIGURATION
// ============================================

interface DeploymentConfig {
  network: string;
  feeToken: string; // USDC or equivalent
  feeTokenDecimals: number;
  claimFee: string; // In fee token units (e.g., 100000 = $0.10 USDC)
  treasury: string;
  airdropDeadline: number; // Unix timestamp
  platformFeeBps: number; // Basis points for aggregator fee
  vaultAsset: string; // Stablecoin for vault
}

const configs: Record<string, DeploymentConfig> = {
  ethereum: {
    network: "ethereum",
    feeToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    feeTokenDecimals: 6,
    claimFee: "100000", // $0.10
    treasury: "", // Set before deployment!
    airdropDeadline: Math.floor(new Date("2025-06-30").getTime() / 1000),
    platformFeeBps: 30, // 0.3%
    vaultAsset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  },
  bsc: {
    network: "bsc",
    feeToken: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC on BSC
    feeTokenDecimals: 18, // BSC USDC has 18 decimals
    claimFee: "100000000000000000", // $0.10 with 18 decimals
    treasury: "",
    airdropDeadline: Math.floor(new Date("2025-06-30").getTime() / 1000),
    platformFeeBps: 30,
    vaultAsset: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  },
  sepolia: {
    network: "sepolia",
    feeToken: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
    feeTokenDecimals: 6,
    claimFee: "100000",
    treasury: "",
    airdropDeadline: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    platformFeeBps: 30,
    vaultAsset: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

// ============================================
// AIRDROP DATA GENERATION
// ============================================

interface AirdropAllocation {
  address: string;
  amount: string; // In wei (18 decimals)
}

// Example airdrop allocations - replace with real data!
const AIRDROP_ALLOCATIONS: AirdropAllocation[] = [
  // Tier 1: Early adopters (1000 NOVA each)
  { address: "0x1234567890123456789012345678901234567890", amount: ethers.parseEther("1000").toString() },
  { address: "0x2345678901234567890123456789012345678901", amount: ethers.parseEther("1000").toString() },
  { address: "0x3456789012345678901234567890123456789012", amount: ethers.parseEther("1000").toString() },

  // Tier 2: Active traders (500 NOVA each)
  { address: "0x4567890123456789012345678901234567890123", amount: ethers.parseEther("500").toString() },
  { address: "0x5678901234567890123456789012345678901234", amount: ethers.parseEther("500").toString() },

  // Tier 3: Community members (100 NOVA each)
  { address: "0x6789012345678901234567890123456789012345", amount: ethers.parseEther("100").toString() },
  { address: "0x7890123456789012345678901234567890123456", amount: ethers.parseEther("100").toString() },
  { address: "0x8901234567890123456789012345678901234567", amount: ethers.parseEther("100").toString() },

  // Add more addresses as needed...
];

function generateMerkleTree(allocations: AirdropAllocation[]) {
  // Create leaves: keccak256(abi.encodePacked(address, amount))
  const leaves = allocations.map(({ address, amount }) => {
    const packed = ethers.solidityPacked(["address", "uint256"], [address, amount]);
    return keccak256(packed);
  });

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  const proofs: Record<string, { amount: string; proof: string[] }> = {};

  allocations.forEach(({ address, amount }, index) => {
    const leaf = leaves[index];
    const proof = tree.getHexProof(leaf);
    proofs[address.toLowerCase()] = { amount, proof };
  });

  return { root, proofs, tree };
}

// ============================================
// DEPLOYMENT
// ============================================

async function main() {
  const [deployer] = await ethers.getSigners();

  // Use Hardhat's network name so it matches your configs keys
  const networkName: string = (hre as any).network?.name || "hardhat";

  console.log("\n" + "=".repeat(60));
  console.log("NOVATrADE Contract Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("=".repeat(60) + "\n");

  // Get config for network (default to sepolia for testing)
  const config = configs[networkName] || configs.sepolia;

  // Use deployer as treasury if not set
  const treasury = config.treasury || deployer.address;

  // Generate Merkle tree
  console.log("📊 Generating Merkle tree for airdrop...");
  const { root: merkleRoot, proofs } = generateMerkleTree(AIRDROP_ALLOCATIONS);
  console.log(`   Merkle Root: ${merkleRoot}`);
  console.log(`   Total addresses: ${AIRDROP_ALLOCATIONS.length}`);

  // Save proofs to file
  const proofsPath = path.join(__dirname, `../data/airdrop-proofs-${networkName}.json`);
  fs.mkdirSync(path.dirname(proofsPath), { recursive: true });
  fs.writeFileSync(proofsPath, JSON.stringify(proofs, null, 2));
  console.log(`   Proofs saved to: ${proofsPath}\n`);

  // 1. Deploy NOVA Token
  console.log("🪙 Deploying NOVA Token...");
  const NOVAToken = await ethers.getContractFactory("NOVAToken");
  const novaToken = await NOVAToken.deploy(deployer.address);
  await novaToken.waitForDeployment();
  const novaTokenAddress = await novaToken.getAddress();
  console.log(`   ✅ NOVAToken deployed: ${novaTokenAddress}\n`);

  // 2. Deploy Airdrop Contract
  console.log("🎁 Deploying Airdrop Contract...");
  const NOVAAirdrop = await ethers.getContractFactory("NOVAAirdrop");
  const airdrop = await NOVAAirdrop.deploy(
    novaTokenAddress, // NOVA token
    config.feeToken, // Fee token (USDC)
    treasury, // Treasury
    merkleRoot, // Merkle root
    config.claimFee, // Claim fee
    config.airdropDeadline, // Deadline
    deployer.address // Owner
  );
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log(`   ✅ NOVAAirdrop deployed: ${airdropAddress}`);

  // Configure lottery
  console.log("   Configuring lottery...");
  await airdrop.configureLottery(
    true, // enabled
    1000, // 10% chance (1000 bps)
    ethers.parseEther("0.1"), // min prize 0.1 BNB
    ethers.parseEther("0.5") // max prize 0.5 BNB
  );
  console.log(`   ✅ Lottery configured: 10% chance, 0.1-0.5 BNB prizes\n`);

  // 3. Deploy DeFi Aggregator
  console.log("🔄 Deploying DeFi Aggregator...");
  const NOVADeFiAggregator = await ethers.getContractFactory("NOVADeFiAggregator");
  const aggregator = await NOVADeFiAggregator.deploy(
    treasury, // Fee recipient
    config.platformFeeBps, // Platform fee (0.3%)
    deployer.address // Owner
  );
  await aggregator.waitForDeployment();
  const aggregatorAddress = await aggregator.getAddress();
  console.log(`   ✅ NOVADeFiAggregator deployed: ${aggregatorAddress}\n`);

  // 4. Deploy Yield Vault
  console.log("🏦 Deploying Yield Vault...");
  const NOVAYieldVault = await ethers.getContractFactory("NOVAYieldVault");
  const vault = await NOVAYieldVault.deploy(
    config.vaultAsset, // Underlying asset (USDC)
    "NOVA Yield Vault", // Name
    "nvUSDC", // Symbol
    treasury, // Fee recipient
    deployer.address // Owner
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ NOVAYieldVault deployed: ${vaultAddress}\n`);

  // 5. Setup Permissions
  console.log("🔐 Setting up permissions...");

  await novaToken.addMinter(airdropAddress);
  console.log("   ✅ Airdrop added as NOVA minter");

  const airdropFunding = ethers.parseEther("10000000"); // 10M NOVA
  await novaToken.mint(airdropAddress, airdropFunding);
  console.log(`   ✅ Airdrop funded with ${ethers.formatEther(airdropFunding)} NOVA`);

  await aggregator.whitelistProtocol(vaultAddress, "NOVA Yield Vault", "Vault", true);
  console.log("   ✅ Vault whitelisted in aggregator\n");

  // 6. Save Deployment Info
  const deploymentInfo = {
    network: networkName,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      NOVAToken: novaTokenAddress,
      NOVAAirdrop: airdropAddress,
      NOVADeFiAggregator: aggregatorAddress,
      NOVAYieldVault: vaultAddress,
    },
    config: {
      merkleRoot,
      claimFee: config.claimFee,
      feeToken: config.feeToken,
      airdropDeadline: config.airdropDeadline,
      airdropDeadlineFormatted: new Date(config.airdropDeadline * 1000).toISOString(),
      platformFeeBps: config.platformFeeBps,
    },
    treasury,
    airdropStats: {
      totalAllocations: AIRDROP_ALLOCATIONS.length,
      totalTokens: AIRDROP_ALLOCATIONS.reduce(
        (sum, a) => sum + BigInt(a.amount),
        BigInt(0)
      ).toString(),
    },
  };

  const deploymentPath = path.join(__dirname, `../data/deployment-${networkName}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📁 Deployment info saved to: ${deploymentPath}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log(`  NOVA Token:      ${novaTokenAddress}`);
  console.log(`  Airdrop:         ${airdropAddress}`);
  console.log(`  DeFi Aggregator: ${aggregatorAddress}`);
  console.log(`  Yield Vault:     ${vaultAddress}`);
  console.log("\nNext Steps:");
  console.log("  1. Verify contracts on Etherscan");
  console.log("  2. Fund airdrop contract with BNB for lottery");
  console.log("  3. Update frontend .env with contract addresses");
  console.log("  4. Run security audit before mainnet deployment");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
