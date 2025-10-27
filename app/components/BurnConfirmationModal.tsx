'use client';

import { useState } from 'react';
import { AlertTriangle, Flame, Shield, Clock, Key } from 'lucide-react';
import { useTheme } from '@/app/lib/theme-context';

interface BurnConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  hasActiveDossiers?: boolean;
}

export default function BurnConfirmationModal({
  onConfirm,
  onCancel,
  hasActiveDossiers = false
}: BurnConfirmationModalProps) {
  const { theme } = useTheme();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (confirmText === 'BURN') {
      onConfirm();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className={`
        ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}
        border ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}
        shadow-xl max-w-2xl w-full my-8
      `}>
        {/* Header */}
        <div className={`
          border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}
          px-6 py-5 flex items-center gap-3
        `}>
          <Flame className="w-6 h-6 text-red-500 flex-shrink-0" />
          <h2 className={`editorial-header ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
            BURN CONFIRMATION
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Critical Warning for Active Dossiers */}
          {hasActiveDossiers && (
            <div className={`
              p-4 rounded-lg mb-4 flex items-start gap-3
              ${theme === 'light' ? 'bg-red-50 border-2 border-red-400' : 'bg-red-900/30 border-2 border-red-600'}
            `}>
              <Shield className={`
                w-5 h-5 flex-shrink-0 mt-0.5
                ${theme === 'light' ? 'text-red-600' : 'text-red-400'}
              `} />
              <div className={`
                text-sm
                ${theme === 'light' ? 'text-red-800' : 'text-red-200'}
              `}>
                <strong className="block mb-2">⚠️ CRITICAL: You have active dossiers!</strong>
                <p className="mb-2">
                  If you burn this account:
                </p>
                <ul className="space-y-1 ml-4">
                  <li>• You will <strong>lose the ability to check in</strong></li>
                  <li>• Your dossiers will <strong>automatically release</strong> after the check-in period expires</li>
                  <li>• Recipients will gain access to your encrypted content</li>
                </ul>
                <p className="mt-2 font-semibold">
                  Consider disabling your dossiers first if you don't want them released.
                </p>
              </div>
            </div>
          )}

          {/* Main Warning */}
          <div className={`
            p-4 rounded-lg mb-4 flex items-start gap-3
            ${theme === 'light' ? 'bg-yellow-50 border border-yellow-200' : 'bg-yellow-900/20 border border-yellow-800'}
          `}>
            <AlertTriangle className={`
              w-5 h-5 flex-shrink-0 mt-0.5
              ${theme === 'light' ? 'text-yellow-600' : 'text-yellow-400'}
            `} />
            <div className={`
              text-sm
              ${theme === 'light' ? 'text-yellow-800' : 'text-yellow-200'}
            `}>
              <strong className="block mb-2">What "Burn" means:</strong>
              <ul className="space-y-1">
                <li>• Deletes the account from <strong>this browser only</strong></li>
                <li>• Can be restored with the private key, but without it the account is <strong>lost forever</strong></li>
              </ul>
            </div>
          </div>

          {/* Backup Reminder */}
          <div className={`
            p-4 rounded-lg mb-6 flex items-start gap-3
            ${theme === 'light' ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-800'}
          `}>
            <Key className={`
              w-5 h-5 flex-shrink-0 mt-0.5
              ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}
            `} />
            <div className={`
              text-sm
              ${theme === 'light' ? 'text-blue-800' : 'text-blue-200'}
            `}>
              <strong className="block mb-1">💡 Backup Reminder:</strong>
              <p>
                Use the "Backup Private Key" function below to save your key before burning.
                This allows you to restore the account later if needed.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`
                block text-sm font-medium mb-2
                ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}
              `}>
                Type <span className="font-mono font-bold">BURN</span> to confirm deletion:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setError(false);
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type BURN here"
                className={`
                  w-full px-4 py-3 rounded-lg border text-base font-mono
                  transition-all duration-200
                  ${error
                    ? theme === 'light'
                      ? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
                      : 'border-red-500 bg-red-900/20 text-red-200 placeholder-red-600'
                    : theme === 'light'
                      ? 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : 'border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  }
                `}
                autoFocus
              />
              {error && (
                <p className={`
                  mt-2 text-sm
                  ${theme === 'light' ? 'text-red-600' : 'text-red-400'}
                `}>
                  Please type BURN exactly as shown
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}
          px-6 py-5 flex gap-3
        `}>
          <button
            onClick={onCancel}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
              ${theme === 'light'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={confirmText !== 'BURN'}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
              flex items-center justify-center gap-2
              ${confirmText === 'BURN'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : theme === 'light'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <Flame className="w-4 h-4" />
            <span>Burn Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}