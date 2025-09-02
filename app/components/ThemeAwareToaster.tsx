'use client';

import { Toaster } from 'react-hot-toast';
import { useTheme } from '@/app/lib/theme-context';

export default function ThemeAwareToaster() {
  const { theme } = useTheme();

  const lightStyles = {
    background: '#ffffff',
    color: '#0B0C10',
    border: '2px solid #e5e7eb',
  };

  const darkStyles = {
    background: '#000000',
    color: '#ffffff',
    border: '2px solid #4b5563',
  };

  const baseStyles = theme === 'light' ? lightStyles : darkStyles;

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        className: 'editorial-toast',
        style: {
          ...baseStyles,
          borderRadius: '0px',
          fontSize: '15px',
          fontFamily: 'var(--font-crimson)',
          fontWeight: '600',
          padding: '16px 20px',
          boxShadow: theme === 'light' 
            ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
            : '0 4px 6px -1px rgb(255 255 255 / 0.1), 0 2px 4px -2px rgb(255 255 255 / 0.1)',
          maxWidth: '400px',
          lineHeight: '1.6',
        },
        success: {
          style: {
            border: theme === 'light' ? '2px solid #B8E994' : '2px solid #4ade80',
            background: theme === 'light' ? '#f0fdf4' : '#052e16',
            color: theme === 'light' ? '#166534' : '#bbf7d0',
          },
          iconTheme: {
            primary: theme === 'light' ? '#B8E994' : '#4ade80',
            secondary: theme === 'light' ? '#ffffff' : '#000000',
          },
        },
        error: {
          style: {
            border: theme === 'light' ? '2px solid #FF6B6B' : '2px solid #ef4444',
            background: theme === 'light' ? '#fef2f2' : '#450a0a',
            color: theme === 'light' ? '#991b1b' : '#fecaca',
          },
          iconTheme: {
            primary: theme === 'light' ? '#FF6B6B' : '#ef4444',
            secondary: theme === 'light' ? '#ffffff' : '#000000',
          },
        },
        loading: {
          style: {
            border: theme === 'light' ? '2px solid #C0E5A9' : '2px solid #6b7280',
            background: theme === 'light' ? '#f9fafb' : '#111111',
            color: theme === 'light' ? '#0B0C10' : '#e5e7eb',
          },
          iconTheme: {
            primary: theme === 'light' ? '#C0E5A9' : '#6b7280',
            secondary: theme === 'light' ? '#ffffff' : '#000000',
          },
        },
      }}
    />
  );
}