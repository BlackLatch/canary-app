import { http } from 'wagmi'
import { createConfig } from '@privy-io/wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { statusSepolia } from './chains/status'
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors'
import type { CreateConnectorFn } from 'wagmi'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Note: We use a dedicated RPC endpoint for Polygon Amoy to ensure reliable contract access
// The wallet handles signing, but RPC calls go through a reliable endpoint

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

// Use public RPC endpoints as fallback when wallet doesn't have proper RPC configured
const polygonAmoyRpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  : 'https://rpc-amoy.polygon.technology/';

const statusSepoliaRpcUrl = 'https://public.sepolia.rpc.status.network';

export const config = createConfig({
  chains: [polygonAmoy, statusSepolia], // Polygon Amoy and Status Network
  connectors,
  transports: {
    [polygonAmoy.id]: http(polygonAmoyRpcUrl), // Polygon Amoy RPC
    [statusSepolia.id]: http(statusSepoliaRpcUrl), // Status Network RPC
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 