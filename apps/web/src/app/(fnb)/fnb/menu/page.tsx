import { Metadata } from 'next';
import { FnbMenuClient } from './client';

export const metadata: Metadata = {
  title: 'Menu Management | F&B Management',
};

export default function FnbMenuPage() {
  return <div className="fnb-dark-surface min-h-full"><FnbMenuClient /></div>;
}
