import { Metadata } from 'next';
import { CommerceDashboardClient } from './client';

export const metadata: Metadata = {
  title: 'Food Commerce — Dashboard',
};

export default function CommerceDashboardPage() {
  return <CommerceDashboardClient />;
}
