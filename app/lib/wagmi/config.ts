/**
 * WAGMI V2 + RAINBOWKIT CONFIGURATION
 * 
 * Real wallet connection - NOT a demo!
 * Supports Ethereum Mainnet and Sepolia testnet
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';

// WalletConnect Project ID from environment
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!projectId) {
  console.warn(
    '⚠️ WalletConnect Project ID not set!\n' +
    'Get one at: https://cloud.walletconnect.com\n' +
    'Add to .env.local: NEXT_PUBLIC_WC_PROJECT_ID=your-project-id'
  );
}

export const config = getDefaultConfig({
  appName: 'Nova Trade',
  projectId: projectId || 'YOUR_PROJECT_ID', // Fallback for build
  chains: [mainnet, sepolia],
  ssr: true, // Required for Next.js to prevent hydration errors
});

// Export chains for use elsewhere
export const supportedChains = [mainnet, sepolia];
