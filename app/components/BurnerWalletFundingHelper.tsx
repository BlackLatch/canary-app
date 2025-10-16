'use client';

import { useState } from 'react';
import { Copy, ExternalLink, X, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

interface BurnerWalletFundingHelperProps {
  address: string;
  theme: 'light' | 'dark';
}

export default function BurnerWalletFundingHelper({ address, theme }: BurnerWalletFundingHelperProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const faucetUrl = 'https://faucet.polygon.technology/';

  return (
    <div className={`relative ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors ${
          theme === 'light'
            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
            : 'border-amber-600/50 bg-amber-900/20 hover:bg-amber-900/30'
        }`}
        title="Click to get testnet MATIC for gas fees"
      >
        <Wallet className="w-3.5 h-3.5 text-amber-600" />
        <span className={theme === 'light' ? 'text-amber-900' : 'text-amber-400'}>
          Need testnet MATIC?
        </span>
      </button>

      {/* Expanded info panel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-[9998]"
            onClick={() => setIsExpanded(false)}
          />

          {/* Panel */}
          <div className={`absolute right-0 top-full mt-2 w-80 rounded-lg border shadow-lg z-[9999] ${
            theme === 'light'
              ? 'bg-white border-gray-300'
              : 'bg-gray-900 border-gray-600'
          }`}>
            <div className={`flex items-center justify-between p-4 border-b ${
              theme === 'light' ? 'border-gray-300' : 'border-gray-600'
            }`}>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                <h3 className={`text-sm font-medium ${
                  theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                }`}>
                  Fund Burner Wallet
                </h3>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Your burner wallet needs testnet MATIC to pay for gas fees on Polygon Amoy.
              </p>

              {/* Address display and copy */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  Your Burner Wallet Address
                </label>
                <div className={`flex items-center gap-2 p-2 rounded border ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-300'
                    : 'bg-black/40 border-gray-600'
                }`}>
                  <code className={`flex-1 text-xs font-mono overflow-hidden text-ellipsis ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    {address}
                  </code>
                  <button
                    onClick={copyAddress}
                    className={`p-1.5 rounded transition-colors ${
                      theme === 'light'
                        ? 'hover:bg-gray-200 text-gray-600'
                        : 'hover:bg-white/10 text-gray-400'
                    }`}
                    title="Copy address"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  How to get testnet MATIC:
                </p>
                <ol className={`text-xs space-y-1.5 pl-4 ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  <li>1. Copy your wallet address above</li>
                  <li>2. Visit the Polygon Amoy faucet</li>
                  <li>3. Paste your address and request tokens</li>
                  <li>4. Wait a few moments for the tokens to arrive</li>
                </ol>
              </div>

              {/* Faucet link */}
              <a
                href={faucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border font-medium text-sm transition-colors ${
                  theme === 'light'
                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                    : 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                }`}
              >
                <span>Open Polygon Faucet</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                Note: This is free test MATIC with no real-world value. It's only used to pay for transactions on the Polygon Amoy testnet.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
