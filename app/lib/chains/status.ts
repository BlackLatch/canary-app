// Status Network Sepolia Testnet Configuration
import { defineChain } from 'viem';

export const statusSepolia = defineChain({
  id: 1660990954,
  name: 'Status Network Sepolia',
  network: 'status-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://public.sepolia.rpc.status.network'],
    },
    public: {
      http: ['https://public.sepolia.rpc.status.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Status Explorer',
      url: 'https://sepoliascan.status.network',
    },
  },
  testnet: true,
});
