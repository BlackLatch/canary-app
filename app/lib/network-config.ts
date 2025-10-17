/**
 * Network Configuration for Canary
 *
 * IMPORTANT: This application primarily operates on Status Network Sepolia testnet.
 * The DossierV2 smart contract is deployed on Status Network (gasless).
 * Polygon Amoy is also supported for backward compatibility.
 */

import { statusSepolia } from './chains/status';
import type { Address } from 'viem';

// The default supported network
export const SUPPORTED_CHAIN = statusSepolia;
export const SUPPORTED_CHAIN_ID = statusSepolia.id; // 1660990954

// Contract deployment
export const DOSSIER_CONTRACT_ADDRESS: Address = (process.env.NEXT_PUBLIC_CANARY_DOSSIER_STATUS_ADDRESS as Address) || '0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0';
export const DOSSIER_DEPLOYMENT_BLOCK = 11423379; // Status Network deployment block

// Network metadata
export const NETWORK_CONFIG = {
  name: 'Status Network Sepolia',
  chainId: 1660990954,
  isTestnet: true,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://public.sepolia.rpc.status.network',
    public: 'https://public.sepolia.rpc.status.network',
  },
  blockExplorers: {
    default: {
      name: 'Status Explorer',
      url: 'https://sepoliascan.status.network',
    },
  },
  faucets: [
    'https://faucet.status.network/',
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
  if (chainId === 1) return 'Please switch from Ethereum Mainnet to Status Network Sepolia testnet.';
  if (chainId === 137) return 'Please switch from Polygon Mainnet to Status Network Sepolia testnet.';
  if (chainId === 80002) return 'Please switch from Polygon Amoy to Status Network Sepolia testnet.';
  return `Please switch to Status Network Sepolia testnet (Chain ID: ${SUPPORTED_CHAIN_ID}). Currently on chain ${chainId}.`;
};

// Testnet information
export const TESTNET_FAUCETS = [
  {
    name: 'Status Network Faucet',
    url: 'https://faucet.status.network/',
    amount: 'Test ETH'
  }
];