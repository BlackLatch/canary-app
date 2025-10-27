'use client';

import { AlertTriangle } from 'lucide-react';
import { useTheme } from '@/app/lib/theme-context';

interface BurnAccountWarningModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BurnAccountWarningModal({
  onConfirm,
  onCancel
}: BurnAccountWarningModalProps) {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`
        ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}
        border ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}
        shadow-xl max-w-lg w-full
      `}>
        {/* Header with Warning Icon */}
        <div className={`
          border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}
          px-6 py-5 flex items-center gap-3
        `}>
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <h2 className={`editorial-header ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
            WARNING
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className={`
            p-4 rounded-lg mb-6
            ${theme === 'light' ? 'bg-red-50 border border-red-200' : 'bg-red-900/20 border border-red-800'}
          `}>
            <p className={`
              text-base font-semibold mb-3
              ${theme === 'light' ? 'text-red-900' : 'text-red-200'}
            `}>
              Creating a new anonymous account will PERMANENTLY DELETE your existing account!
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-2">
              <span className={`text-sm mt-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                Your current account will be <strong>lost forever</strong>
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className={`text-sm mt-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                Any funds or dossiers associated with it will be <strong>inaccessible</strong>
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className={`text-sm mt-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                This action <strong>cannot be undone</strong>
              </p>
            </div>
          </div>

          <div className={`
            p-4 rounded-lg
            ${theme === 'light' ? 'bg-yellow-50 border border-yellow-200' : 'bg-yellow-900/20 border border-yellow-800'}
          `}>
            <p className={`
              text-sm
              ${theme === 'light' ? 'text-yellow-800' : 'text-yellow-200'}
            `}>
              <strong>Important:</strong> Make sure you have backed up your private key if you need to restore this account later.
            </p>
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
            onClick={onConfirm}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
              bg-red-600 text-white hover:bg-red-700
              flex items-center justify-center gap-2
            `}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Yes, Create New Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}