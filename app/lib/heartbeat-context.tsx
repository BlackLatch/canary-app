'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Address } from 'viem';
import { getHeartbeatService, generateCodePhrase } from './heartbeat';

interface HeartbeatContextValue {
  // State
  isEnabled: boolean;
  codePhrase: string | null;
  isInitializing: boolean;
  error: string | null;

  // Actions
  startHeartbeat: (address: Address) => Promise<void>;
  stopHeartbeat: () => void;
  getCodePhraseForAddress: (address: Address) => string;
}

const HeartbeatContext = createContext<HeartbeatContextValue | undefined>(undefined);

interface HeartbeatProviderProps {
  children: ReactNode;
}

export function HeartbeatProvider({ children }: HeartbeatProviderProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [codePhrase, setCodePhrase] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heartbeatService = getHeartbeatService();

  const startHeartbeat = async (address: Address) => {
    setIsInitializing(true);
    setError(null);

    try {
      await heartbeatService.startHeartbeat(address);
      const phrase = heartbeatService.getCodePhrase();

      setCodePhrase(phrase);
      setIsEnabled(true);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('canary-heartbeat-enabled', 'true');
        localStorage.setItem('canary-heartbeat-address', address);
      }

      console.log('💓 Heartbeat started successfully');
    } catch (err) {
      console.error('Failed to start heartbeat:', err);
      setError('Failed to start heartbeat. Please try again.');
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const stopHeartbeat = () => {
    heartbeatService.stopHeartbeat();
    setIsEnabled(false);
    setCodePhrase(null);

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('canary-heartbeat-enabled');
      localStorage.removeItem('canary-heartbeat-address');
    }

    console.log('💓 Heartbeat stopped');
  };

  const getCodePhraseForAddress = (address: Address): string => {
    return generateCodePhrase(address);
  };

  // Auto-restore heartbeat on mount if it was previously enabled
  useEffect(() => {
    const restoreHeartbeat = async () => {
      if (typeof window === 'undefined') return;

      const wasEnabled = localStorage.getItem('canary-heartbeat-enabled') === 'true';
      const savedAddress = localStorage.getItem('canary-heartbeat-address') as Address | null;

      if (wasEnabled && savedAddress) {
        console.log('💓 Heartbeat was previously enabled for:', savedAddress);
        console.log('💡 Click "Start Heartbeat" in Settings to resume broadcasting.');
        // Don't auto-restore on mount - user should manually enable
        // This prevents initialization issues and gives user control
      }
    };

    restoreHeartbeat();

    // Cleanup on unmount
    return () => {
      // Don't destroy service on unmount, only when explicitly stopped
    };
  }, []);

  const value: HeartbeatContextValue = {
    isEnabled,
    codePhrase,
    isInitializing,
    error,
    startHeartbeat,
    stopHeartbeat,
    getCodePhraseForAddress,
  };

  return (
    <HeartbeatContext.Provider value={value}>
      {children}
    </HeartbeatContext.Provider>
  );
}

/**
 * Hook to use the heartbeat context
 */
export function useHeartbeat(): HeartbeatContextValue {
  const context = useContext(HeartbeatContext);
  if (context === undefined) {
    throw new Error('useHeartbeat must be used within a HeartbeatProvider');
  }
  return context;
}
