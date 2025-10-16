'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Wallet } from 'ethers';
import { Address } from 'viem';
import {
  getOrCreateBurnerWallet,
  loadBurnerWallet,
  clearBurnerWallet,
  hasBurnerWallet,
  exportBurnerWalletPrivateKey,
  importBurnerWallet,
  BurnerWalletInfo,
} from './burner-wallet';

interface BurnerWalletContextValue {
  // Wallet state
  wallet: Wallet | null;
  address: Address | null;
  isConnected: boolean;
  isLoading: boolean;

  // Actions
  connect: () => Promise<BurnerWalletInfo>;
  disconnect: () => void;
  exportPrivateKey: () => string | null;
  importPrivateKey: (privateKey: string) => Promise<void>;
  hasExistingWallet: () => boolean;
}

const BurnerWalletContext = createContext<BurnerWalletContextValue | undefined>(undefined);

interface BurnerWalletProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
}

export function BurnerWalletProvider({ children, autoConnect = false }: BurnerWalletProviderProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize wallet on mount
  useEffect(() => {
    const initializeWallet = async () => {
      setIsLoading(true);
      try {
        if (autoConnect && hasBurnerWallet()) {
          const existingWallet = loadBurnerWallet();
          if (existingWallet) {
            setWallet(existingWallet);
            setAddress(existingWallet.address as Address);
            console.log('🔥 Burner wallet auto-connected:', existingWallet.address);
          }
        }
      } catch (error) {
        console.error('Failed to initialize burner wallet:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeWallet();
  }, [autoConnect]);

  const connect = async (): Promise<BurnerWalletInfo> => {
    setIsLoading(true);
    try {
      const walletInfo = getOrCreateBurnerWallet();
      const walletInstance = new Wallet(walletInfo.privateKey);

      setWallet(walletInstance);
      setAddress(walletInfo.address);

      if (walletInfo.isNew) {
        console.log('🔥 New burner wallet created:', walletInfo.address);
      } else {
        console.log('🔥 Existing burner wallet loaded:', walletInfo.address);
      }

      return walletInfo;
    } catch (error) {
      console.error('Failed to connect burner wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setAddress(null);
    clearBurnerWallet();
    console.log('🔥 Burner wallet disconnected and cleared');
  };

  const exportPrivateKey = (): string | null => {
    return exportBurnerWalletPrivateKey();
  };

  const importPrivateKey = async (privateKey: string): Promise<void> => {
    setIsLoading(true);
    try {
      const walletInstance = importBurnerWallet(privateKey);
      setWallet(walletInstance);
      setAddress(walletInstance.address as Address);
      console.log('🔥 Burner wallet imported:', walletInstance.address);
    } catch (error) {
      console.error('Failed to import burner wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const hasExistingWallet = (): boolean => {
    return hasBurnerWallet();
  };

  const value: BurnerWalletContextValue = {
    wallet,
    address,
    isConnected: wallet !== null,
    isLoading,
    connect,
    disconnect,
    exportPrivateKey,
    importPrivateKey,
    hasExistingWallet,
  };

  return (
    <BurnerWalletContext.Provider value={value}>
      {children}
    </BurnerWalletContext.Provider>
  );
}

/**
 * Hook to use the burner wallet context
 */
export function useBurnerWallet(): BurnerWalletContextValue {
  const context = useContext(BurnerWalletContext);
  if (context === undefined) {
    throw new Error('useBurnerWallet must be used within a BurnerWalletProvider');
  }
  return context;
}
