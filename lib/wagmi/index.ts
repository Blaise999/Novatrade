/**
 * WAGMI / RAINBOWKIT EXPORTS
 * 
 * Import everything from here:
 *   import { Web3Provider, WalletButton, useAccount } from '@/lib/wagmi';
 */

// Config
export { config, supportedChains } from './config';

// Provider
export { Web3Provider } from './provider';

// Components
export { AccountInfo, WalletButton, NavConnectButton } from './AccountInfo';

// Re-export useful hooks from wagmi
export { 
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useEnsName,
  useEnsAvatar,
  useNetwork,
  useSwitchNetwork,
  useSignMessage,
  useSignTypedData,
  useSendTransaction,
  useWaitForTransaction,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
} from 'wagmi';

// Re-export RainbowKit ConnectButton
export { ConnectButton } from '@rainbow-me/rainbowkit';
