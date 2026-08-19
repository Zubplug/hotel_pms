'use client';

import DesktopAuthGuard from '@/components/desktop/DesktopAuthGuard';
import PosApp from '@/components/pos/PosApp';

export default function DesktopPosPage() {
  return (
    <DesktopAuthGuard>
      <PosApp />
    </DesktopAuthGuard>
  );
}
