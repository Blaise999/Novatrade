import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'NovaTrade - Trade Smarter, Not Harder',
  description: 'Join over 2.8 million traders worldwide. Access global markets with institutional-grade tools and zero commission on crypto.',
  keywords: ['trading', 'crypto', 'forex', 'stocks', 'investment', 'copy trading'],
  authors: [{ name: 'NovaTrade' }],
  openGraph: {
    title: 'NovaTrade - Trade Smarter, Not Harder',
    description: 'Join over 2.8 million traders worldwide. Access global markets with institutional-grade tools.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
