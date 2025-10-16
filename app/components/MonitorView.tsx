'use client';

import { useState, useEffect } from 'react';
import { Activity, ChevronLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import { getHeartbeatService } from '../lib/heartbeat';
import toast from 'react-hot-toast';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useBurnerWallet } from '../lib/burner-wallet-context';

interface MonitorViewProps {
  onBack: () => void;
}

interface MonitoredContact {
  id: string;
  codePhrase: string;
  label: string;
  addedAt: number;
  lastHeartbeat: number | null;
  isAlive: boolean;
  address: Address | null;
}

export default function MonitorView({ onBack }: MonitorViewProps) {
  const { theme } = useTheme();
  const [monitoredContacts, setMonitoredContacts] = useState<MonitoredContact[]>([]);
  const [newCodePhrase, setNewCodePhrase] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Map<string, () => void>>(new Map());

  // Wallet hooks
  const { address } = useAccount();
  const { wallets } = usePrivy();
  const burnerWallet = useBurnerWallet();

  const heartbeatService = getHeartbeatService();

  // Helper to get current address (prioritize burner wallet)
  const getCurrentAddress = () => {
    return burnerWallet.address || address || (wallets && wallets.length > 0 ? wallets[0]?.address : null);
  };

  // Get storage key for current account
  const getStorageKey = () => {
    const currentAddress = getCurrentAddress();
    if (!currentAddress) return null;
    return `canary-monitored-contacts-${currentAddress.toLowerCase()}`;
  };

  // Load monitored contacts from localStorage for current account
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = getStorageKey();
      if (!storageKey) {
        console.log('No wallet connected, cannot load monitored contacts');
        setMonitoredContacts([]);
        return;
      }

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const contacts = JSON.parse(saved);
          setMonitoredContacts(contacts);

          // Subscribe to each contact
          contacts.forEach((contact: MonitoredContact) => {
            subscribeToContact(contact);
          });
        } catch (error) {
          console.error('Failed to load monitored contacts:', error);
        }
      } else {
        setMonitoredContacts([]);
      }
    }

    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [getCurrentAddress()]);

  // Save contacts to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = getStorageKey();
      if (!storageKey) return;

      localStorage.setItem(storageKey, JSON.stringify(monitoredContacts));
    }
  }, [monitoredContacts]);

  const subscribeToContact = async (contact: MonitoredContact) => {
    try {
      const unsubscribe = await heartbeatService.subscribeToHeartbeat(
        contact.codePhrase,
        (heartbeat) => {
          setMonitoredContacts(prev =>
            prev.map(c =>
              c.id === contact.id
                ? {
                    ...c,
                    lastHeartbeat: heartbeat.timestamp,
                    isAlive: heartbeat.isAlive,
                    address: heartbeat.address || c.address,
                  }
                : c
            )
          );

          // Show notification if contact goes offline
          if (!heartbeat.isAlive) {
            toast.error(`⚠️ ${contact.label} heartbeat timeout!`, {
              duration: 10000,
            });
          }
        }
      );

      setSubscriptions(prev => new Map(prev).set(contact.id, unsubscribe));
    } catch (error) {
      console.error('Failed to subscribe to contact:', error);
      toast.error(`Failed to subscribe to ${contact.label}`);
    }
  };

  const addContact = async () => {
    if (!newCodePhrase.trim() || !newLabel.trim()) {
      toast.error('Please enter both a code phrase and a label');
      return;
    }

    // Validate code phrase format (should be word-word-word)
    const codePhraseRegex = /^[a-z]+-[a-z]+-[a-z]+$/;
    if (!codePhraseRegex.test(newCodePhrase.trim())) {
      toast.error('Invalid code phrase format. Should be: word-word-word');
      return;
    }

    const newContact: MonitoredContact = {
      id: `${Date.now()}-${Math.random()}`,
      codePhrase: newCodePhrase.trim(),
      label: newLabel.trim(),
      addedAt: Date.now(),
      lastHeartbeat: null,
      isAlive: false,
      address: null,
    };

    setMonitoredContacts(prev => [...prev, newContact]);

    // Subscribe to the new contact
    await subscribeToContact(newContact);

    // Reset form
    setNewCodePhrase('');
    setNewLabel('');
    setIsAddingContact(false);

    toast.success(`Now monitoring ${newContact.label}`);
  };

  const removeContact = (contactId: string) => {
    const contact = monitoredContacts.find(c => c.id === contactId);
    if (!contact) return;

    if (confirm(`Stop monitoring ${contact.label}?`)) {
      // Unsubscribe
      const unsubscribe = subscriptions.get(contactId);
      if (unsubscribe) {
        unsubscribe();
        subscriptions.delete(contactId);
      }

      setMonitoredContacts(prev => prev.filter(c => c.id !== contactId));
      toast.success(`Stopped monitoring ${contact.label}`);
    }
  };

  const getStatusColor = (contact: MonitoredContact) => {
    if (!contact.lastHeartbeat) return 'gray';
    if (contact.isAlive) return 'green';
    return 'red';
  };

  const getStatusText = (contact: MonitoredContact) => {
    if (!contact.lastHeartbeat) return 'Waiting for signal...';
    if (contact.isAlive) return 'Online';
    return 'Offline (Timeout)';
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 minute
    if (diff < 60 * 1000) {
      return 'Just now';
    }
    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    // Less than 1 day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    // More than 1 day
    return date.toLocaleDateString();
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
            <h1 className="editorial-header-large text-gray-900 dark:text-gray-100">
              MONITOR
            </h1>
          </div>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            Monitor heartbeat status of trusted contacts using their code phrases
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
              Add Contact to Monitor
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
                  Code Phrase
                </label>
                <input
                  type="text"
                  value={newCodePhrase}
                  onChange={(e) => setNewCodePhrase(e.target.value.toLowerCase())}
                  placeholder="word-word-word"
                  className={`w-full px-3 py-2 rounded border font-mono ${
                    theme === 'light'
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-black border-gray-600 text-white'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Enter the 3-word code phrase shared by the contact (format: word-word-word)
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
                  Add & Subscribe
                </button>
                <button
                  onClick={() => {
                    setIsAddingContact(false);
                    setNewCodePhrase('');
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

          {!isAddingContact && monitoredContacts.length === 0 && (
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              No contacts being monitored yet. Click "Add Contact" to start.
            </p>
          )}
        </div>

        {/* Monitored Contacts List */}
        {monitoredContacts.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-lg font-medium ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              Monitored Contacts ({monitoredContacts.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitoredContacts.map(contact => {
                const statusColor = getStatusColor(contact);
                const statusText = getStatusText(contact);

                return (
                  <div
                    key={contact.id}
                    className={`p-4 rounded-lg border ${
                      theme === 'light'
                        ? 'bg-white border-gray-200'
                        : 'bg-black border-gray-700'
                    }`}
                  >
                    {/* Contact Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className={`font-medium mb-1 ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          {contact.label}
                        </h3>
                        <code className={`text-xs font-mono ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {contact.codePhrase}
                        </code>
                      </div>
                      <button
                        onClick={() => removeContact(contact.id)}
                        className={`p-1 rounded transition-colors ${
                          theme === 'light'
                            ? 'hover:bg-red-50 text-red-600'
                            : 'hover:bg-red-900/20 text-red-400'
                        }`}
                        title="Remove contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Status Indicator */}
                    <div className={`p-3 rounded-lg mb-3 ${
                      statusColor === 'green'
                        ? theme === 'light'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-green-900/10 border border-green-800'
                        : statusColor === 'red'
                          ? theme === 'light'
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-red-900/10 border border-red-800'
                          : theme === 'light'
                            ? 'bg-gray-50 border border-gray-200'
                            : 'bg-white/5 border border-gray-700'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${
                          statusColor === 'green'
                            ? 'bg-green-500 animate-pulse'
                            : statusColor === 'red'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                        }`} />
                        <span className={`text-sm font-medium ${
                          statusColor === 'green'
                            ? theme === 'light' ? 'text-green-700' : 'text-green-400'
                            : statusColor === 'red'
                              ? theme === 'light' ? 'text-red-700' : 'text-red-400'
                              : theme === 'light' ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          {statusText}
                        </span>
                      </div>
                      {contact.lastHeartbeat && (
                        <p className={`text-xs ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Last seen: {formatTimestamp(contact.lastHeartbeat)}
                        </p>
                      )}
                    </div>

                    {/* Address */}
                    {contact.address && (
                      <div className={`text-xs ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Address:</span>
                        <br />
                        <code className="font-mono">
                          {contact.address.slice(0, 6)}...{contact.address.slice(-4)}
                        </code>
                      </div>
                    )}
                  </div>
                );
              })}
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
                How Monitoring Works
              </h3>
              <ul className={`text-sm space-y-1 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <li>• Contacts must have heartbeat enabled and share their code phrase with you</li>
                <li>• You'll receive real-time updates about their status via the Waku network</li>
                <li>• If no heartbeat is received for 15 minutes, you'll be notified of a timeout</li>
                <li>• Monitored contacts are saved per wallet address - switch accounts to see different lists</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
