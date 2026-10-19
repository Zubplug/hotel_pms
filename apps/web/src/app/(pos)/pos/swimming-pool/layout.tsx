import { ReactNode } from 'react';
import { PoolTerminalShell } from './_components/PoolTerminalShell';

export const metadata = {
  title: 'Swimming Pool Terminal — LodgeCore PMS',
  description: 'Pool operations, admissions, safety checks, resources, and reporting.',
};

export default function SwimmingPoolLayout({ children }: { children: ReactNode }) {
  return <PoolTerminalShell>{children}</PoolTerminalShell>;
}
