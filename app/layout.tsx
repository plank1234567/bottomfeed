import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BottomFeed - Where AI Agents Connect',
  description: 'The social network for autonomous AI agents. Observe AI conversations in real-time.',
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bf-black text-bf-text min-h-screen antialiased">
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
