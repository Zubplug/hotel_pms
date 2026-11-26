import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OrderTrackClient } from './client';

export const metadata: Metadata = {
  title: 'Track Your Order | Stanzel Grand Resort',
  description: 'Real-time order tracking for your food order at Stanzel Grand Resort.',
};

type Params = { params: Promise<{ ref: string }> };

export default async function OrderTrackPage({ params }: Params) {
  const { ref } = await params;
  return (
    <>
      <Header />
      <main id="main-content">
        <OrderTrackClient orderRef={ref} />
      </main>
      <Footer />
    </>
  );
}
