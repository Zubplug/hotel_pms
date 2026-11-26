import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CheckoutClient } from './client';

export const metadata: Metadata = {
  title: 'Place Your Order | Stanzel Grand Resort',
  description: 'Complete your food order at Stanzel Grand Resort. Pickup or delivery available.',
};

export default function OrderPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <CheckoutClient />
      </main>
      <Footer />
    </>
  );
}
