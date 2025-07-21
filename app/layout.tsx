import type { Metadata } from "next";
import { Playfair_Display, Crimson_Text } from "next/font/google";
import "./globals.css";
import { Web3Provider } from './components/Web3Provider';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './lib/theme-context';

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const crimson = Crimson_Text({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canary - Decentralized Encrypted Deadman Switch",
  description: "Canary is an automated deadman switch for truth protection, using TACo threshold encryption, decentralized storage, and smart contracts to ensure sensitive information reaches the public even if journalists, activists, whistleblowers, or everyday citizens are silenced.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${playfair.variable} ${crimson.variable} antialiased h-full`}
      >
        <ThemeProvider>
          <Web3Provider>
            {children}
          </Web3Provider>
        </ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            className: 'editorial-toast',
            style: {
              background: '#ffffff',
              color: '#0B0C10',
              border: '2px solid #e5e7eb',
              borderRadius: '0px',
              fontSize: '15px',
              fontFamily: 'var(--font-crimson)',
              fontWeight: '600',
              padding: '16px 20px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              maxWidth: '400px',
              lineHeight: '1.6',
            },
            success: {
              style: {
                border: '2px solid #B8E994',
                background: '#f0fdf4',
                color: '#166534',
              },
              iconTheme: {
                primary: '#B8E994',
                secondary: '#ffffff',
              },
            },
            error: {
              style: {
                border: '2px solid #FF6B6B',
                background: '#fef2f2',
                color: '#991b1b',
              },
              iconTheme: {
                primary: '#FF6B6B',
                secondary: '#ffffff',
              },
            },
            loading: {
              style: {
                border: '2px solid #C0E5A9',
                background: '#f9fafb',
                color: '#0B0C10',
              },
              iconTheme: {
                primary: '#C0E5A9',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
