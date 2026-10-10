import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stanzelgrandresort.com'),
  title: {
    default: 'Stanzel Grand Resort — Luxury Hospitality in Nigeria',
    template: '%s | Stanzel Grand Resort',
  },
  description:
    'Experience world-class luxury at Stanzel Grand Resort. Premium guest rooms, fine dining, curated leisure and seamless hospitality in the heart of Nigeria.',
  keywords: ['Stanzel Grand Resort', 'luxury hotel Nigeria', 'grand resort', 'hotel booking Nigeria', 'fine dining hotel'],
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: '/',
    siteName: 'Stanzel Grand Resort',
    title: 'Stanzel Grand Resort — Luxury Hospitality in Nigeria',
    description: 'World-class luxury. Exceptional dining. Unforgettable stays.',
    images: [{ url: '/images/hero-entrance.jpg', width: 1200, height: 630, alt: 'Stanzel Grand Resort entrance' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stanzel Grand Resort',
    description: 'World-class luxury. Exceptional dining. Unforgettable stays.',
    images: ['/images/hero-entrance.jpg'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
