import { Metadata } from 'next';
import { CommerceDeliveryClient } from './client';

export const metadata: Metadata = { title: 'Delivery Operations | Food Commerce' };

export default function CommerceDeliveryPage() {
  return <CommerceDeliveryClient />;
}
