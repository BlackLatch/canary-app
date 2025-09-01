'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  const [content, setContent] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check system theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }

    // Load the markdown content
    fetch('/canary-privacy-policy.md')
      .then(res => res.text())
      .then(text => {
        // Process the markdown more carefully
        let html = text;
        
        // First, handle multi-line list items by joining them
        html = html.replace(/^- (.+?)(?=\n(?:- |\n|#|$))/gms, (match, content) => {
          const cleanContent = content.replace(/\n(?!- )/g, ' ').trim();
          return `<li class="editorial-body mb-2">• ${cleanContent}</li>`;
        });
        
        // Wrap consecutive list items in ul tags
        html = html.replace(/(<li class="editorial-body.*?<\/li>\s*)+/g, (match) => {
          return `<ul class="space-y-2 mb-4">${match}</ul>`;
        });
        
        // Headers
        html = html
          .replace(/^# (.+)$/gm, '<h1 class="editorial-header text-3xl mb-6 mt-8">$1</h1>')
          .replace(/^## (.+)$/gm, '<h2 class="editorial-header text-2xl mt-8 mb-4">$2</h2>')
          .replace(/^### (.+)$/gm, '<h3 class="editorial-label uppercase tracking-wider text-sm mt-6 mb-3">$1</h3>');
        
        // Horizontal rules
        html = html.replace(/^---$/gm, '<hr class="border-t border-gray-300 dark:border-gray-700 my-8">');
        
        // Bold and italic
        html = html
          .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
          .replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Links
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>');
        
        // Paragraphs - split on double newlines
        const paragraphs = html.split(/\n\n+/);
        html = paragraphs
          .map(p => {
            p = p.trim();
            if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<hr')) {
              return p;
            }
            if (p) {
              return `<p class="editorial-body mb-4">${p}</p>`;
            }
            return '';
          })
          .filter(p => p)
          .join('\n');
        
        setContent(html);
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