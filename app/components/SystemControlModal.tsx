'use client';

import { useTheme } from '../lib/theme-context';
import { AlertTriangle, Pause, Play, Clock } from 'lucide-react';

interface SystemControlModalProps {
  isEnabled: boolean;
  activeDossierCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SystemControlModal({
  isEnabled,
  activeDossierCount,
  onConfirm,
  onCancel,
}: SystemControlModalProps) {
  const { theme } = useTheme();

  const actionText = isEnabled ? 'Pause' : 'Resume';
  const actionColor = isEnabled ? 'red' : 'green';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`max-w-lg w-full rounded-lg shadow-xl ${
          theme === 'light'
            ? 'bg-white border border-gray-200'
            : 'bg-gray-900 border border-gray-700'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b ${
            theme === 'light' ? 'border-gray-200' : 'border-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <Pause
                className={`w-6 h-6 text-red-500`}
              />
            ) : (
              <Play
                className={`w-6 h-6 text-green-500`}
              />
            )}
            <h2
              className={`text-xl font-semibold ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}
            >
              {actionText} All Dossiers
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Warning Box */}
          <div
            className={`p-4 rounded-lg border ${
              isEnabled
                ? theme === 'light'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-red-900/20 border-red-800'
                : theme === 'light'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-green-900/20 border-green-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {isEnabled ? (
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  theme === 'light' ? 'text-red-700' : 'text-red-400'
                }`} />
              ) : (
                <Clock className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  theme === 'light' ? 'text-green-700' : 'text-green-400'
                }`} />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium mb-2 ${
                    isEnabled
                      ? theme === 'light'
                        ? 'text-red-900'
                        : 'text-red-100'
                      : theme === 'light'
                        ? 'text-green-900'
                        : 'text-green-100'
                  }`}
                >
                  {isEnabled
                    ? `Pause ${activeDossierCount} Active Dossier${activeDossierCount !== 1 ? 's' : ''}?`
                    : `Resume ${activeDossierCount} Paused Dossier${activeDossierCount !== 1 ? 's' : ''}?`}
                </p>
                <p
                  className={`text-sm ${
                    isEnabled
                      ? theme === 'light'
                        ? 'text-red-800'
                        : 'text-red-200'
                      : theme === 'light'
                        ? 'text-green-800'
                        : 'text-green-200'
                  }`}
                >
                  {isEnabled
                    ? 'This will pause all your active dossiers. While paused, they will not release even if check-in intervals expire.'
                    : 'This will resume all your paused dossiers. They will continue their normal check-in countdown.'}
                </p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div
            className={`p-4 rounded-lg ${
              theme === 'light'
                ? 'bg-gray-50 border border-gray-200'
                : 'bg-gray-800/50 border border-gray-700'
            }`}
          >
            <h3
              className={`text-sm font-medium mb-2 ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}
            >
              What happens when you {actionText.toLowerCase()}:
            </h3>
            <ul
              className={`text-sm space-y-1 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              {isEnabled ? (
                <>
                  <li>• All active dossiers will be marked as paused</li>
                  <li>• Check-in countdowns will freeze</li>
                  <li>• No releases will occur until you resume</li>
                  <li>• You can resume anytime from this control</li>
                </>
              ) : (
                <>
                  <li>• All paused dossiers will become active again</li>
                  <li>• Check-in countdowns will resume from where they left off</li>
                  <li>• Normal release behavior will continue</li>
                  <li>• You'll need to check in regularly again</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div
          className={`px-6 py-4 border-t ${
            theme === 'light' ? 'border-gray-200' : 'border-gray-700'
          }`}
        >
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'light'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isEnabled
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {actionText} All Dossiers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
