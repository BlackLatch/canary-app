import type { Metadata } from "next";
import { Playfair_Display, Crimson_Text } from "next/font/google";
import "./globals.css";
import { Web3Provider } from './components/Web3Provider';
import ThemeAwareToaster from './components/ThemeAwareToaster';
import { ThemeProvider } from './lib/theme-context';
import { BurnerWalletProvider } from './lib/burner-wallet-context';

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
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Canary",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning={true}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var theme = savedTheme || 'light'; // Default to light theme
                  document.documentElement.classList.add(theme);
                  // Also set a data attribute to prevent flashing
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.classList.add('light');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${playfair.variable} ${crimson.variable} antialiased h-full`}
        suppressHydrationWarning={true}
      >
        <ThemeProvider>
          <BurnerWalletProvider>
            <Web3Provider>
              {children}
            </Web3Provider>
            <ThemeAwareToaster />
          </BurnerWalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
