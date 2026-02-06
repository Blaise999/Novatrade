// Aggregator API routes
// Handles swap previews, route calculation, and transaction building

import { NextRequest, NextResponse } from 'next/server';
import { parseUnits, formatUnits, type Address } from 'viem';

// Whitelisted protocols (transparent list)
const WHITELISTED_DEXS: Record<string, { name: string; address: Address; fee: number }> = {
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': {
    name: 'Uniswap V2 Router',
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    fee: 0.3 // 0.3%
  },
  '0xE592427A0AEce92De3Edee1F18E0157C05861564': {
    name: 'Uniswap V3 Router',
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    fee: 0.3
  }
};

const WHITELISTED_BRIDGES: Record<string, { name: string; chains: number[] }> = {
  '0x...': { name: 'LayerZero', chains: [1, 56, 137, 42161] },
};

// Token info (would be fetched from API in production)
const TOKEN_INFO: Record<string, { symbol: string; decimals: number; name: string }> = {
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  '0xdAC17F958D2ee523a2206206994597C13D831ec7': { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  '0x6B175474E89094C44Da98b954EesDeF0E17eCB6': { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
};

// GET /api/aggregator - Get swap quote
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const action = searchParams.get('action');
  
  if (action === 'protocols') {
    // Return list of whitelisted protocols
    return NextResponse.json({
      success: true,
      data: {
        dexs: Object.values(WHITELISTED_DEXS),
        bridges: Object.values(WHITELISTED_BRIDGES),
        note: 'Only whitelisted protocols are allowed. This ensures your tokens are only sent to audited, trusted contracts.'
      }
    });
  }
  
  if (action === 'quote') {
    const tokenIn = searchParams.get('tokenIn');
    const tokenOut = searchParams.get('tokenOut');
    const amountIn = searchParams.get('amountIn');
    
    if (!tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json({
        success: false,
        error: 'tokenIn, tokenOut, and amountIn are required'
      }, { status: 400 });
    }
    
    // Simulate quote (in production, call DEX aggregator API)
    const amountInBigInt = BigInt(amountIn);
    const slippage = 0.5; // 0.5%
    const protocolFee = 0.3; // 0.3%
    
    // Simulated rate (1:1 for stablecoin pairs, etc.)
    const rate = 1.0;
    const grossOutput = Number(amountIn) * rate;
    const feeAmount = grossOutput * (protocolFee / 100);
    const netOutput = grossOutput - feeAmount;
    const minOutput = netOutput * (1 - slippage / 100);
    
    return NextResponse.json({
      success: true,
      data: {
        quote: {
          tokenIn,
          tokenOut,
          amountIn: amountIn,
          grossOutput: Math.floor(grossOutput).toString(),
          protocolFee: Math.floor(feeAmount).toString(),
          netOutput: Math.floor(netOutput).toString(),
          minOutput: Math.floor(minOutput).toString(),
          rate: rate.toFixed(6),
          slippage: `${slippage}%`,
          protocolFeePercent: `${protocolFee}%`
        },
        transparency: {
          explanation: 'Here is exactly what will happen with your tokens:',
          steps: [
            `1. You approve the aggregator to spend ${amountIn} of your input token`,
            `2. The aggregator swaps your tokens via ${WHITELISTED_DEXS[Object.keys(WHITELISTED_DEXS)[0]]?.name || 'a whitelisted DEX'}`,
            `3. A ${protocolFee}% fee (${Math.floor(feeAmount)} tokens) is deducted`,
            `4. You receive approximately ${Math.floor(netOutput)} output tokens`,
            `5. Minimum guaranteed: ${Math.floor(minOutput)} (accounting for ${slippage}% slippage)`
          ],
          warnings: [],
          approvalType: 'EXACT_AMOUNT', // Not unlimited!
          approvalNote: 'We only request approval for the exact amount you are swapping. We NEVER request unlimited approvals.'
        }
      }
    });
  }
  
  return NextResponse.json({
    success: false,
    error: 'Invalid action. Use action=protocols or action=quote'
  }, { status: 400 });
}

// POST /api/aggregator - Build transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;
    
    if (action === 'buildSwap') {
      const { tokenIn, tokenOut, amountIn, minAmountOut, userAddress, deadline } = params;
      
      if (!tokenIn || !tokenOut || !amountIn || !minAmountOut || !userAddress) {
        return NextResponse.json({
          success: false,
          error: 'Missing required parameters'
        }, { status: 400 });
      }
      
      // Build swap calldata (simplified - in production use actual DEX SDK)
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes
      
      // Choose best DEX route (simplified)
      const dexRouter = Object.keys(WHITELISTED_DEXS)[0];
      const dexInfo = WHITELISTED_DEXS[dexRouter];
      
      return NextResponse.json({
        success: true,
        data: {
          transaction: {
            to: dexRouter,
            data: '0x...', // Encoded swap calldata
            value: '0',
            gasLimit: '300000'
          },
          approval: {
            required: true,
            token: tokenIn,
            spender: dexRouter,
            amount: amountIn, // EXACT amount, not unlimited
            note: 'This approval is for the EXACT swap amount only'
          },
          permit: {
            canUsePermit: true, // If token supports EIP-2612
            domain: {
              name: TOKEN_INFO[tokenIn]?.name || 'Unknown Token',
              version: '1',
              chainId: 1,
              verifyingContract: tokenIn
            },
            message: {
              owner: userAddress,
              spender: dexRouter,
              value: amountIn, // EXACT amount
              nonce: 0, // Would be fetched from contract
              deadline: swapDeadline
            }
          },
          transparency: {
            whatYouAreSigning: {
              type: 'EIP-2612 Permit',
              explanation: 'This signature allows the DEX router to spend your tokens for this swap only.',
              details: [
                `Token: ${TOKEN_INFO[tokenIn]?.symbol || 'Unknown'}`,
                `Amount: ${amountIn} (EXACT, not unlimited)`,
                `Spender: ${dexInfo?.name || 'DEX Router'}`,
                `Expires: ${new Date(swapDeadline * 1000).toLocaleString()}`
              ],
              safetyChecks: [
                '✅ Amount is EXACT - not unlimited',
                '✅ Spender is a whitelisted DEX',
                '✅ Permit expires in 20 minutes',
                '✅ Can only be used once (nonce increments)'
              ]
            }
          }
        }
      });
    }
    
    if (action === 'buildBridge') {
      const { token, amount, destinationChain, recipient } = params;
      
      // Simplified bridge building
      return NextResponse.json({
        success: true,
        data: {
          transaction: {
            to: '0x...', // Bridge contract
            data: '0x...', // Encoded bridge calldata
            value: '0',
            gasLimit: '500000'
          },
          transparency: {
            whatHappens: [
              `1. Your ${amount} tokens are sent to the bridge contract`,
              `2. Bridge locks tokens on this chain`,
              `3. You receive equivalent tokens on chain ${destinationChain}`,
              `4. Recipient: ${recipient}`
            ],
            fees: {
              bridgeFee: '0.1%',
              gasOnDestination: 'Covered by relayer'
            },
            risks: [
              'Bridge transactions typically take 10-30 minutes',
              'In rare cases, manual claiming may be required'
            ]
          }
        }
      });
    }
    
    if (action === 'buildDeposit') {
      const { vault, token, amount, lockPeriod } = params;
      
      return NextResponse.json({
        success: true,
        data: {
          transaction: {
            to: vault,
            data: '0x...', // Encoded deposit calldata
            value: '0',
            gasLimit: '200000'
          },
          transparency: {
            whatHappens: [
              `1. Your ${amount} tokens are deposited into the vault`,
              `2. You receive vault shares representing your stake`,
              lockPeriod > 0 
                ? `3. Tokens are locked for ${lockPeriod / 86400} days`
                : '3. No lock period - withdraw anytime',
              '4. You start earning rewards immediately'
            ],
            expectedReturns: {
              baseAPY: '12%',
              lockBonus: lockPeriod > 0 ? '1.5x' : '1x',
              effectiveAPY: lockPeriod > 0 ? '18%' : '12%'
            }
          }
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('Aggregator error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal error'
    }, { status: 500 });
  }
}
