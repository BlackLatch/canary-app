'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfService() {
  const [content, setContent] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check system theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }

    // Load the markdown content
    fetch('/canary-terms-of-service.md')
      .then(res => res.text())
      .then(text => {
        // Convert markdown to basic HTML (simple conversion)
        const html = text
          .replace(/^# (.+)$/gm, '<h1 class="editorial-header text-3xl mb-4">$1</h1>')
          .replace(/^## (.+)$/gm, '<h2 class="editorial-header text-xl mt-8 mb-3">$1</h2>')
          .replace(/^### (.+)$/gm, '<h3 class="editorial-label uppercase tracking-wider mt-6 mb-2">$1</h3>')
          .replace(/^- (.+)$/gm, '<li class="editorial-body ml-4">• $1</li>')
          .replace(/^---$/gm, '<hr class="border-t border-gray-300 dark:border-gray-700 my-8">')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/_(.+?)_/g, '<em>$1</em>')
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')
          .replace(/\n\n/g, '</p><p class="editorial-body mb-4">');
        
        setContent(`<p class="editorial-body mb-4">${html}</p>`);
      })
      .catch(err => {
        console.error('Failed to load policy:', err);
        setContent('<p class="editorial-body">Failed to load policy content.</p>');
      });
  }, []);

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <div className="max-w-4xl mx-auto p-8">
        <Link 
          href="/"
          className={`inline-flex items-center gap-2 mb-8 editorial-body hover:underline ${
            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
          }`}
        >
          <ArrowLeft size={16} />
          Back to Canary
        </Link>

        <div className={`editorial-card-bordered p-8 ${
          theme === 'light' 
            ? 'bg-white border-gray-300' 
            : 'bg-black border-gray-700'
        }`}>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </div>
    </div>
  );
}