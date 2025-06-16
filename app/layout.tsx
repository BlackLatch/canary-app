import type { Metadata } from "next";
import { Playfair_Display, Crimson_Text } from "next/font/google";
import "./globals.css";
import { Web3Provider } from './components/Web3Provider';
import { Toaster } from 'react-hot-toast';

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
  title: "Canary - Decentralized Deadman Switch",
  description: "Sophisticated journalistic dead man switch app for secure conditional file encryption and release",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${playfair.variable} ${crimson.variable} antialiased text-gray-900 h-full`}
      >
        <Web3Provider>
          {children}
        </Web3Provider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 5000,
            className: 'editorial-toast',
            style: {
              background: '#ffffff',
              color: '#111827',
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
                border: '2px solid #10b981',
                background: '#f0fdf4',
                color: '#166534',
              },
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              style: {
                border: '2px solid #ef4444',
                background: '#fef2f2',
                color: '#991b1b',
              },
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
            loading: {
              style: {
                border: '2px solid #111827',
                background: '#f9fafb',
                color: '#111827',
              },
              iconTheme: {
                primary: '#111827',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
