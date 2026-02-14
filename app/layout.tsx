import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'NOVATrADE — AI-Powered Trading Platform',
  description: 'Trade crypto, forex, and stocks with AI-powered signals, advanced analytics, and institutional-grade tools.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-void text-cream font-body antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
