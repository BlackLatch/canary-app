'use client';

import { useState, useEffect } from 'react';
import { X, Download, FileText, Image as ImageIcon, Video, Music, File, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../lib/theme-context';

interface DecryptedFile {
  data: Uint8Array;
  metadata: {
    name: string;
    type: string;
    size: number;
  };
  blobUrl?: string;
}

interface DecryptionProgress {
  stage: 'fetching' | 'decrypting' | 'complete' | 'error';
  currentFile: number;
  totalFiles: number;
  currentFileName?: string;
  error?: string;
}

interface DecryptionViewProps {
  isOpen: boolean;
  onClose: () => void;
  progress: DecryptionProgress;
  decryptedFiles: DecryptedFile[];
}

export default function DecryptionView({
  isOpen,
  onClose,
  progress,
  decryptedFiles,
}: DecryptionViewProps) {
  const { theme } = useTheme();
  const [selectedFile, setSelectedFile] = useState<DecryptedFile | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());

  // Create blob URLs for preview
  useEffect(() => {
    const newUrls = new Map<string, string>();

    decryptedFiles.forEach(file => {
      if (!previewUrls.has(file.metadata.name)) {
        const blob = new Blob([new Uint8Array(file.data)], { type: file.metadata.type });
        const url = URL.createObjectURL(blob);
        newUrls.set(file.metadata.name, url);
      }
    });

    setPreviewUrls(prev => new Map([...prev, ...newUrls]));

    // Cleanup function
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [decryptedFiles]);

  // Auto-select first file when decryption completes
  useEffect(() => {
    if (progress.stage === 'complete' && decryptedFiles.length > 0 && !selectedFile) {
      setSelectedFile(decryptedFiles[0]);
    }
  }, [progress.stage, decryptedFiles, selectedFile]);

  if (!isOpen) return null;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const getFileTypeLabel = (type: string) => {
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type === 'application/pdf') return 'PDF';
    return 'File';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadFile = (file: DecryptedFile) => {
    const url = previewUrls.get(file.metadata.name);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = file.metadata.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllFiles = () => {
    decryptedFiles.forEach(file => {
      setTimeout(() => downloadFile(file), 100);
    });
  };

  const renderPreview = (file: DecryptedFile) => {
    const url = previewUrls.get(file.metadata.name);
    if (!url) return null;

    const { type } = file.metadata;

    if (type.startsWith('image/')) {
      return (
        <img
          src={url}
          alt={file.metadata.name}
          className="max-w-full max-h-full object-contain"
        />
      );
    }

    if (type.startsWith('video/')) {
      return (
        <video
          src={url}
          controls
          className="max-w-full max-h-full"
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    if (type.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center gap-4">
          <Music className={`w-24 h-24 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`} />
          <audio src={url} controls className="w-full max-w-md" />
        </div>
      );
    }

    if (type === 'application/pdf') {
      return (
        <iframe
          src={url}
          className="w-full h-full"
          title={file.metadata.name}
        />
      );
    }

    // For other file types, show download prompt
    return (
      <div className="flex flex-col items-center gap-4">
        <File className={`w-24 h-24 ${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`} />
        <div className="text-center">
          <p className={`text-lg font-medium mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
            Preview not available
          </p>
          <p className={`text-sm mb-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            Download the file to view its contents
          </p>
          <button
            onClick={() => downloadFile(file)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'light'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Download File
          </button>
        </div>
      </div>
    );
  };

  const progressPercentage = progress.totalFiles > 0
    ? Math.round((progress.currentFile / progress.totalFiles) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`w-full h-full flex flex-col ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          theme === 'light' ? 'border-gray-200' : 'border-gray-700'
        }`}>
          <h2 className={`text-xl font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
            {progress.stage === 'complete' ? 'Decrypted Files' : 'Decrypting Files...'}
          </h2>
          <div className="flex items-center gap-2">
            {progress.stage === 'complete' && decryptedFiles.length > 1 && (
              <button
                onClick={downloadAllFiles}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Download className="w-4 h-4" />
                Download All
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'light'
                  ? 'hover:bg-gray-100 text-gray-600'
                  : 'hover:bg-gray-800 text-gray-400'
              }`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Section */}
        {progress.stage !== 'complete' && progress.stage !== 'error' && (
          <div className={`px-6 py-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className={`w-5 h-5 animate-spin ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                {progress.stage === 'fetching' ? 'Fetching from IPFS...' : 'Decrypting...'}
                {progress.currentFileName && ` ${progress.currentFileName}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className={`w-full h-2 rounded-full overflow-hidden ${
                  theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
                }`}>
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                {progress.currentFile} / {progress.totalFiles}
              </span>
            </div>
          </div>
        )}

        {/* Error Section */}
        {progress.stage === 'error' && (
          <div className={`px-6 py-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-500">
                {progress.error || 'Decryption failed'}
              </span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File List Sidebar */}
          {decryptedFiles.length > 0 && (
            <div className={`w-80 border-r overflow-y-auto ${
              theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
            }`}>
              <div className="p-4">
                <h3 className={`text-sm font-semibold mb-3 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  Files ({decryptedFiles.length})
                </h3>
                <div className="space-y-2">
                  {decryptedFiles.map((file, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedFile === file
                          ? theme === 'light'
                            ? 'bg-blue-100 border-blue-300'
                            : 'bg-blue-900/30 border-blue-700'
                          : theme === 'light'
                            ? 'bg-white hover:bg-gray-100 border-gray-200'
                            : 'bg-gray-900 hover:bg-gray-800 border-gray-700'
                      } border`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={selectedFile === file
                          ? 'text-blue-600'
                          : theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }>
                          {getFileIcon(file.metadata.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                          }`}>
                            {file.metadata.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${
                              theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {getFileTypeLabel(file.metadata.type)}
                            </span>
                            <span className={`text-xs ${
                              theme === 'light' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              •
                            </span>
                            <span className={`text-xs ${
                              theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {formatFileSize(file.metadata.size)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(file);
                          }}
                          className={`p-1 rounded transition-colors ${
                            theme === 'light'
                              ? 'hover:bg-gray-200 text-gray-600'
                              : 'hover:bg-gray-700 text-gray-400'
                          }`}
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview Area */}
          <div className="flex-1 overflow-auto">
            {progress.stage === 'complete' && selectedFile ? (
              <div className="h-full flex flex-col">
                {/* File Info Header */}
                <div className={`px-6 py-4 border-b ${
                  theme === 'light' ? 'border-gray-200' : 'border-gray-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                      }`}>
                        {selectedFile.metadata.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-sm ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {getFileTypeLabel(selectedFile.metadata.type)}
                        </span>
                        <span className={`text-sm ${
                          theme === 'light' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          •
                        </span>
                        <span className={`text-sm ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {formatFileSize(selectedFile.metadata.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadFile(selectedFile)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        theme === 'light'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 flex items-center justify-center p-6">
                  {renderPreview(selectedFile)}
                </div>
              </div>
            ) : progress.stage === 'error' ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className={`text-xl font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Decryption Failed
                  </h3>
                  <p className={`text-sm ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {progress.error || 'An error occurred during decryption'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className={`w-16 h-16 animate-spin mx-auto mb-4 ${
                    theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                  }`} />
                  <h3 className={`text-xl font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    {progress.stage === 'fetching' ? 'Fetching Files' : 'Decrypting Files'}
                  </h3>
                  <p className={`text-sm ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    This may take a few moments...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
