import { ethers } from 'ethers';
import type { WalletClient } from 'viem';
import { providers } from 'ethers';

/**
 * Creates an ethers provider from Privy's embedded wallet
 * This properly handles both embedded and external wallets
 * Note: In the newer Privy API, we need to pass the wallet's provider directly
 * from the useWallets hook rather than using getEthereumProvider
 */
export async function getPrivyEthersProvider(walletProvider?: any): Promise<ethers.providers.Web3Provider> {
  // If a wallet provider is passed directly (from useWallets hook), use it
  if (walletProvider) {
    console.log('🔧 Using provided wallet provider:', walletProvider);
    const provider = new providers.Web3Provider(walletProvider);
    
    // Try to get accounts to ensure provider is connected
    try {
      const accounts = await provider.listAccounts();
      console.log('📋 Provider accounts:', accounts);
      if (accounts.length === 0) {
        console.warn('⚠️ Provider has no accounts. Requesting accounts...');
        // Try to request accounts
        await walletProvider.request({ method: 'eth_requestAccounts' });
      }
    } catch (error) {
      console.error('❌ Error checking provider accounts:', error);
    }
    
    return provider;
  }
  
  // Fallback to window.ethereum if available
  if (typeof window !== 'undefined' && window.ethereum) {
    console.log('🔧 Using window.ethereum provider');
    const provider = new providers.Web3Provider(window.ethereum as any);
    
    // Ensure accounts are connected
    try {
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
    } catch (error) {
      console.error('❌ Error with window.ethereum:', error);
    }
    
    return provider;
  }
  
  throw new Error('No wallet provider found. Please connect your wallet.');
}

/**
 * Creates an ethers provider from a wallet client's transport
 * This maintains the connection through Privy/Wagmi
 */
export function walletClientToProvider(walletClient: WalletClient): ethers.providers.Web3Provider {
  const { chain, transport } = walletClient;
  
  if (!chain) {
    throw new Error('WalletClient must have a chain');
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  // For Privy embedded wallets, the transport might have a different structure
  // Try to extract the provider from the transport
  if (transport && typeof transport === 'object') {
    // Check if transport has a provider property
    const transportAny = transport as any;
    
    // Try different ways to access the underlying provider
    const provider = transportAny.provider || 
                    transportAny._provider || 
                    transportAny.request || 
                    transport;
    
    return new providers.Web3Provider(provider, network);
  }

  // Fallback to using transport directly
  return new providers.Web3Provider(transport as any, network);
}