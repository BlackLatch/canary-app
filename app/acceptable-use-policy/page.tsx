'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { marked } from 'marked';

export default function AcceptableUsePolicy() {
  const [content, setContent] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check system theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }

    // Load and parse the markdown content
    fetch('/canary-acceptable-use-policy.md')
      .then(res => res.text())
      .then((text) => {
        try {
          // Parse markdown to HTML first
          let html = marked.parse(text, {
            breaks: true,
            gfm: true
          });
          
          // Apply custom styles to the HTML
          // Headers
          html = html.replace(/<h1>(.*?)<\/h1>/g, '<h1 class="editorial-header text-3xl mb-3 mt-6">$1</h1>');
          html = html.replace(/<h2>(.*?)<\/h2>/g, '<h2 class="editorial-header text-2xl mt-6 mb-2">$1</h2>');
          html = html.replace(/<h3>(.*?)<\/h3>/g, '<h3 class="editorial-label uppercase tracking-wider text-sm mt-4 mb-2">$1</h3>');
          html = html.replace(/<h4>(.*?)<\/h4>/g, '<h4 class="editorial-header mt-4 mb-2">$1</h4>');
          html = html.replace(/<h5>(.*?)<\/h5>/g, '<h5 class="editorial-header mt-4 mb-2">$1</h5>');
          html = html.replace(/<h6>(.*?)<\/h6>/g, '<h6 class="editorial-header mt-4 mb-2">$1</h6>');
          
          // Paragraphs
          html = html.replace(/<p>/g, '<p class="mb-2 leading-relaxed">');
          
          // Lists
          html = html.replace(/<ul>/g, '<ul class="list-disc mb-3 ml-6 leading-snug">');
          html = html.replace(/<ol>/g, '<ol class="list-decimal mb-3 ml-6 leading-snug">');
          html = html.replace(/<li>/g, '<li class="mb-1">');
          
          // Links
          html = html.replace(/<a /g, '<a class="text-blue-600 dark:text-blue-400 hover:underline" ');
          
          // Strong
          html = html.replace(/<strong>/g, '<strong class="font-semibold">');
          
          // Horizontal rules
          html = html.replace(/<hr>/g, '<hr class="border-t border-gray-300 dark:border-gray-700 my-6" />');
          
          setContent(html);
        } catch (err) {
          console.error('Error parsing markdown:', err);
          setContent('<p class="text-red-600">Error loading content. Please refresh the page.</p>');
        }
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