// lib/wagmi/index.ts
import {
  useAccount,
  useBalance,
  useChainId,
  useChains,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useSimulateContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";

// ✅ Re-export the real v2 hooks
export {
  useAccount,
  useBalance,
  useChainId,
  useChains,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useSimulateContract,
  usePublicClient,
  useWalletClient,
};

// ✅ Backwards-compatible names (so your old imports don’t crash)
export function useNetwork() {
  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  return { chain, chains };
}

export function useSwitchNetwork() {
  const sw = useSwitchChain();
  return {
    ...sw,
    switchNetwork: sw.switchChain,
    switchNetworkAsync: sw.switchChainAsync,
  };
}

export function useWaitForTransaction(args: Parameters<typeof useWaitForTransactionReceipt>[0]) {
  return useWaitForTransactionReceipt(args);
}

export function usePrepareContractWrite(args: Parameters<typeof useSimulateContract>[0]) {
  return useSimulateContract(args);
}
