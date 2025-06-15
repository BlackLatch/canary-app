import { http, createConfig } from 'wagmi'
import { mainnet, polygonAmoy } from 'wagmi/chains'
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// Multiple RPC endpoints for better reliability
const polygonAmoyRPCs = [
  'https://rpc-amoy.polygon.technology',
  'https://polygon-amoy.g.alchemy.com/v2/demo', // Public Alchemy endpoint
  'https://polygon-amoy.blockpi.network/v1/rpc/public',
  'https://rpc.ankr.com/polygon_amoy'
];

export const config = createConfig({
  chains: [mainnet, polygonAmoy],
  connectors: [
    metaMask(),
    coinbaseWallet({
      appName: 'Canary',
      appLogoUrl: 'https://canary.app/logo.png',
    }),
    walletConnect({
      projectId,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygonAmoy.id]: http(polygonAmoyRPCs[0], {
      batch: true,
      retryCount: 3,
      retryDelay: 1000,
    }),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 