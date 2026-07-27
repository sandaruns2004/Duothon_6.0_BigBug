import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'AegisVault — Digital Banking & Cryptographic Security Platform',
  description: 'Next-generation ACID-compliant fintech banking platform with multi-channel notifications, tamper-evident SHA-256 audit trails, and real-time fraud prevention.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-white selection:bg-primary/30 selection:text-primary flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
          {children}
        </main>
        <footer className="border-t border-border/40 py-6 mt-12 text-center text-xs text-gray-500 bg-surface/30">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>© 2026 AegisVault Financial Technologies Inc. • IEEE NSBM Duothon 6.0</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Cryptographic Audit Chain: ACTIVE • ISO 8583 Clearing Ready
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
