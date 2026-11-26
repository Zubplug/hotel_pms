import type { Metadata } from 'next';
import { getMenu, getPromotions, getStorefront } from '@/lib/commerce';
import { OutdoorServiceClient } from './client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Outdoor & Poolside Dining | Stanzel Grand Resort',
  description:
    'Order fresh food and premium drinks to your poolside cabana, patio or outdoor table at Stanzel Grand Resort, Abuja. No app needed — delivered to where you are.',
  openGraph: {
    title: 'Outdoor & Poolside Dining | Stanzel Grand Resort',
    description: 'Luxury open-air dining delivered to your cabana.',
    images: [{ url: '/images/pool-evening.jpg', width: 1200, height: 630 }],
  },
};

export const revalidate = 30;

export default async function OutdoorServicePage() {
  const [storeResult, menuResult, promotionsResult] = await Promise.allSettled([
    getStorefront(),
    getMenu(),
    getPromotions(),
  ]);

  const store = storeResult.status === 'fulfilled' ? storeResult.value : null;
  const menus = menuResult.status === 'fulfilled' ? menuResult.value : [];
  const promotions = promotionsResult.status === 'fulfilled' ? promotionsResult.value : [];

  return (
    <>
      <Header />
      <main id="main-content">
        <OutdoorServiceClient store={store} menus={menus} promotions={promotions} />
      </main>
      <Footer />
    </>
  );
}
