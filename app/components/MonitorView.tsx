'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, AlertCircle, ExternalLink } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import toast from 'react-hot-toast';
import { Address, isAddress } from 'viem';
import { useAccount } from 'wagmi';
import { useBurnerWallet } from '../lib/burner-wallet-context';

interface MonitorViewProps {
  onBack: () => void;
  onViewDossiers: (address: Address) => void;
}

interface EmergencyContact {
  id: string;
  address: Address;
  label: string;
  addedAt: number;
}

export default function MonitorView({ onBack, onViewDossiers }: MonitorViewProps) {
  const { theme } = useTheme();
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Wallet hooks
  const { address } = useAccount();
  const burnerWallet = useBurnerWallet();

  // Helper to get current address (prioritize burner wallet)
  const getCurrentAddress = () => {
    return burnerWallet.address || address || null;
  };

  // Get storage key for current account
  const getStorageKey = () => {
    const currentAddress = getCurrentAddress();
    if (!currentAddress) return null;
    return `canary-emergency-contacts-${currentAddress.toLowerCase()}`;
  };

  // Load emergency contacts from localStorage for current account
  useEffect(() => {
    setHasLoaded(false); // Reset load flag when wallet changes

    if (typeof window !== 'undefined') {
      const currentAddress = getCurrentAddress();
      if (!currentAddress) {
        console.log('No wallet connected, cannot load emergency contacts');
        setEmergencyContacts([]);
        setHasLoaded(true);
        return;
      }

      const storageKey = `canary-emergency-contacts-${currentAddress.toLowerCase()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const contacts = JSON.parse(saved);
          setEmergencyContacts(contacts);
          console.log(`✅ Loaded ${contacts.length} emergency contacts for ${currentAddress}`);
        } catch (error) {
          console.error('Failed to load emergency contacts:', error);
          setEmergencyContacts([]);
        }
      } else {
        console.log(`No saved contacts found for ${currentAddress}`);
        setEmergencyContacts([]);
      }
      setHasLoaded(true);
    }
  }, [address, burnerWallet.address]);

  // Save contacts to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    if (!hasLoaded) return; // Don't save until we've loaded from localStorage first

    if (typeof window !== 'undefined') {
      const currentAddress = getCurrentAddress();
      if (!currentAddress) return;

      const storageKey = `canary-emergency-contacts-${currentAddress.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(emergencyContacts));
      console.log(`Saved ${emergencyContacts.length} emergency contacts for ${currentAddress}`);
    }
  }, [emergencyContacts, hasLoaded]);

  const addContact = () => {
    const trimmedAddress = newAddress.trim();
    const trimmedLabel = newLabel.trim();

    if (!trimmedAddress || !trimmedLabel) {
      toast.error('Please enter both an address and a label');
      return;
    }

    // Validate Ethereum address
    if (!isAddress(trimmedAddress)) {
      toast.error('Invalid Ethereum address format');
      return;
    }

    // Check for duplicates
    const normalizedAddress = trimmedAddress.toLowerCase();
    if (emergencyContacts.some(c => c.address.toLowerCase() === normalizedAddress)) {
      toast.error('This address is already in your emergency contacts');
      return;
    }

    const newContact: EmergencyContact = {
      id: `${Date.now()}-${Math.random()}`,
      address: trimmedAddress as Address,
      label: trimmedLabel,
      addedAt: Date.now(),
    };

    const updatedContacts = [...emergencyContacts, newContact];
    setEmergencyContacts(updatedContacts);

    // Explicitly save to localStorage immediately
    const currentAddress = getCurrentAddress();
    if (currentAddress && typeof window !== 'undefined') {
      const storageKey = `canary-emergency-contacts-${currentAddress.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedContacts));
      console.log(`✅ Saved contact "${newContact.label}" to localStorage`);
    }

    // Reset form
    setNewAddress('');
    setNewLabel('');
    setIsAddingContact(false);

    toast.success(`Added ${newContact.label} to emergency contacts`);
  };

  const removeContact = (contactId: string) => {
    const contact = emergencyContacts.find(c => c.id === contactId);
    if (!contact) return;

    if (confirm(`Remove ${contact.label} from emergency contacts?`)) {
      const updatedContacts = emergencyContacts.filter(c => c.id !== contactId);
      setEmergencyContacts(updatedContacts);

      // Explicitly save to localStorage immediately
      const currentAddress = getCurrentAddress();
      if (currentAddress && typeof window !== 'undefined') {
        const storageKey = `canary-emergency-contacts-${currentAddress.toLowerCase()}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedContacts));
        console.log(`✅ Removed contact "${contact.label}" from localStorage`);
      }

      toast.success(`Removed ${contact.label}`);
    }
  };

  const handleContactClick = (contact: EmergencyContact) => {
    onViewDossiers(contact.address);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className={`mb-8 border-b pb-6 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light'
                  ? 'hover:bg-gray-100 text-gray-600'
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="editorial-header-large text-black dark:text-gray-100">
              EMERGENCY CONTACTS
            </h1>
          </div>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            Manage your emergency contacts and view their dossiers
          </p>
        </div>

        {/* Add Contact Section */}
        <div className={`mb-8 p-6 rounded-lg border ${
          theme === 'light'
            ? 'bg-white border-gray-200'
            : 'bg-black border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-medium ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              Add Emergency Contact
            </h2>
            {!isAddingContact && (
              <button
                onClick={() => setIsAddingContact(true)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'light'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            )}
          </div>

          {isAddingContact && (
            <div className="space-y-4">
              <div>
                <label className={`text-sm font-medium block mb-2 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  Contact Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Alice, Bob, My Friend"
                  className={`w-full px-3 py-2 rounded border ${
                    theme === 'light'
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-black border-gray-600 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`text-sm font-medium block mb-2 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  Ethereum Address
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addContact();
                    }
                  }}
                  placeholder="0x..."
                  className={`w-full px-3 py-2 rounded border font-mono ${
                    theme === 'light'
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-black border-gray-600 text-white'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Enter the Ethereum address of your emergency contact
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addContact}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'light'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  Add Contact
                </button>
                <button
                  onClick={() => {
                    setIsAddingContact(false);
                    setNewAddress('');
                    setNewLabel('');
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    theme === 'light'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-gray-600 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!isAddingContact && emergencyContacts.length === 0 && (
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              No emergency contacts added yet. Click "Add Contact" to start.
            </p>
          )}
        </div>

        {/* Emergency Contacts List */}
        {emergencyContacts.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-lg font-medium ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              Your Emergency Contacts ({emergencyContacts.length})
            </h2>

            <div className="space-y-2">
              {emergencyContacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    theme === 'light'
                      ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
                      : 'bg-black border-gray-700 hover:border-blue-600 hover:bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`font-medium text-lg ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          {contact.label}
                        </h3>
                        <ExternalLink className={`w-4 h-4 ${
                          theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                      </div>
                      <div className="flex items-center gap-4">
                        <code className={`text-sm font-mono ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {contact.address}
                        </code>
                        <span className={`text-xs ${
                          theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          Added {formatDate(contact.addedAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeContact(contact.id);
                      }}
                      className={`p-2 rounded transition-colors ${
                        theme === 'light'
                          ? 'hover:bg-red-50 text-red-600'
                          : 'hover:bg-red-900/20 text-red-400'
                      }`}
                      title="Remove contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className={`mt-8 p-6 rounded-lg border ${
          theme === 'light'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-blue-900/10 border-blue-800'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 mt-0.5 ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`} />
            <div>
              <h3 className={`font-medium mb-2 ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                About Emergency Contacts
              </h3>
              <ul className={`text-sm space-y-1 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <li>• Add trusted contacts by their Ethereum address for quick access to their dossiers</li>
                <li>• Click on any contact to view all dossiers they've created</li>
                <li>• Contacts are saved per wallet address - switch accounts to see different lists</li>
                <li>• Use this to keep track of people you trust in emergency situations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
