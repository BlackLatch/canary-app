import { switchChain } from 'wagmi/actions';
import { statusSepolia } from './chains/status';
import { config } from './web3';

/**
 * Switch the user's wallet to Status Network Sepolia testnet
 * This will prompt the user's wallet to switch networks
 * If the network doesn't exist in the wallet, it will prompt to add it first
 */
export async function switchToStatusNetwork(): Promise<void> {
  try {
    console.log('🔄 Requesting network switch to Status Network Sepolia...');
    console.log('📍 Network details:', {
      name: statusSepolia.name,
      chainId: statusSepolia.id,
      rpcUrl: statusSepolia.rpcUrls.default.http[0],
    });

    await switchChain(config, {
      chainId: statusSepolia.id,
    });

    console.log('✅ Successfully switched to Status Network Sepolia');
  } catch (error) {
    console.error('❌ Failed to switch network:', error);

    // Check if user rejected the request
    if (error instanceof Error) {
      if (error.message.includes('User rejected') || error.message.includes('User denied')) {
        throw new Error('Network switch cancelled. Please manually switch to Status Network Sepolia testnet to continue.');
      }

      // If network doesn't exist, wagmi should automatically prompt to add it
      // If that fails, provide helpful error message
      if (error.message.includes('Unrecognized chain') || error.message.includes('network')) {
        throw new Error(
          'Status Network Sepolia not found in wallet. Please add it manually:\n' +
          `Chain ID: ${statusSepolia.id}\n` +
          `RPC URL: ${statusSepolia.rpcUrls.default.http[0]}\n` +
          `Explorer: ${statusSepolia.blockExplorers?.default.url}`
        );
      }
    }

    throw error;
  }
}

// Backward compatibility alias
export const switchToPolygonAmoy = switchToStatusNetwork;

/**
 * Check if we're on the correct network and prompt to switch if not
 */
export async function ensureCorrectNetwork(): Promise<boolean> {
  try {
    const { getAccount } = await import('wagmi/actions');
    const account = getAccount(config);

    if (!account.isConnected) {
      console.log('⚠️ No wallet connected');
      return false;
    }

    if (account.chainId !== statusSepolia.id) {
      console.log(`🔗 Wrong network detected. Current: ${account.chainId}, Expected: ${statusSepolia.id}`);

      // Attempt to switch
      await switchToStatusNetwork();

      // Check again after switch
      const updatedAccount = getAccount(config);
      return updatedAccount.chainId === statusSepolia.id;
    }

    console.log('✅ Already on correct network');
    return true;
  } catch (error) {
    console.error('Failed to ensure correct network:', error);
    return false;
  }
}