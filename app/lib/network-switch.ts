import { switchChain } from 'wagmi/actions';
import { polygonAmoy } from 'wagmi/chains';
import { config } from './web3';

/**
 * Switch the user's wallet to Polygon Amoy testnet
 * This will prompt the user's wallet to switch networks
 */
export async function switchToPolygonAmoy(): Promise<void> {
  try {
    console.log('🔄 Requesting network switch to Polygon Amoy...');
    
    await switchChain(config, {
      chainId: polygonAmoy.id,
    });
    
    console.log('✅ Successfully switched to Polygon Amoy');
  } catch (error) {
    console.error('❌ Failed to switch network:', error);
    
    // Check if user rejected the request
    if (error instanceof Error) {
      if (error.message.includes('User rejected') || error.message.includes('User denied')) {
        throw new Error('Network switch cancelled. Please manually switch to Polygon Amoy testnet to continue.');
      }
    }
    
    throw error;
  }
}

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
    
    if (account.chainId !== polygonAmoy.id) {
      console.log(`🔗 Wrong network detected. Current: ${account.chainId}, Expected: ${polygonAmoy.id}`);
      
      // Attempt to switch
      await switchToPolygonAmoy();
      
      // Check again after switch
      const updatedAccount = getAccount(config);
      return updatedAccount.chainId === polygonAmoy.id;
    }
    
    console.log('✅ Already on correct network');
    return true;
  } catch (error) {
    console.error('Failed to ensure correct network:', error);
    return false;
  }
}