'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets';
import { config } from '../lib/web3';
import { useState, useEffect, useLayoutEffect } from 'react';

// Wrapper component to filter out the delayedExecution prop
const FilteredSmartWalletsProvider = ({ children, ...rest }: { children: React.ReactNode; [key: string]: any }) => {
  // SmartWalletsProvider doesn't accept any props except children
  // Filter out any props that might cause React warnings
  // Only pass children to SmartWalletsProvider
  return <SmartWalletsProvider>{children}</SmartWalletsProvider>;
};

// Suppress console warnings immediately on module load
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Check all arguments for the problematic prop warning
    const shouldSuppress = args.some((arg: any) => {
      if (typeof arg === 'string') {
        return (
          arg.includes('delayedExecution') ||
          arg.includes('`delayedExecution`') ||
          (arg.includes('React does not recognize') && arg.includes('delayedExecution'))
        );
      }
      return false;
    });
    
    if (shouldSuppress) {
      // Suppress this specific warning as it's from Privy/Turnstile library
      return;
    }
    
    originalError.apply(console, args);
  };
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Use the environment variable or a valid-format fallback for build time
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'clxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: '/canary.png',
        },
        // Explicitly specify supported external wallets
        // Only MetaMask and WalletConnect are supported
        // Coinbase Wallet and Rainbow have been removed
        externalWallets: {
          metamask: {
            connectionOptions: 'all'
          },
          walletConnect: {
            enabled: true
          },
          coinbaseWallet: {
            enabled: false
          },
          rainbow: {
            enabled: false
          }
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: false,
          // Smart wallets are configured in Privy dashboard with ZeroDev paymaster
        },
        // IMPORTANT: Only use Polygon Amoy - Dossier.sol is deployed at 0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0
        defaultChain: {
          id: 80002,
          name: 'Polygon Amoy',
          network: 'polygon-amoy',
          nativeCurrency: {
            decimals: 18,
            name: 'MATIC',
            symbol: 'MATIC',
          },
          rpcUrls: {
            default: {
              http: ['https://rpc-amoy.polygon.technology'],
            },
          },
          blockExplorers: {
            default: {
              name: 'PolygonScan',
              url: 'https://amoy.polygonscan.com',
            },
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <FilteredSmartWalletsProvider>
            {children}
          </FilteredSmartWalletsProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
} 