import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BoxRetreat — Surf Cabin · Luquillo, Puerto Rico',
  description: 'A solar-powered container cabin steps from Luquillo Beach, Puerto Rico. Surf, explore El Yunque, and disconnect. Book direct — no platform fees.',
  openGraph: {
    title: 'BoxRetreat — Surf Cabin · Luquillo, Puerto Rico',
    description: 'Steps from the surf. Minutes from El Yunque. Solar-powered container cabin with BBQ deck. Book direct.',
    images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=630&fit=crop&q=90'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
