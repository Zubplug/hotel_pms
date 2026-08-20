'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLodgeCoreProvider as useLodgeCore } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { OperatorSelectionScreen } from '@/components/pos/OperatorSelectionScreen';

export default function DesktopEntryPage() {
  const router = useRouter();
  const { provider } = useLodgeCore();
  const [terminalState, setTerminalState] = useState<any>(null);

  useEffect(() => {
    async function checkTerminal() {
      try {
        const res = await provider.system?.getTerminalStatus?.() || { registrationState: 'UNREGISTERED' };
        setTerminalState(res);
      } catch (e) {
        console.error('Failed to get terminal status', e);
        setTerminalState({ registrationState: 'UNKNOWN' });
      }
    }
    checkTerminal();
  }, [provider]);

  if (!terminalState) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (terminalState.registrationState === 'UNREGISTERED') {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 bg-slate-50">
        <h1 className="text-3xl font-bold mb-4">Unregistered Terminal</h1>
        <p className="text-slate-600 mb-8 max-w-md text-center">
          This terminal has not been registered with LodgeCore Cloud. An administrator must provision this device.
        </p>
        <Button onClick={() => router.push('/desktop/provision')} size="lg">
          Provision Terminal
        </Button>
      </div>
    );
  }

  // Active / Registered
  if (terminalState.desktopMode === 'UNKNOWN') {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 bg-slate-50">
        <h1 className="text-3xl font-bold mb-4 text-red-600">Configuration Error</h1>
        <p className="text-slate-600 mb-8 max-w-md text-center">
          This terminal has an invalid or unknown outlet configuration. Please contact support or re-provision the device.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <OperatorSelectionScreen 
        isOpen={true} 
        onAuthenticated={() => {
          if (terminalState.desktopMode === 'FRONT_DESK') {
            router.push('/desktop/frontdesk');
          } else if (terminalState.desktopMode === 'POS') {
            router.push('/desktop/pos');
          } else {
            router.push('/desktop');
          }
        }} 
        cancellable={false}
      />
    </div>
  );
}
