import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOVATrADE | Premium Trading Platform',
  description: 'Trade Crypto, Forex, and Stocks with institutional-grade tools. Copy top traders automatically. Join 2.8M+ traders worldwide.',
  keywords: ['trading', 'crypto', 'forex', 'stocks', 'copy trading', 'bitcoin', 'ethereum'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="bg-void text-cream antialiased">
        {/* Noise overlay for texture */}
        <div className="noise-overlay" />
        
        {/* Main content */}
        {children}
      </body>
    </html>
  );
}
