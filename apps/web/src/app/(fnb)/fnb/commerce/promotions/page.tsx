import { Metadata } from 'next';
import { CommercePromotionsClient } from './client';
export const metadata: Metadata = { title: 'Promotions | Food Commerce' };
export default function CommercePromotionsPage() { return <CommercePromotionsClient />; }
