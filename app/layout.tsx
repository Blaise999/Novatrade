import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'NovaTrade',
  description: 'NovaTrade trading platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-void text-cream">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
