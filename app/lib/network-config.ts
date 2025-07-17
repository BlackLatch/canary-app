/**
 * Network Configuration for Canary
 * 
 * IMPORTANT: This application operates EXCLUSIVELY on Polygon Amoy testnet.
 * The Dossier.sol smart contract is deployed ONLY on Polygon Amoy.
 * Do NOT attempt to use mainnet or any other network.
 */

import { polygonAmoy } from 'wagmi/chains';
import type { Address } from 'viem';

// The ONE and ONLY supported network
export const SUPPORTED_CHAIN = polygonAmoy;
export const SUPPORTED_CHAIN_ID = polygonAmoy.id; // 80002

// Contract deployment
export const DOSSIER_CONTRACT_ADDRESS: Address = '0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0';
export const DOSSIER_DEPLOYMENT_BLOCK = 0; // Update if known

// Network metadata
export const NETWORK_CONFIG = {
  name: 'Polygon Amoy',
  chainId: 80002,
  isTestnet: true,
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: {
    default: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY 
      ? `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : 'https://rpc-amoy.polygon.technology/',
    public: 'https://rpc-amoy.polygon.technology/',
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://amoy.polygonscan.com',
    },
  },
  faucets: [
    'https://faucet.polygon.technology/',
    'https://mumbaifaucet.com/', // Also works for Amoy
  ],
};

// Helper to get block explorer URL for a transaction
export const getTransactionUrl = (txHash: string): string => {
  return `${NETWORK_CONFIG.blockExplorers.default.url}/tx/${txHash}`;
};

// Helper to get block explorer URL for an address
export const getAddressUrl = (address: string): string => {
  return `${NETWORK_CONFIG.blockExplorers.default.url}/address/${address}`;
};

// Validation helpers
export const isCorrectNetwork = (chainId: number | undefined): boolean => {
  return chainId === SUPPORTED_CHAIN_ID;
};

export const getNetworkError = (chainId: number | undefined): string => {
  if (!chainId) return 'No network detected. Please connect your wallet.';
  if (chainId === 1) return 'Please switch from Ethereum Mainnet to Polygon Amoy testnet.';
  if (chainId === 137) return 'Please switch from Polygon Mainnet to Polygon Amoy testnet.';
  return `Please switch to Polygon Amoy testnet (Chain ID: ${SUPPORTED_CHAIN_ID}). Currently on chain ${chainId}.`;
};

// Testnet information
export const TESTNET_FAUCETS = [
  {
    name: 'Polygon Faucet',
    url: 'https://faucet.polygon.technology/',
    amount: '0.5 MATIC'
  },
  {
    name: 'Chainlink Faucet', 
    url: 'https://faucets.chain.link/polygon-amoy',
    amount: '0.1 MATIC'
  },
  {
    name: 'QuickNode Faucet',
    url: 'https://faucet.quicknode.com/polygon/amoy',
    amount: '0.1 MATIC'
  }
];