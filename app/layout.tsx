import type { Metadata } from "next";
import { Playfair_Display, Crimson_Text } from "next/font/google";
import "./globals.css";
import { Web3Provider } from './components/Web3Provider';
import FloatingNavigation from './components/FloatingNavigation';

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
    <html lang="en">
      <body
        className={`${playfair.variable} ${crimson.variable} antialiased grid-background text-gray-900`}
      >
        <Web3Provider>
          <FloatingNavigation />
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
