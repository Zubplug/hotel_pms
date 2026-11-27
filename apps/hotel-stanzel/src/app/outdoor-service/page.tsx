import type { Metadata } from 'next';
import { getMenu, getPromotions, getStorefront } from '@/lib/commerce';
import { OutdoorServiceClient } from './client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Order Online | Stanzel Grand Resort',
  description:
    'Explore the Stanzel Grand Resort food and beverage menu. Order freshly prepared dishes, drinks and signature selections for delivery or collection.',
  openGraph: {
    title: 'Order Online | Stanzel Grand Resort',
    description: 'A considered selection of dishes and drinks, prepared to order and delivered with care.',
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
