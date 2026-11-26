import type { Metadata } from 'next';
import { getStorefront, getMenu } from '@/lib/commerce';
import { DiningClient } from './client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Restaurant & Bar | Stanzel Grand Resort',
  description:
    'Order authentic Nigerian and continental cuisine online from Stanzel Grand Resort — pickup or delivery. Browse our live menu and place your order in minutes.',
};

export const revalidate = 30;

export default async function DiningPage() {
  // Fetch store info and menu server-side for fast first paint + SEO
  const [store, menus] = await Promise.all([
    getStorefront().catch(() => null),
    getMenu().catch(() => []),
  ]);

  return (
    <>
      <Header />
      <main id="main-content">
        <DiningClient store={store} menus={menus} />
      </main>
      <Footer />
    </>
  );
}
