import { Metadata } from 'next';
import RequisitionsClient from './client';

export const metadata: Metadata = {
  title: 'Stock Requisitions | F&B Management',
};

export default function FnbRequisitionsPage() {
  return <RequisitionsClient />;
}
