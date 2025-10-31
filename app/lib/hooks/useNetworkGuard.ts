import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { ensureCorrectNetwork } from '../network-switch';
import { statusSepolia } from '../chains/status';
import { getNetworkName } from '../contract';
import { useBurnerWallet } from '../burner-wallet-context';

/**
 * Custom hook that guards actions by checking network before execution
 * Only applies to external Web3 wallets (not burner or Privy embedded)
 *
 * Usage:
 * const guardedAction = useNetworkGuard(async () => {
 *   // Your action code here
 * });
 *
 * Then call: await guardedAction();
 */
export function useNetworkGuard<T extends (...args: any[]) => Promise<any>>(
  action: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | void> {
  const { chainId, isConnected } = useAccount();
  const burnerWallet = useBurnerWallet();

  return useCallback(
    async (...args: Parameters<T>) => {
      // Skip network check for burner wallets (they don't report chainId)
      // Also skip if not connected via external wallet
      if (burnerWallet.isConnected || !isConnected) {
        return await action(...args);
      }

      // Check if on correct network
      if (chainId !== statusSepolia.id) {
        const currentNetwork = getNetworkName(chainId);
        console.log(`🔗 Network check: Currently on ${currentNetwork} (chain ${chainId})`);
        console.log(`📍 Need to switch to Status Network Sepolia (chain ${statusSepolia.id})`);

        // Show toast and attempt automatic switch
        const switchToast = toast.loading('Switching to Status Network Sepolia...');

        try {
          const success = await ensureCorrectNetwork();
          toast.dismiss(switchToast);

          if (success) {
            toast.success('✅ Network switched successfully');
            // Network switched, now execute the action
            return await action(...args);
          } else {
            toast.error(
              `Please manually switch to Status Network Sepolia in your wallet`,
              { duration: 5000 }
            );
            return;
          }
        } catch (error) {
          toast.dismiss(switchToast);
          console.error('Network switch failed:', error);

          // Show user-friendly error message
          if (error instanceof Error && error.message.includes('cancelled')) {
            toast.error('Network switch cancelled', { duration: 3000 });
          } else {
            toast.error(
              `Please switch to Status Network Sepolia. Currently on ${currentNetwork}`,
              { duration: 5000 }
            );
          }
          return;
        }
      }

      // Already on correct network, execute action directly
      return await action(...args);
    },
    [action, chainId, isConnected, burnerWallet.isConnected]
  );
}
