'use client';

import { Shield } from 'lucide-react';
import { useTheme } from '@/app/lib/theme-context';

interface GuardianConfirmReleaseModalProps {
  dossierName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GuardianConfirmReleaseModal({
  dossierName,
  onConfirm,
  onCancel
}: GuardianConfirmReleaseModalProps) {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`
        ${theme === 'light' ? 'bg-white' : 'bg-black'}
        border ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}
        rounded-lg max-w-lg w-full
      `}>
        {/* Header with Shield Icon */}
        <div className={`
          border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}
          px-6 py-4 flex items-center gap-3
        `}>
          <Shield className="w-6 h-6 text-[#e53e3e] flex-shrink-0" />
          <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
            CONFIRM GUARDIAN RELEASE
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <div className={`
            p-4 rounded-lg mb-5 border
            ${theme === 'light' ? 'bg-gray-50 border-gray-300' : 'bg-white/5 border-gray-700'}
          `}>
            <p className={`
              text-base font-semibold
              ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}
            `}>
              You are about to confirm the release of this dossier as a guardian.
            </p>
          </div>

          <div className={`
            p-4 rounded-lg mb-5 border
            ${theme === 'light' ? 'bg-gray-50 border-gray-300' : 'bg-white/5 border-gray-700'}
          `}>
            <p className={`
              text-sm font-medium mb-1
              ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}
            `}>
              Dossier:
            </p>
            <p className={`
              text-base font-semibold
              ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}
            `}>
              {dossierName}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-2">
              <span className={`text-sm mt-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                Your confirmation will be <strong>recorded on the blockchain</strong>
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className={`text-sm mt-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                Once the guardian threshold is met, the dossier will be <strong>released for decryption</strong>
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
            p-4 rounded-lg border
            ${theme === 'light' ? 'bg-gray-50 border-gray-300' : 'bg-white/5 border-gray-700'}
          `}>
            <p className={`
              text-sm
              ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}
            `}>
              <strong>Important:</strong> As a guardian, you are trusted to confirm release only when appropriate. Please ensure you have verified the circumstances warrant this action.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          border-t ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}
          px-6 py-4 flex gap-3
        `}>
          <button
            onClick={onCancel}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
              ${theme === 'light'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'}
            `}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
              ${theme === 'light'
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-white text-gray-900 hover:bg-gray-100'}
              flex items-center justify-center gap-2
            `}
          >
            <Shield className="w-4 h-4" />
            <span>Confirm Release</span>
          </button>
        </div>
      </div>
    </div>
  );
}
