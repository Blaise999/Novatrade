'use client';

/**
 * ACCOUNT INFO COMPONENT
 * 
 * Displays wallet connection status and truncated address.
 * Uses Wagmi v2 hooks for real blockchain interaction.
 */

import { useAccount, useDisconnect, useEnsName, useBalance } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatEther } from 'viem';

// Truncate address: 0x1234...5678
function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format balance with decimals
function formatBalance(balance: bigint | undefined, decimals: number = 4): string {
  if (!balance) return '0';
  return parseFloat(formatEther(balance)).toFixed(decimals);
}

/**
 * Simple account info display
 */
export function AccountInfo() {
  const { address, isConnected, isConnecting, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: balance } = useBalance({ address });
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl">
        <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-cream/60">Connecting...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-cream/60">
        <Wallet className="w-4 h-4" />
        <span className="text-sm">Not Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl">
      {/* Chain indicator */}
      <div className={`w-2 h-2 rounded-full ${chain?.id === 1 ? 'bg-profit' : 'bg-yellow-500'}`} />
      
      {/* Address/ENS */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-cream">
          {ensName || truncateAddress(address || '')}
        </span>
        <button
          onClick={copyAddress}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="Copy address"
        >
          {copied ? (
            <Check className="w-3 h-3 text-profit" />
          ) : (
            <Copy className="w-3 h-3 text-cream/50" />
          )}
        </button>
      </div>

      {/* Balance */}
      {balance && (
        <span className="text-xs text-cream/50">
          {formatBalance(balance.value)} {balance.symbol}
        </span>
      )}

      {/* Disconnect */}
      <button
        onClick={() => disconnect()}
        className="p-1 hover:bg-white/10 rounded transition-colors text-cream/50 hover:text-loss"
        title="Disconnect"
      >
        <LogOut className="w-3 h-3" />
      </button>
    </div>
  );
}

/**
 * Full-featured wallet button with dropdown
 */
export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: balance } = useBalance({ address });
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  const copyAddress = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (address && chain) {
      const baseUrl = chain.id === 1 
        ? 'https://etherscan.io' 
        : 'https://sepolia.etherscan.io';
      window.open(`${baseUrl}/address/${address}`, '_blank');
    }
  };

  if (!isConnected) {
    return <ConnectButton />;
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${chain?.id === 1 ? 'bg-profit' : 'bg-yellow-500'}`} />
        
        {/* Address */}
        <span className="text-sm font-medium text-cream">
          {ensName || truncateAddress(address || '')}
        </span>
        
        <ChevronDown className={`w-4 h-4 text-cream/50 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-charcoal border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <p className="text-xs text-cream/50 mb-1">Connected Wallet</p>
            <p className="text-sm font-mono text-cream break-all">{address}</p>
            {balance && (
              <p className="text-lg font-bold text-cream mt-2">
                {formatBalance(balance.value)} {balance.symbol}
              </p>
            )}
          </div>

          {/* Network */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${chain?.id === 1 ? 'bg-profit' : 'bg-yellow-500'}`} />
              <span className="text-sm text-cream/70">{chain?.name || 'Unknown Network'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-cream/70 hover:text-cream hover:bg-white/5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            
            <button
              onClick={openExplorer}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-cream/70 hover:text-cream hover:bg-white/5 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                disconnect();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-loss hover:bg-loss/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Connect button for navbar
 */
export function NavConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-4 py-2 bg-loss text-white text-sm font-semibold rounded-xl"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        className="w-4 h-4"
                      />
                    )}
                    <span className="text-xs text-cream/70 hidden sm:block">{chain.name}</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-profit" />
                    <span className="text-sm font-medium text-cream">
                      {account.displayName}
                    </span>
                    {account.displayBalance && (
                      <span className="text-xs text-cream/50 hidden sm:block">
                        {account.displayBalance}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
