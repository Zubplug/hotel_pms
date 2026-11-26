import type { Metadata } from 'next';
import { getMenu, getStorefront } from '@/lib/commerce';
import { DiningClient } from '@/app/dining/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Outdoor Service | Stanzel Grand Resort',
  description: 'Order food and drinks for poolside and outdoor service at Stanzel Grand Resort.',
};

export const revalidate = 30;

export default async function OutdoorServicePage() {
  const [store, menus] = await Promise.all([
    getStorefront().catch(() => null),
    getMenu().catch(() => []),
  ]);

  return (
    <>
      <Header />
      <main id="main-content">
        <DiningClient store={store} menus={menus} experience="outdoor" />
      </main>
      <Footer />
    </>
  );
}
