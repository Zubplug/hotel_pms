import { ExternalAuditorLayout } from '@/components/layout/ExternalAuditorLayout';
import React from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ExternalAuditorLayout>{children}</ExternalAuditorLayout>;
}
