import { useCallback, useEffect, useRef } from 'react';

export interface DossierDraft {
  version: 1;
  timestamp: number;
  currentStep: number;
  name: string;
  description: string;
  releaseMode: 'public' | 'contacts' | '';
  emergencyContacts: string[];
  guardianAddresses: string[];
  guardianThreshold: number;
  enableGuardians: boolean;
  checkInInterval: string;
  customInterval: string;
  fileCount: number;
  hasAcceptedAUP: boolean;
}

const DRAFT_VERSION = 1;
const STORAGE_KEY_PREFIX = 'canary-dossier-draft';

/**
 * Custom hook for managing dossier draft persistence
 * Provides wallet-specific draft storage in localStorage
 */
export function useDossierDraft(walletAddress?: string | null) {
  const previousAddressRef = useRef<string | null>(null);

  // Generate storage key for current wallet
  const getStorageKey = useCallback(() => {
    if (!walletAddress) return null;
    return `${STORAGE_KEY_PREFIX}-${walletAddress.toLowerCase()}`;
  }, [walletAddress]);

  /**
   * Save draft to localStorage
   */
  const saveDraft = useCallback((draft: Omit<DossierDraft, 'version' | 'timestamp'>) => {
    const key = getStorageKey();
    if (!key) {
      console.warn('Cannot save draft: no wallet address');
      return;
    }

    try {
      const draftData: DossierDraft = {
        ...draft,
        version: DRAFT_VERSION,
        timestamp: Date.now(),
      };

      localStorage.setItem(key, JSON.stringify(draftData));
      console.log('📝 Draft saved for', walletAddress);
    } catch (error) {
      console.error('Failed to save dossier draft:', error);
    }
  }, [getStorageKey, walletAddress]);

  /**
   * Load draft from localStorage
   */
  const loadDraft = useCallback((): DossierDraft | null => {
    const key = getStorageKey();
    if (!key) return null;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const draft: DossierDraft = JSON.parse(stored);

      // Version check for future compatibility
      if (draft.version !== DRAFT_VERSION) {
        console.warn('Draft version mismatch, ignoring draft');
        clearDraft();
        return null;
      }

      console.log('📄 Draft loaded for', walletAddress);
      return draft;
    } catch (error) {
      console.error('Failed to load dossier draft:', error);
      return null;
    }
  }, [getStorageKey, walletAddress]);

  /**
   * Clear draft from localStorage
   */
  const clearDraft = useCallback(() => {
    const key = getStorageKey();
    if (!key) return;

    try {
      localStorage.removeItem(key);
      console.log('🗑️ Draft cleared for', walletAddress);
    } catch (error) {
      console.error('Failed to clear dossier draft:', error);
    }
  }, [getStorageKey, walletAddress]);

  /**
   * Check if draft exists
   */
  const hasDraft = useCallback((): boolean => {
    const key = getStorageKey();
    if (!key) return false;

    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }, [getStorageKey]);

  // Handle wallet address changes
  useEffect(() => {
    const currentAddress = walletAddress?.toLowerCase() || null;
    const previousAddress = previousAddressRef.current;

    // Update ref for next comparison
    previousAddressRef.current = currentAddress;

    // If wallet changed and is different from previous
    if (previousAddress && currentAddress && previousAddress !== currentAddress) {
      console.log('👛 Wallet changed:', previousAddress, '→', currentAddress);
      // Note: We don't need to do anything here - the hook will automatically
      // use the new wallet's draft when called next time due to memoization
    }
  }, [walletAddress]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
  };
}
