import { Wallet } from 'ethers';
import { Address } from 'viem';

const BURNER_WALLET_KEY = 'canary-burner-wallet-private-key';

/**
 * Burner Wallet Utilities
 *
 * Provides fully embedded local wallet functionality using local storage.
 * Private keys are stored in browser local storage for session persistence.
 *
 * WARNING: This is for local usage only. Users should understand that:
 * - Private keys stored in local storage can be accessed by malicious scripts
 * - Clearing browser data will permanently lose access to the wallet
 * - This is NOT recommended for storing significant value
 */

export interface BurnerWalletInfo {
  address: Address;
  privateKey: string;
  isNew: boolean;
}

/**
 * Generate a new random burner wallet
 */
export function generateBurnerWallet(): Wallet {
  const wallet = Wallet.createRandom();
  return wallet;
}

/**
 * Save burner wallet private key to local storage
 */
export function saveBurnerWallet(privateKey: string): void {
  if (typeof window === 'undefined') {
    throw new Error('Local storage is only available in browser environment');
  }

  try {
    localStorage.setItem(BURNER_WALLET_KEY, privateKey);
  } catch (error) {
    console.error('Failed to save burner wallet to local storage:', error);
    throw new Error('Failed to save burner wallet. Please check browser storage permissions.');
  }
}

/**
 * Load burner wallet from local storage
 * Returns null if no wallet exists
 */
export function loadBurnerWallet(): Wallet | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const privateKey = localStorage.getItem(BURNER_WALLET_KEY);
    if (!privateKey) {
      return null;
    }

    return new Wallet(privateKey);
  } catch (error) {
    console.error('Failed to load burner wallet from local storage:', error);
    return null;
  }
}

/**
 * Get or create a burner wallet
 * Returns existing wallet from storage, or creates a new one
 */
export function getOrCreateBurnerWallet(): BurnerWalletInfo {
  const existingWallet = loadBurnerWallet();

  if (existingWallet) {
    return {
      address: existingWallet.address as Address,
      privateKey: existingWallet.privateKey,
      isNew: false,
    };
  }

  // Create new wallet
  const newWallet = generateBurnerWallet();
  saveBurnerWallet(newWallet.privateKey);

  return {
    address: newWallet.address as Address,
    privateKey: newWallet.privateKey,
    isNew: true,
  };
}

/**
 * Check if a burner wallet exists in storage
 */
export function hasBurnerWallet(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(BURNER_WALLET_KEY) !== null;
}

/**
 * Clear burner wallet from local storage
 */
export function clearBurnerWallet(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(BURNER_WALLET_KEY);
  } catch (error) {
    console.error('Failed to clear burner wallet from local storage:', error);
  }
}

/**
 * Export burner wallet private key
 * For backup purposes
 */
export function exportBurnerWalletPrivateKey(): string | null {
  const wallet = loadBurnerWallet();
  return wallet ? wallet.privateKey : null;
}

/**
 * Import a burner wallet from private key
 */
export function importBurnerWallet(privateKey: string): Wallet {
  try {
    const wallet = new Wallet(privateKey);
    saveBurnerWallet(privateKey);
    return wallet;
  } catch (error) {
    console.error('Failed to import burner wallet:', error);
    throw new Error('Invalid private key format');
  }
}

/**
 * Get burner wallet address without loading the full wallet
 */
export function getBurnerWalletAddress(): Address | null {
  const wallet = loadBurnerWallet();
  return wallet ? (wallet.address as Address) : null;
}
