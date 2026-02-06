// useBlockchain.ts
// React hooks for transparent blockchain interactions
// Every function shows users exactly what they're signing

import { useState, useCallback } from 'react';
import { 
  buildAirdropClaimExplanation, 
  buildSwapExplanation,
  type TransactionExplanation 
} from '@/components/TransparentSigner';

// ============================================
// TYPES
// ============================================

interface UseBlockchainReturn {
  // State
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isLoading: boolean;
  error: string | null;
  
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
  
  // Airdrop
  checkAirdropEligibility: (address: string) => Promise<AirdropEligibility | null>;
  getAirdropClaimData: (address: string) => Promise<AirdropClaimData | null>;
  claimAirdrop: (claimData: AirdropClaimData) => Promise<ClaimResult>;
  
  // Swap
  prepareSwap: (params: SwapPrepareParams) => Promise<SwapData | null>;
  executeSwap: (swapData: SwapData) => Promise<SwapResult>;
  
  // Permit
  signPermit: (params: PermitParams) => Promise<PermitSignature | null>;
  
  // Transaction explanation
  getTransactionExplanation: (type: string, params: any) => TransactionExplanation;
}

interface AirdropEligibility {
  eligible: boolean;
  allocation: string;
  allocationFormatted: string;
  hasClaimed: boolean;
  claimFee: string;
  feeToken: string;
}

interface AirdropClaimData {
  address: string;
  allocation: string;
  proof: string[];
  merkleRoot: string;
  permit: {
    typedData: any;
    deadline: number;
    feeAmount: string;
  };
  contract: {
    address: string;
    chainId: number;
  };
  transparency: any;
}

interface ClaimResult {
  success: boolean;
  txHash?: string;
  amount?: string;
  wonLottery?: boolean;
  lotteryPrize?: string;
  error?: string;
}

interface SwapPrepareParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number; // in percentage (0.5 = 0.5%)
}

interface SwapData {
  params: SwapPrepareParams;
  estimatedOutput: string;
  minOutput: string;
  fee: string;
  dex: string;
  dexName: string;
  permit: {
    typedData: any;
    deadline: number;
  };
  calldata: string;
}

interface SwapResult {
  success: boolean;
  txHash?: string;
  amountIn?: string;
  amountOut?: string;
  error?: string;
}

interface PermitParams {
  token: string;
  spender: string;
  value: string;
  deadline: number;
  nonce: number;
}

interface PermitSignature {
  v: number;
  r: string;
  s: string;
  deadline: number;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useBlockchain(): UseBlockchainReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==========================================
  // CONNECTION FUNCTIONS
  // ==========================================

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
      }
      
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const chainIdHex = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });
      
      setAddress(accounts[0]);
      setChainId(parseInt(chainIdHex, 16));
      setIsConnected(true);
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          setAddress(accounts[0]);
        }
      });
      
      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainIdHex: string) => {
        setChainId(parseInt(chainIdHex, 16));
      });
      
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setChainId(null);
  }, []);

  const switchChain = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (err: any) {
      // Chain not added, try to add it
      if (err.code === 4902) {
        // Would add chain here with wallet_addEthereumChain
        throw new Error('Please add this network to your wallet');
      }
      throw err;
    }
  }, []);

  // ==========================================
  // AIRDROP FUNCTIONS
  // ==========================================

  const checkAirdropEligibility = useCallback(async (
    userAddress: string
  ): Promise<AirdropEligibility | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/airdrop/eligibility?address=${userAddress}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return {
        eligible: data.eligible,
        allocation: data.allocation,
        allocationFormatted: data.allocationFormatted || `${parseInt(data.allocation) / 1e18} NOVA`,
        hasClaimed: data.hasClaimed,
        claimFee: data.claimFee || '0.10',
        feeToken: data.feeToken || 'USDC',
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAirdropClaimData = useCallback(async (
    userAddress: string
  ): Promise<AirdropClaimData | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/airdrop/proof?address=${userAddress}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return {
        address: data.address,
        allocation: data.allocation,
        proof: data.proof,
        merkleRoot: data.merkleRoot,
        permit: data.permit,
        contract: data.contract,
        transparency: data.transparency,
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const claimAirdrop = useCallback(async (
    claimData: AirdropClaimData
  ): Promise<ClaimResult> => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!window.ethereum || !address) {
        throw new Error('Wallet not connected');
      }
      
      // Step 1: Sign the permit
      console.log('Step 1: Signing permit for claim fee...');
      
      const permitSignature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(claimData.permit.typedData)],
      });
      
      // Parse signature
      const sig = permitSignature.slice(2);
      const r = '0x' + sig.slice(0, 64);
      const s = '0x' + sig.slice(64, 128);
      const v = parseInt(sig.slice(128, 130), 16);
      
      console.log('Permit signed successfully');
      
      // Step 2: Call claim function
      console.log('Step 2: Submitting claim transaction...');
      
      // Build contract call data
      // In production, use ethers.js or viem to encode this properly
      const claimCallData = buildClaimCalldata(
        claimData.allocation,
        claimData.proof,
        claimData.permit.deadline,
        v,
        r,
        s
      );
      
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: claimData.contract.address,
          data: claimCallData,
        }],
      });
      
      console.log('Claim transaction submitted:', txHash);
      
      // Step 3: Record claim in backend
      const recordResponse = await fetch('/api/airdrop/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amount: claimData.allocation,
          txHash,
          feePaid: '0.10',
        }),
      });
      
      const recordData = await recordResponse.json();
      
      return {
        success: true,
        txHash,
        amount: `${parseInt(claimData.allocation) / 1e18} NOVA`,
        wonLottery: recordData.claim?.wonLottery,
        lotteryPrize: recordData.claim?.lotteryPrize,
      };
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to claim airdrop';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // ==========================================
  // SWAP FUNCTIONS
  // ==========================================

  const prepareSwap = useCallback(async (
    params: SwapPrepareParams
  ): Promise<SwapData | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In production, this would call a price aggregator API
      // For now, mock the response
      const estimatedOutput = (parseFloat(params.amountIn) * 0.98).toString(); // Mock 2% slippage
      const minOutput = (parseFloat(estimatedOutput) * (1 - params.slippage / 100)).toString();
      const fee = (parseFloat(params.amountIn) * 0.003).toString(); // 0.3% fee
      
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
      
      return {
        params,
        estimatedOutput,
        minOutput,
        fee,
        dex: '0x...UniswapRouter', // Would be real address
        dexName: 'Uniswap V3',
        permit: {
          typedData: buildPermitTypedData(
            params.tokenIn,
            address || '',
            '0x...AggregatorAddress',
            params.amountIn,
            deadline
          ),
          deadline,
        },
        calldata: '0x...', // Would be real calldata
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const executeSwap = useCallback(async (
    swapData: SwapData
  ): Promise<SwapResult> => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!window.ethereum || !address) {
        throw new Error('Wallet not connected');
      }
      
      // Sign permit
      const permitSignature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(swapData.permit.typedData)],
      });
      
      // Execute swap transaction
      // In production, would properly encode the swap call
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: swapData.dex,
          data: swapData.calldata,
        }],
      });
      
      return {
        success: true,
        txHash,
        amountIn: swapData.params.amountIn,
        amountOut: swapData.estimatedOutput,
      };
      
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // ==========================================
  // PERMIT FUNCTIONS
  // ==========================================

  const signPermit = useCallback(async (
    params: PermitParams
  ): Promise<PermitSignature | null> => {
    try {
      if (!window.ethereum || !address) {
        throw new Error('Wallet not connected');
      }
      
      const typedData = buildPermitTypedData(
        params.token,
        address,
        params.spender,
        params.value,
        params.deadline
      );
      
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      });
      
      const sig = signature.slice(2);
      return {
        v: parseInt(sig.slice(128, 130), 16),
        r: '0x' + sig.slice(0, 64),
        s: '0x' + sig.slice(64, 128),
        deadline: params.deadline,
      };
      
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [address]);

  // ==========================================
  // TRANSACTION EXPLANATION
  // ==========================================

  const getTransactionExplanation = useCallback((
    type: string,
    params: any
  ): TransactionExplanation => {
    switch (type) {
      case 'airdrop_claim':
        return buildAirdropClaimExplanation(
          params.tokenAmount,
          params.claimFee,
          params.feeToken,
          params.contractAddress,
          params.permitDeadline
        );
      
      case 'swap':
        return buildSwapExplanation(
          params.tokenInAmount,
          params.tokenInSymbol,
          params.tokenOutAmount,
          params.tokenOutSymbol,
          params.fee,
          params.dexName,
          params.permitDeadline
        );
      
      default:
        return {
          title: 'Unknown Transaction',
          summary: 'Please review carefully',
          whatYouPay: 'Unknown',
          whatYouReceive: 'Unknown',
          steps: [],
          safetyFeatures: [],
          risks: ['Unknown transaction type'],
        };
    }
  }, []);

  return {
    isConnected,
    address,
    chainId,
    isLoading,
    error,
    connect,
    disconnect,
    switchChain,
    checkAirdropEligibility,
    getAirdropClaimData,
    claimAirdrop,
    prepareSwap,
    executeSwap,
    signPermit,
    getTransactionExplanation,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildPermitTypedData(
  token: string,
  owner: string,
  spender: string,
  value: string,
  deadline: number
): any {
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
    domain: {
      name: 'Token', // Would be actual token name
      version: '1',
      chainId: 1,
      verifyingContract: token,
    },
    message: {
      owner,
      spender,
      value,
      nonce: 0, // Would fetch actual nonce
      deadline,
    },
  };
}

function buildClaimCalldata(
  amount: string,
  proof: string[],
  deadline: number,
  v: number,
  r: string,
  s: string
): string {
  // In production, use ethers.js:
  // const iface = new ethers.Interface(AirdropABI);
  // return iface.encodeFunctionData('claimWithPermit', [amount, proof, deadline, v, r, s]);
  
  // For now, return placeholder
  // This would be the actual encoded function call
  return '0x...';
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export default useBlockchain;
