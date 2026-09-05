import { Metadata } from 'next';
import { FnbInventoryClient } from './client';

export const metadata: Metadata = {
  title: 'Outlet Inventory | F&B Management',
};

export default function FnbInventoryPage() {
  return <FnbInventoryClient />;
}
