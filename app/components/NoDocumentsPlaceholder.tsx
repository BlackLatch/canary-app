'use client';

import React from 'react';

interface NoDocumentsPlaceholderProps {
  theme: 'light' | 'dark';
  onCreateClick: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
}

export default function NoDocumentsPlaceholder({
  theme,
  onCreateClick,
  title = 'No Dossiers Yet',
  description = 'Create your first encrypted dossier to get started',
  buttonText = 'CREATE DOSSIER'
}: NoDocumentsPlaceholderProps) {
  return (
    <div className={`text-center py-16 border rounded-lg ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-black/30 mb-6">
        <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="editorial-header text-black dark:text-gray-100 mb-3">
        {title}
      </h3>
      <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6">
        {description}
      </p>
      <button
        onClick={onCreateClick}
        className={`px-6 py-3 border rounded-lg font-medium uppercase tracking-wider transition-all inline-flex items-center gap-2 ${
          theme === 'light' 
            ? 'bg-black text-white hover:bg-gray-800 border-black' 
            : 'bg-white text-gray-900 hover:bg-gray-100 border-white'
        }`}
      >
        <span>{buttonText}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}