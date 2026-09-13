import { Metadata } from 'next';
import FnbDashboardClient from './client';

export const metadata: Metadata = {
  title: 'F&B Dashboard | LodgeCore',
  description: 'Overview of Food and Beverage operations.',
};

export default function FnbDashboardPage() {
  return <FnbDashboardClient />;
}
