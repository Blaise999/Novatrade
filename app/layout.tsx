import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// ============================================
// Fonts
// ============================================
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

// ============================================
// Metadata
// ============================================
export const metadata: Metadata = {
  title: {
    default: 'NOVATRADE - Trade Smarter, Not Harder',
    template: '%s | NOVATRADE',
  },
  description: 'Join over 2.8 million traders worldwide. Access global markets with institutional-grade tools and zero commission on crypto.',
  keywords: ['trading', 'crypto', 'forex', 'stocks', 'binary options', 'investment', 'trading platform'],
  authors: [{ name: 'NOVATRADE' }],
  creator: 'NOVATRADE',
  publisher: 'NOVATRADE',
  openGraph: {
    title: 'NOVATRADE - Trade Smarter, Not Harder',
    description: 'Join over 2.8 million traders worldwide. Access global markets with institutional-grade tools.',
    type: 'website',
    locale: 'en_US',
    siteName: 'NOVATRADE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOVATRADE - Trade Smarter, Not Harder',
    description: 'Join over 2.8 million traders worldwide.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#050508',
};

// ============================================
// Root Layout
// ============================================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${spaceGrotesk.variable}`} 
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body 
        className="font-sans antialiased bg-[#050508] text-white min-h-screen"
        suppressHydrationWarning
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
