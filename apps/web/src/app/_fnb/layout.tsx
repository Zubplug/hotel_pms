import React from 'react';
import { FnbLayout } from '@/components/layout/FnbLayout';

export default function FnbLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <FnbLayout>
      {children}
    </FnbLayout>
  );
}
