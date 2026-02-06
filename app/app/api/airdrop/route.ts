// Airdrop API Routes - FULLY TRANSPARENT
// Every response includes detailed explanations of what will happen

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { AirdropDb, TransactionDb } from '@/lib/db';
import { 
  getAirdropMerkleRoot, 
  getAirdropProof, 
  getAirdropAllocation, 
  isAirdropEligible,
  buildPermitTypedData,
  explainTransaction,
  verifyMerkleProof,
  buildMerkleTree,
  type MerkleLeaf
} from '@/lib/blockchain';
import { sendAirdropClaimedEmail } from '@/lib/email';
import crypto from 'crypto';

// ============================================
// AIRDROP CONFIGURATION
// ============================================

const AIRDROP_CONFIG = {
  id: 'nova-season1',
  name: 'NOVA Airdrop Season 1',
  description: 'Claim your NOVA tokens from the Season 1 airdrop. A small claim fee is required.',
  totalPool: '10000000', // 10M NOVA (human readable)
  totalPoolWei: '10000000000000000000000000', // 10M with 18 decimals
  claimFee: '0.10', // Human readable
  claimFeeWei: '100000', // $0.10 USDC (6 decimals)
  feeToken: 'USDC',
  feeTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  feeTokenDecimals: 6,
  novaTokenAddress: process.env.NOVA_TOKEN_ADDRESS || '0x...NovaTokenAddress',
  airdropContract: process.env.AIRDROP_CONTRACT || '0x...AirdropContractAddress',
  chainId: parseInt(process.env.CHAIN_ID || '1'),
  chainName: 'Ethereum',
  deadline: new Date('2025-06-30').getTime() / 1000,
  lotteryEnabled: true,
  lotteryChance: 10, // 10% chance
  lotteryMinPrize: '0.1', // 0.1 BNB
  lotteryMaxPrize: '0.5', // 0.5 BNB
};

// ============================================
// GET /api/airdrop/*
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams, pathname } = request.nextUrl;
    
    // ==========================================
    // GET /api/airdrop - Main info
    // ==========================================
    if (pathname === '/api/airdrop' || pathname === '/api/airdrop/') {
      return NextResponse.json({
        success: true,
        airdrop: {
          id: AIRDROP_CONFIG.id,
          name: AIRDROP_CONFIG.name,
          description: AIRDROP_CONFIG.description,
          totalPool: AIRDROP_CONFIG.totalPool,
          claimFee: `${AIRDROP_CONFIG.claimFee} ${AIRDROP_CONFIG.feeToken}`,
          deadline: new Date(AIRDROP_CONFIG.deadline * 1000).toISOString(),
          lottery: {
            enabled: AIRDROP_CONFIG.lotteryEnabled,
            chance: `${AIRDROP_CONFIG.lotteryChance}%`,
            prize: `${AIRDROP_CONFIG.lotteryMinPrize} - ${AIRDROP_CONFIG.lotteryMaxPrize} BNB`,
          },
          contracts: {
            airdrop: AIRDROP_CONFIG.airdropContract,
            novaToken: AIRDROP_CONFIG.novaTokenAddress,
            feeToken: AIRDROP_CONFIG.feeTokenAddress,
          },
          chain: {
            id: AIRDROP_CONFIG.chainId,
            name: AIRDROP_CONFIG.chainName,
          },
        },
        merkleRoot: getAirdropMerkleRoot(),
      });
    }
    
    // ==========================================
    // GET /api/airdrop/eligibility?address=0x...
    // ==========================================
    if (pathname.includes('/eligibility')) {
      const address = searchParams.get('address');
      
      if (!address) {
        return NextResponse.json(
          { success: false, error: 'Wallet address required. Use ?address=0x...' },
          { status: 400 }
        );
      }
      
      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return NextResponse.json(
          { success: false, error: 'Invalid Ethereum address format' },
          { status: 400 }
        );
      }
      
      const eligible = isAirdropEligible(address);
      const allocation = getAirdropAllocation(address);
      const hasClaimed = AirdropDb.hasClaimed(address, AIRDROP_CONFIG.id);
      
      if (!eligible) {
        return NextResponse.json({
          success: true,
          address,
          eligible: false,
          hasClaimed: false,
          allocation: '0',
          message: 'This address is not eligible for the airdrop. Eligibility was based on early platform usage and holding requirements.',
        });
      }
      
      if (hasClaimed) {
        const claim = AirdropDb.getByUserId(address).find(c => c.airdropId === AIRDROP_CONFIG.id);
        return NextResponse.json({
          success: true,
          address,
          eligible: true,
          hasClaimed: true,
          allocation,
          claimDetails: claim ? {
            amount: claim.amount,
            txHash: claim.txHash,
            claimedAt: claim.claimedAt,
            wonLottery: claim.wonLottery,
            lotteryPrize: claim.lotteryPrize,
          } : null,
          message: 'You have already claimed this airdrop.',
        });
      }
      
      return NextResponse.json({
        success: true,
        address,
        eligible: true,
        hasClaimed: false,
        allocation,
        allocationFormatted: `${parseInt(allocation!) / 1e18} NOVA`,
        claimFee: AIRDROP_CONFIG.claimFee,
        feeToken: AIRDROP_CONFIG.feeToken,
        deadline: new Date(AIRDROP_CONFIG.deadline * 1000).toISOString(),
        message: 'Congratulations! You are eligible for the airdrop.',
      });
    }
    
    // ==========================================
    // GET /api/airdrop/proof?address=0x...
    // RETURNS: Full claim data with TRANSPARENCY INFO
    // ==========================================
    if (pathname.includes('/proof')) {
      const address = searchParams.get('address');
      
      if (!address) {
        return NextResponse.json(
          { success: false, error: 'Address required' },
          { status: 400 }
        );
      }
      
      const proof = getAirdropProof(address);
      const allocation = getAirdropAllocation(address);
      
      if (!proof || !allocation) {
        return NextResponse.json(
          { success: false, error: 'Address not in airdrop list' },
          { status: 404 }
        );
      }
      
      // Check if already claimed
      if (AirdropDb.hasClaimed(address, AIRDROP_CONFIG.id)) {
        return NextResponse.json(
          { success: false, error: 'Already claimed' },
          { status: 400 }
        );
      }
      
      // Build permit typed data
      const permitDeadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
      const permitData = buildPermitTypedData(
        {
          name: AIRDROP_CONFIG.feeToken,
          version: '2', // USDC uses version 2
          chainId: AIRDROP_CONFIG.chainId,
          verifyingContract: AIRDROP_CONFIG.feeTokenAddress,
        },
        {
          owner: address,
          spender: AIRDROP_CONFIG.airdropContract,
          value: AIRDROP_CONFIG.claimFeeWei,
          nonce: 0, // Frontend should fetch actual nonce from contract
          deadline: permitDeadline,
        }
      );
      
      // Build contract call data
      const claimFunctionData = {
        function: 'claimWithPermit',
        parameters: {
          amount: allocation,
          proof: proof,
          deadline: permitDeadline,
          // v, r, s will come from the signed permit
        },
      };
      
      return NextResponse.json({
        success: true,
        
        // Basic claim info
        address,
        allocation,
        allocationFormatted: `${parseInt(allocation) / 1e18} NOVA`,
        proof,
        merkleRoot: getAirdropMerkleRoot(),
        
        // Contract interaction data
        contract: {
          address: AIRDROP_CONFIG.airdropContract,
          chainId: AIRDROP_CONFIG.chainId,
          chainName: AIRDROP_CONFIG.chainName,
        },
        
        // Permit data for signing
        permit: {
          typedData: permitData,
          deadline: permitDeadline,
          deadlineFormatted: new Date(permitDeadline * 1000).toISOString(),
          feeAmount: AIRDROP_CONFIG.claimFeeWei,
          feeFormatted: `${AIRDROP_CONFIG.claimFee} ${AIRDROP_CONFIG.feeToken}`,
        },
        
        // ==================================================
        // 🔍 COMPLETE TRANSPARENCY - READ THIS CAREFULLY!
        // ==================================================
        transparency: {
          summary: 'Claiming this airdrop requires signing ONE permit and ONE transaction.',
          
          step1_permit: {
            title: 'Sign Permit (Gasless Fee Approval)',
            whatItDoes: [
              `Allows the airdrop contract to spend EXACTLY ${AIRDROP_CONFIG.claimFee} ${AIRDROP_CONFIG.feeToken} from your wallet`,
              'This is NOT unlimited approval - only the exact fee amount',
              `Expires in 20 minutes (${new Date(permitDeadline * 1000).toLocaleString()})`,
              'No gas required for signing (EIP-2612 standard)',
            ],
            whatToVerify: [
              `VALUE should be exactly ${AIRDROP_CONFIG.claimFeeWei} (= ${AIRDROP_CONFIG.claimFee} ${AIRDROP_CONFIG.feeToken})`,
              `SPENDER should be ${AIRDROP_CONFIG.airdropContract}`,
              'DEADLINE should be ~20 minutes from now, not years in the future',
            ],
            redFlags: [
              '🚩 If value is a huge number like 115792089237316195423570985008687907853269984665640564039457584007913129639935, DO NOT SIGN - that is unlimited approval',
              '🚩 If deadline is far in the future (months/years), DO NOT SIGN',
              '🚩 If spender is not the official airdrop contract, DO NOT SIGN',
            ],
          },
          
          step2_claim: {
            title: 'Submit Claim Transaction',
            whatItDoes: [
              `Transfers ${AIRDROP_CONFIG.claimFee} ${AIRDROP_CONFIG.feeToken} from your wallet to the treasury`,
              'Verifies your Merkle proof to confirm eligibility',
              `Sends ${parseInt(allocation) / 1e18} NOVA tokens directly to YOUR wallet`,
              'Enters you in the BNB lottery (10% chance to win)',
            ],
            whatToVerify: [
              'Transaction is to the official airdrop contract',
              'You are on the official NOVATrADE website (check URL)',
              'Your connected wallet is the eligible address',
            ],
          },
          
          safetyFeatures: [
            '✅ Permit is for EXACT fee amount, not unlimited',
            '✅ Permit expires in 20 minutes',
            '✅ NOVA tokens go directly to YOUR wallet (msg.sender)',
            '✅ Merkle proof ensures only eligible addresses can claim',
            '✅ Contract is verified on Etherscan',
            '✅ One-time claim - prevents double claiming',
          ],
          
          whatWeNeverDo: [
            '❌ We NEVER request unlimited approvals',
            '❌ We NEVER hold your tokens in our contract',
            '❌ We NEVER send tokens to any address except yours',
            '❌ We NEVER use long-dated permits',
          ],
        },
        
        // Function call data (for advanced users)
        functionCall: claimFunctionData,
      });
    }
    
    // ==========================================
    // GET /api/airdrop/stats
    // ==========================================
    if (pathname.includes('/stats')) {
      const stats = AirdropDb.getStats(AIRDROP_CONFIG.id);
      const daysRemaining = Math.max(0, Math.floor((AIRDROP_CONFIG.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
      
      return NextResponse.json({
        success: true,
        stats: {
          totalClaims: stats.totalClaims,
          totalAmountClaimed: stats.totalAmount,
          totalAmountClaimedFormatted: `${stats.totalAmount / 1e18} NOVA`,
          lotteryWinners: stats.lotteryWinners,
          totalLotteryPrize: stats.totalLotteryPrize,
          totalLotteryPrizeFormatted: `${stats.totalLotteryPrize} BNB`,
          percentClaimed: ((stats.totalAmount / parseFloat(AIRDROP_CONFIG.totalPoolWei)) * 100).toFixed(2) + '%',
          daysRemaining,
          deadline: new Date(AIRDROP_CONFIG.deadline * 1000).toISOString(),
        },
      });
    }
    
    // ==========================================
    // GET /api/airdrop/verify-proof
    // For users to manually verify their proof
    // ==========================================
    if (pathname.includes('/verify-proof')) {
      const address = searchParams.get('address');
      const amount = searchParams.get('amount');
      const proofJson = searchParams.get('proof');
      
      if (!address || !amount || !proofJson) {
        return NextResponse.json(
          { success: false, error: 'address, amount, and proof parameters required' },
          { status: 400 }
        );
      }
      
      try {
        const proof = JSON.parse(proofJson);
        const root = getAirdropMerkleRoot();
        const isValid = verifyMerkleProof(address, amount, proof, root);
        
        return NextResponse.json({
          success: true,
          verification: {
            address,
            amount,
            proof,
            merkleRoot: root,
            isValid,
            message: isValid 
              ? '✅ Proof is valid! This address is eligible for the stated amount.'
              : '❌ Proof is invalid. Either the address, amount, or proof is incorrect.',
          },
        });
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'Invalid proof format. Must be JSON array of hex strings.' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown endpoint' },
      { status: 404 }
    );
    
  } catch (error: any) {
    console.error('[Airdrop API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/airdrop/claim
// Records a successful on-chain claim
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      address, 
      amount, 
      txHash, 
      feePaid,
      wonLottery = false,
      lotteryPrize = 0,
    } = body;
    
    // Validation
    if (!address || !amount || !txHash) {
      return NextResponse.json(
        { success: false, error: 'address, amount, and txHash are required' },
        { status: 400 }
      );
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }
    
    // Validate txHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction hash' },
        { status: 400 }
      );
    }
    
    // Check if already claimed
    if (AirdropDb.hasClaimed(address, AIRDROP_CONFIG.id)) {
      return NextResponse.json(
        { success: false, error: 'This address has already claimed' },
        { status: 400 }
      );
    }
    
    // Verify eligibility
    const proof = getAirdropProof(address);
    if (!proof) {
      return NextResponse.json(
        { success: false, error: 'Address not eligible for airdrop' },
        { status: 400 }
      );
    }
    
    // Record claim
    const claim = AirdropDb.create({
      oderId: address.toLowerCase(),
      airdropId: AIRDROP_CONFIG.id,
      amount: parseFloat(amount),
      token: 'NOVA',
      feePaid: parseFloat(feePaid || AIRDROP_CONFIG.claimFee),
      feeToken: AIRDROP_CONFIG.feeToken,
      txHash,
      merkleProof: proof,
      wonLottery,
      lotteryPrize: parseFloat(lotteryPrize) || 0,
      status: 'claimed',
      claimedAt: new Date().toISOString(),
    });
    
    // Try to send email if user is authenticated
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const { user } = await authenticateRequest(authHeader);
      if (user?.email) {
        try {
          await sendAirdropClaimedEmail(user.email, {
            name: user.name,
            tokenAmount: (parseFloat(amount) / 1e18).toString(),
            tokenSymbol: 'NOVA',
            bnbWon: wonLottery,
            bnbAmount: lotteryPrize.toString(),
            txHash,
          });
        } catch (e) {
          console.error('Failed to send airdrop email:', e);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Airdrop claim recorded successfully!',
      claim: {
        id: claim.id,
        address,
        amount: parseFloat(amount) / 1e18,
        amountFormatted: `${parseFloat(amount) / 1e18} NOVA`,
        txHash,
        wonLottery,
        lotteryPrize: wonLottery ? lotteryPrize : 0,
        claimedAt: claim.claimedAt,
      },
      viewTransaction: `https://etherscan.io/tx/${txHash}`,
    });
    
  } catch (error: any) {
    console.error('[Airdrop API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
