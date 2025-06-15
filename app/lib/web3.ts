import { http, createConfig } from 'wagmi'
import { mainnet, polygonAmoy } from 'wagmi/chains'
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors'
import type { CreateConnectorFn } from 'wagmi'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Note: We use the wallet's RPC provider instead of hardcoded endpoints
// This ensures all contract interactions go through the connected wallet

// Create connectors array conditionally
const connectors: CreateConnectorFn[] = [
  metaMask(),
  coinbaseWallet({
    appName: 'Canary',
    appLogoUrl: 'https://canary.app/logo.png',
  })
];

// Only add WalletConnect if we have a valid project ID
if (projectId && projectId !== 'demo-project-id') {
  connectors.push(walletConnect({
    projectId,
  }));
} else {
  console.warn('🔶 WalletConnect disabled: No valid project ID found. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment variables.');
}

export const config = createConfig({
  chains: [mainnet, polygonAmoy],
  connectors,
  transports: {
    [mainnet.id]: http(), // Uses wallet's mainnet RPC
    [polygonAmoy.id]: http(), // Uses wallet's Polygon Amoy RPC
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 