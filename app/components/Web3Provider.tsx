'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../lib/web3';
import { useState } from 'react';

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
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        },
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
        {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
} 