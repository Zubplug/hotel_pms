import { Metadata } from 'next';
import { FnbOrdersClient } from './client';

export const metadata: Metadata = {
  title: 'Live Orders | F&B Management',
};

export default function FnbOrdersPage() {
  return <div className="fnb-dark-surface min-h-full"><FnbOrdersClient /></div>;
}
