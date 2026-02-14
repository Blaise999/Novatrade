// hardhat.config.ts
// Hardhat configuration for NOVATrADE smart contracts

import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

const FORK_ENABLED = process.env.FORK_ENABLED === "true";
const ETH_RPC_URL = process.env.ETH_RPC_URL || "https://eth.llamarpc.com";

// ✅ IMPORTANT: no `: HardhatUserConfig` typing here.
// That typing is what was causing your “verify does not exist” / “type missing” TS errors.
const config = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },

  networks: {
    // Hardhat v3-style networks (keeps your earlier “type” requirement happy)
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
      forking: FORK_ENABLED ? { url: ETH_RPC_URL } : undefined,
    },

    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },

    // Mainnets
    ethereum: {
      type: "http",
      url: ETH_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 1,
    },
    bsc: {
      type: "http",
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      accounts: [PRIVATE_KEY],
      chainId: 56,
    },
    polygon: {
      type: "http",
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    arbitrum: {
      type: "http",
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 42161,
    },
    base: {
      type: "http",
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 8453,
    },

    // Testnets
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    bscTestnet: {
      type: "http",
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [PRIVATE_KEY],
      chainId: 97,
    },
  },

  // Keep the classic etherscan config (works with common verify plugin setups)
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
      bscTestnet: BSCSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
      base: BASESCAN_API_KEY,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
