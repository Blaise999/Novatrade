import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TradingAccount,
  StockPosition,
  MarginPosition,
  Order,
  Fill,
  LedgerEntry,
  Investment,
  AirdropParticipation,
  Deposit,
  Withdrawal,
  DepositAddress,
  calculateMarginPnL,
  calculateNewAvgEntry,
  calculateRequiredMargin,
  calculateMarginEquity,
  calculateLiquidationPrice,
} from './trading-types';

// ==========================================
// TRADING ACCOUNT STORE
// ==========================================

interface TradingAccountState {
  // Accounts
  spotAccount: TradingAccount | null;
  marginAccount: TradingAccount | null;
  
  // Positions
  stockPositions: StockPosition[];
  marginPositions: MarginPosition[];
  
  // Orders
  openOrders: Order[];
  orderHistory: Order[];
  fills: Fill[];
  
  // Ledger
  ledger: LedgerEntry[];
  
  // Account actions
  initializeAccounts: (userId: string) => void;
  updateSpotAccount: (updates: Partial<TradingAccount>) => void;
  updateMarginAccount: (updates: Partial<TradingAccount>) => void;
  
  // Admin actions
  adminAdjustBalance: (
    accountType: 'spot' | 'margin',
    amount: number,
    adminId: string,
    note: string
  ) => void;
  
  // Stock trading (Spot model)
  executeStockBuy: (
    symbol: string,
    name: string,
    qty: number,
    price: number,
    fee: number
  ) => { success: boolean; error?: string };
  
  executeStockSell: (
    positionId: string,
    qty: number,
    price: number,
    fee: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  updateStockPositionPrice: (symbol: string, price: number) => void;
  
  // Margin/FX trading
  openMarginPosition: (
    symbol: string,
    name: string,
    type: 'forex' | 'cfd' | 'crypto',
    side: 'long' | 'short',
    qty: number,
    price: number,
    leverage: number,
    fee: number,
    stopLoss?: number,
    takeProfit?: number
  ) => { success: boolean; error?: string };
  
  closeMarginPosition: (
    positionId: string,
    price: number,
    fee: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  reduceMarginPosition: (
    positionId: string,
    qty: number,
    price: number,
    fee: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  updateMarginPositionPrice: (symbol: string, price: number) => void;
  
  // Risk management
  checkLiquidation: () => string[];  // Returns position IDs to liquidate
  
  // Ledger
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => void;
  
  // Computed values
  calculateSpotEquity: () => number;
  calculateMarginEquity: () => number;
  calculateTotalUnrealizedPnL: () => number;
}

export const useTradingAccountStore = create<TradingAccountState>()(
  persist(
    (set, get) => ({
      spotAccount: null,
      marginAccount: null,
      stockPositions: [],
      marginPositions: [],
      openOrders: [],
      orderHistory: [],
      fills: [],
      ledger: [],
      
      initializeAccounts: (userId) => {
        const now = new Date();
        
        // Accounts start with $0 - Admin adds balance when user deposits/pays
        const spotAccount: TradingAccount = {
          id: `spot_${userId}`,
          userId,
          type: 'spot',
          cash: 0,
          equity: 0,
          availableToTrade: 0,
          availableToWithdraw: 0,
          balance: 0,
          marginUsed: 0,
          freeMargin: 0,
          leverage: 1,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        };
        
        // Margin account also starts with $0
        const marginAccount: TradingAccount = {
          id: `margin_${userId}`,
          userId,
          type: 'margin',
          cash: 0,
          equity: 0,
          availableToTrade: 0,
          availableToWithdraw: 0,
          balance: 0,
          marginUsed: 0,
          freeMargin: 0,
          leverage: 100,
          marginLevel: undefined,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        };
        
        set({ spotAccount, marginAccount });
      },
      
      updateSpotAccount: (updates) => {
        set((state) => ({
          spotAccount: state.spotAccount
            ? { ...state.spotAccount, ...updates, updatedAt: new Date() }
            : null,
        }));
      },
      
      updateMarginAccount: (updates) => {
        set((state) => ({
          marginAccount: state.marginAccount
            ? { ...state.marginAccount, ...updates, updatedAt: new Date() }
            : null,
        }));
      },
      
      adminAdjustBalance: (accountType, amount, adminId, note) => {
        const state = get();
        const account = accountType === 'spot' ? state.spotAccount : state.marginAccount;
        
        if (!account) return;
        
        const entry: LedgerEntry = {
          id: `ledger_${Date.now()}`,
          accountId: account.id,
          type: 'adjustment',
          amount,
          balanceBefore: account.cash,
          balanceAfter: account.cash + amount,
          description: `Admin adjustment: ${note}`,
          adminId,
          adminNote: note,
          createdAt: new Date(),
        };
        
        if (accountType === 'spot') {
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: state.spotAccount.cash + amount,
                  equity: state.spotAccount.equity + amount,
                  availableToTrade: state.spotAccount.availableToTrade + amount,
                  updatedAt: new Date(),
                }
              : null,
            ledger: [...state.ledger, entry],
          }));
        } else {
          set((state) => ({
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  balance: state.marginAccount.balance + amount,
                  cash: state.marginAccount.cash + amount,
                  freeMargin: state.marginAccount.freeMargin + amount,
                  updatedAt: new Date(),
                }
              : null,
            ledger: [...state.ledger, entry],
          }));
        }
      },
      
      // STOCK TRADING (SPOT MODEL)
      executeStockBuy: (symbol, name, qty, price, fee) => {
        const state = get();
        const account = state.spotAccount;
        
        if (!account) return { success: false, error: 'Account not initialized' };
        
        const cost = qty * price + fee;
        
        if (cost > account.cash) {
          return { success: false, error: 'Insufficient funds' };
        }
        
        const existingPosition = state.stockPositions.find(p => p.symbol === symbol);
        const now = new Date();
        
        if (existingPosition) {
          // Update existing position with weighted average
          const newAvg = calculateNewAvgEntry(
            existingPosition.qty,
            existingPosition.avgEntry,
            qty,
            price
          );
          
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: state.spotAccount.cash - cost,
                  updatedAt: now,
                }
              : null,
            stockPositions: state.stockPositions.map(p =>
              p.symbol === symbol
                ? {
                    ...p,
                    qty: p.qty + qty,
                    avgEntry: newAvg,
                    marketValue: (p.qty + qty) * p.currentPrice,
                    unrealizedPnL: (p.currentPrice - newAvg) * (p.qty + qty),
                    updatedAt: now,
                  }
                : p
            ),
          }));
        } else {
          // Create new position
          const newPosition: StockPosition = {
            id: `stock_${Date.now()}`,
            accountId: account.id,
            symbol,
            name,
            type: 'stock',
            qty,
            avgEntry: price,
            currentPrice: price,
            marketValue: qty * price,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            openedAt: now,
            updatedAt: now,
          };
          
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: state.spotAccount.cash - cost,
                  updatedAt: now,
                }
              : null,
            stockPositions: [...state.stockPositions, newPosition],
          }));
        }
        
        // Add ledger entry
        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_open',
          amount: -cost,
          balanceBefore: account.cash,
          balanceAfter: account.cash - cost,
          referenceId: symbol,
          referenceType: 'stock_buy',
          description: `Buy ${qty} ${symbol} @ ${price}`,
        });
        
        return { success: true };
      },
      
      executeStockSell: (positionId, qty, price, fee) => {
        const state = get();
        const account = state.spotAccount;
        const position = state.stockPositions.find(p => p.id === positionId);
        
        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        if (qty > position.qty) return { success: false, error: 'Quantity exceeds position' };
        
        const proceeds = qty * price - fee;
        const realizedPnL = (price - position.avgEntry) * qty;
        const now = new Date();
        
        if (qty === position.qty) {
          // Close entire position
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: state.spotAccount.cash + proceeds,
                  realizedPnL: state.spotAccount.realizedPnL + realizedPnL,
                  updatedAt: now,
                }
              : null,
            stockPositions: state.stockPositions.filter(p => p.id !== positionId),
          }));
        } else {
          // Partial close
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: state.spotAccount.cash + proceeds,
                  realizedPnL: state.spotAccount.realizedPnL + realizedPnL,
                  updatedAt: now,
                }
              : null,
            stockPositions: state.stockPositions.map(p =>
              p.id === positionId
                ? {
                    ...p,
                    qty: p.qty - qty,
                    marketValue: (p.qty - qty) * p.currentPrice,
                    unrealizedPnL: (p.currentPrice - p.avgEntry) * (p.qty - qty),
                    updatedAt: now,
                  }
                : p
            ),
          }));
        }
        
        // Add ledger entry
        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_close',
          amount: proceeds,
          balanceBefore: account.cash,
          balanceAfter: account.cash + proceeds,
          referenceId: positionId,
          referenceType: 'stock_sell',
          description: `Sell ${qty} ${position.symbol} @ ${price}`,
        });
        
        return { success: true, realizedPnL };
      },
      
      updateStockPositionPrice: (symbol, price) => {
        set((state) => ({
          stockPositions: state.stockPositions.map(p =>
            p.symbol === symbol
              ? {
                  ...p,
                  currentPrice: price,
                  marketValue: p.qty * price,
                  unrealizedPnL: (price - p.avgEntry) * p.qty,
                  unrealizedPnLPercent: ((price - p.avgEntry) / p.avgEntry) * 100,
                  updatedAt: new Date(),
                }
              : p
          ),
        }));
      },
      
      // MARGIN/FX TRADING
      openMarginPosition: (symbol, name, type, side, qty, price, leverage, fee, stopLoss, takeProfit) => {
        const state = get();
        const account = state.marginAccount;
        
        if (!account) return { success: false, error: 'Account not initialized' };
        
        const notional = qty * price;
        const requiredMargin = calculateRequiredMargin(qty, price, leverage);
        
        if (requiredMargin > account.freeMargin) {
          return { success: false, error: 'Insufficient margin' };
        }
        
        const now = new Date();
        
        const newPosition: MarginPosition = {
          id: `margin_${Date.now()}`,
          accountId: account.id,
          symbol,
          name,
          type,
          side,
          qty,
          avgEntry: price,
          leverage,
          notional,
          requiredMargin,
          maintenanceMargin: requiredMargin * 0.5,
          stopLoss,
          takeProfit,
          currentPrice: price,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          openingFee: fee,
          accumulatedFunding: 0,
          openedAt: now,
          updatedAt: now,
        };
        
        // Calculate liquidation price
        const equity = calculateMarginEquity(
          account.balance - fee,
          0,
          0,
          0
        );
        newPosition.liquidationPrice = calculateLiquidationPrice(
          newPosition,
          equity,
          0.5
        );
        
        set((state) => ({
          marginAccount: state.marginAccount
            ? {
                ...state.marginAccount,
                balance: state.marginAccount.balance - fee,
                marginUsed: state.marginAccount.marginUsed + requiredMargin,
                freeMargin: state.marginAccount.freeMargin - requiredMargin - fee,
                marginLevel: state.marginAccount.marginUsed + requiredMargin > 0
                  ? (state.marginAccount.equity / (state.marginAccount.marginUsed + requiredMargin)) * 100
                  : undefined,
                updatedAt: now,
              }
            : null,
          marginPositions: [...state.marginPositions, newPosition],
        }));
        
        // Add ledger entry
        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_open',
          amount: -fee,
          balanceBefore: account.balance,
          balanceAfter: account.balance - fee,
          referenceId: newPosition.id,
          referenceType: 'margin_open',
          description: `Open ${side.toUpperCase()} ${qty} ${symbol} @ ${price} (${leverage}x)`,
        });
        
        return { success: true };
      },
      
      closeMarginPosition: (positionId, price, fee) => {
        const state = get();
        const account = state.marginAccount;
        const position = state.marginPositions.find(p => p.id === positionId);
        
        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        
        const realizedPnL = calculateMarginPnL(position, price);
        const now = new Date();
        
        set((state) => ({
          marginAccount: state.marginAccount
            ? {
                ...state.marginAccount,
                balance: state.marginAccount.balance + realizedPnL - fee,
                marginUsed: state.marginAccount.marginUsed - position.requiredMargin,
                freeMargin: state.marginAccount.freeMargin + position.requiredMargin + realizedPnL - fee,
                realizedPnL: state.marginAccount.realizedPnL + realizedPnL,
                unrealizedPnL: state.marginAccount.unrealizedPnL - position.unrealizedPnL,
                updatedAt: now,
              }
            : null,
          marginPositions: state.marginPositions.filter(p => p.id !== positionId),
        }));
        
        // Add ledger entry
        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_close',
          amount: realizedPnL - fee,
          balanceBefore: account.balance,
          balanceAfter: account.balance + realizedPnL - fee,
          referenceId: positionId,
          referenceType: 'margin_close',
          description: `Close ${position.side.toUpperCase()} ${position.qty} ${position.symbol} @ ${price}`,
        });
        
        return { success: true, realizedPnL };
      },
      
      reduceMarginPosition: (positionId, qty, price, fee) => {
        const state = get();
        const account = state.marginAccount;
        const position = state.marginPositions.find(p => p.id === positionId);
        
        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        if (qty >= position.qty) {
          return get().closeMarginPosition(positionId, price, fee);
        }
        
        const ratio = qty / position.qty;
        const realizedPnL = calculateMarginPnL({ ...position, qty }, price);
        const marginReleased = position.requiredMargin * ratio;
        const now = new Date();
        
        set((state) => ({
          marginAccount: state.marginAccount
            ? {
                ...state.marginAccount,
                balance: state.marginAccount.balance + realizedPnL - fee,
                marginUsed: state.marginAccount.marginUsed - marginReleased,
                freeMargin: state.marginAccount.freeMargin + marginReleased + realizedPnL - fee,
                realizedPnL: state.marginAccount.realizedPnL + realizedPnL,
                updatedAt: now,
              }
            : null,
          marginPositions: state.marginPositions.map(p =>
            p.id === positionId
              ? {
                  ...p,
                  qty: p.qty - qty,
                  notional: (p.qty - qty) * p.avgEntry,
                  requiredMargin: p.requiredMargin - marginReleased,
                  maintenanceMargin: (p.requiredMargin - marginReleased) * 0.5,
                  updatedAt: now,
                }
              : p
          ),
        }));
        
        return { success: true, realizedPnL };
      },
      
      updateMarginPositionPrice: (symbol, price) => {
        set((state) => {
          const updatedPositions = state.marginPositions.map(p => {
            if (p.symbol !== symbol) return p;
            
            const unrealizedPnL = calculateMarginPnL(p, price);
            
            return {
              ...p,
              currentPrice: price,
              unrealizedPnL,
              unrealizedPnLPercent: (unrealizedPnL / p.requiredMargin) * 100,
              updatedAt: new Date(),
            };
          });
          
          // Recalculate account unrealized PnL
          const totalUnrealizedPnL = updatedPositions.reduce(
            (sum, p) => sum + p.unrealizedPnL,
            0
          );
          
          return {
            marginPositions: updatedPositions,
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  unrealizedPnL: totalUnrealizedPnL,
                  equity: state.marginAccount.balance + totalUnrealizedPnL,
                  marginLevel: state.marginAccount.marginUsed > 0
                    ? ((state.marginAccount.balance + totalUnrealizedPnL) / state.marginAccount.marginUsed) * 100
                    : undefined,
                }
              : null,
          };
        });
      },
      
      checkLiquidation: () => {
        const state = get();
        const account = state.marginAccount;
        if (!account) return [];
        
        const positionsToLiquidate: string[] = [];
        
        state.marginPositions.forEach(position => {
          const equity = calculateMarginEquity(
            account.balance,
            position.unrealizedPnL,
            position.accumulatedFunding,
            0
          );
          
          if (equity <= position.maintenanceMargin) {
            positionsToLiquidate.push(position.id);
          }
        });
        
        return positionsToLiquidate;
      },
      
      addLedgerEntry: (entry) => {
        const newEntry: LedgerEntry = {
          ...entry,
          id: `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
        };
        
        set((state) => ({
          ledger: [newEntry, ...state.ledger],
        }));
      },
      
      calculateSpotEquity: () => {
        const state = get();
        const account = state.spotAccount;
        if (!account) return 0;
        
        const marketValue = state.stockPositions.reduce(
          (sum, p) => sum + p.marketValue,
          0
        );
        
        return account.cash + marketValue;
      },
      
      calculateMarginEquity: () => {
        const state = get();
        const account = state.marginAccount;
        if (!account) return 0;
        
        return calculateMarginEquity(
          account.balance,
          account.unrealizedPnL,
          0,
          0
        );
      },
      
      calculateTotalUnrealizedPnL: () => {
        const state = get();
        
        const stockPnL = state.stockPositions.reduce(
          (sum, p) => sum + p.unrealizedPnL,
          0
        );
        
        const marginPnL = state.marginPositions.reduce(
          (sum, p) => sum + p.unrealizedPnL,
          0
        );
        
        return stockPnL + marginPnL;
      },
    }),
    {
      name: 'novatrade-trading-accounts',
      partialize: (state) => ({
        spotAccount: state.spotAccount,
        marginAccount: state.marginAccount,
        stockPositions: state.stockPositions,
        marginPositions: state.marginPositions,
        ledger: state.ledger.slice(0, 100), // Keep last 100 entries
      }),
    }
  )
);

// ==========================================
// INVESTMENTS STORE
// ==========================================

interface InvestmentsState {
  investments: Investment[];
  totalInvested: number;
  totalEarned: number;
  
  createInvestment: (investment: Omit<Investment, 'id' | 'createdAt'>) => void;
  updateInvestmentValue: (id: string, newValue: number, earned: number) => void;
  completeInvestment: (id: string) => void;
}

export const useInvestmentsStore = create<InvestmentsState>()(
  persist(
    (set, get) => ({
      investments: [],
      totalInvested: 0,
      totalEarned: 0,
      
      createInvestment: (investment) => {
        const newInvestment: Investment = {
          ...investment,
          id: `inv_${Date.now()}`,
          createdAt: new Date(),
        };
        
        set((state) => ({
          investments: [...state.investments, newInvestment],
          totalInvested: state.totalInvested + investment.principal,
        }));
      },
      
      updateInvestmentValue: (id, newValue, earned) => {
        set((state) => ({
          investments: state.investments.map(inv =>
            inv.id === id
              ? { ...inv, currentValue: newValue, totalEarned: inv.totalEarned + earned }
              : inv
          ),
          totalEarned: state.totalEarned + earned,
        }));
      },
      
      completeInvestment: (id) => {
        set((state) => ({
          investments: state.investments.map(inv =>
            inv.id === id ? { ...inv, status: 'completed' } : inv
          ),
        }));
      },
    }),
    {
      name: 'novatrade-investments',
    }
  )
);

// ==========================================
// AIRDROPS STORE
// ==========================================

interface AirdropsState {
  participations: AirdropParticipation[];
  totalPointsEarned: number;
  
  joinAirdrop: (airdropId: string, airdropName: string, totalTasks: number) => void;
  completeTask: (participationId: string, taskId: string, points: number) => void;
  claimAirdrop: (participationId: string) => void;
}

export const useAirdropsStore = create<AirdropsState>()(
  persist(
    (set) => ({
      participations: [],
      totalPointsEarned: 0,
      
      joinAirdrop: (airdropId, airdropName, totalTasks) => {
        const participation: AirdropParticipation = {
          id: `airdrop_${Date.now()}`,
          userId: '',
          airdropId,
          airdropName,
          tasksCompleted: [],
          totalTasks,
          pointsEarned: 0,
          status: 'active',
          createdAt: new Date(),
        };
        
        set((state) => ({
          participations: [...state.participations, participation],
        }));
      },
      
      completeTask: (participationId, taskId, points) => {
        set((state) => ({
          participations: state.participations.map(p =>
            p.id === participationId
              ? {
                  ...p,
                  tasksCompleted: [...p.tasksCompleted, taskId],
                  pointsEarned: p.pointsEarned + points,
                  status: p.tasksCompleted.length + 1 >= p.totalTasks ? 'completed' : 'active',
                }
              : p
          ),
          totalPointsEarned: state.totalPointsEarned + points,
        }));
      },
      
      claimAirdrop: (participationId) => {
        set((state) => ({
          participations: state.participations.map(p =>
            p.id === participationId
              ? { ...p, status: 'claimed', claimedAt: new Date() }
              : p
          ),
        }));
      },
    }),
    {
      name: 'novatrade-airdrops',
    }
  )
);

// ==========================================
// DEPOSIT ADDRESSES STORE (Admin Controlled)
// ==========================================

interface DepositAddressesState {
  addresses: DepositAddress[];
  
  getAddress: (currency: string, network: string) => DepositAddress | undefined;
  updateAddress: (id: string, newAddress: string, adminId: string) => void;
  addAddress: (address: Omit<DepositAddress, 'id' | 'updatedAt'>) => void;
  toggleActive: (id: string) => void;
}

export const useDepositAddressesStore = create<DepositAddressesState>()(
  persist(
    (set, get) => ({
      addresses: [
        {
          id: 'btc_mainnet',
          currency: 'BTC',
          network: 'Bitcoin',
          address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'eth_erc20',
          currency: 'ETH',
          network: 'ERC-20',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'usdt_trc20',
          currency: 'USDT',
          network: 'TRC-20',
          address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'usdt_erc20',
          currency: 'USDT',
          network: 'ERC-20',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'sol_solana',
          currency: 'SOL',
          network: 'Solana',
          address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
          isActive: true,
          updatedAt: new Date(),
        },
      ],
      
      getAddress: (currency, network) => {
        return get().addresses.find(
          a => a.currency === currency && a.network === network && a.isActive
        );
      },
      
      updateAddress: (id, newAddress, adminId) => {
        set((state) => ({
          addresses: state.addresses.map(a =>
            a.id === id
              ? { ...a, address: newAddress, updatedBy: adminId, updatedAt: new Date() }
              : a
          ),
        }));
      },
      
      addAddress: (address) => {
        const newAddress: DepositAddress = {
          ...address,
          id: `${address.currency.toLowerCase()}_${address.network.toLowerCase()}_${Date.now()}`,
          updatedAt: new Date(),
        };
        
        set((state) => ({
          addresses: [...state.addresses, newAddress],
        }));
      },
      
      toggleActive: (id) => {
        set((state) => ({
          addresses: state.addresses.map(a =>
            a.id === id ? { ...a, isActive: !a.isActive, updatedAt: new Date() } : a
          ),
        }));
      },
    }),
    {
      name: 'novatrade-deposit-addresses',
    }
  )
);
