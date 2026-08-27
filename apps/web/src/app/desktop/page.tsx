'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLodgeCoreProvider as useLodgeCore } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { TerminalAuthScreen } from '@/components/pos/TerminalAuthScreen';
import { AlertTriangle, ServerOff, ShieldAlert, Loader2 } from 'lucide-react';

type TerminalState = {
  registrationState: 'UNREGISTERED' | 'ACTIVE' | 'CORRUPTED' | 'UNKNOWN';
  desktopMode?: 'FRONT_DESK' | 'POS' | 'UNKNOWN';
  error?: string;
  terminalId?: string;
  name?: string;
};

export default function DesktopEntryPage() {
  const router = useRouter();
  const { provider } = useLodgeCore();
  const [terminalState, setTerminalState] = useState<TerminalState | null>(null);

  useEffect(() => {
    async function checkTerminal() {
      try {
        const res = await provider.system?.getTerminalStatus?.();
        if (!res) {
          setTerminalState({ registrationState: 'UNREGISTERED' });
          return;
        }
        setTerminalState(res as TerminalState);
      } catch (e: any) {
        console.error('[Desktop] Failed to get terminal status:', e);
        setTerminalState({ registrationState: 'UNREGISTERED', error: e?.message });
      }
    }
    checkTerminal();
  }, [provider]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!terminalState) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 text-sm font-medium">Starting LodgeCore…</p>
      </div>
    );
  }

  // ── Not yet provisioned ──────────────────────────────────────────────────
  if (
    terminalState.registrationState === 'UNREGISTERED' ||
    terminalState.registrationState === 'UNKNOWN'
  ) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 p-8 bg-slate-50">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <ServerOff className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Terminal Not Set Up</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            This device has not been registered with LodgeCore Cloud yet.
            An administrator needs to provision it before use.
          </p>
          {terminalState.error && (
            <p className="text-xs text-slate-400 font-mono bg-slate-100 rounded px-3 py-1">
              {terminalState.error}
            </p>
          )}
        </div>
        <Button onClick={() => router.push('/desktop/provision')} size="lg" className="min-w-[200px]">
          Set Up This Terminal
        </Button>
      </div>
    );
  }

  // ── Corrupted credentials ────────────────────────────────────────────────
  if (terminalState.registrationState === 'CORRUPTED') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 p-8 bg-slate-50">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Terminal Credential Lost</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            This terminal was previously registered but its security credential is missing —
            likely due to a reinstall or system reset. Re-provision the device to restore access.
          </p>
        </div>
        <div className="flex flex-col gap-3 min-w-[200px]">
          <Button onClick={() => router.push('/desktop/provision')} size="lg">
            Re-Provision Terminal
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTerminalState(null)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Outlet not configured ────────────────────────────────────────────────
  if (terminalState.desktopMode === 'UNKNOWN') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 p-8 bg-slate-50">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Outlet Not Configured</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            This terminal is registered but its outlet type is not recognised.
            Contact your LodgeCore administrator to assign the correct outlet.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/desktop/provision')} size="lg">
          Re-Provision
        </Button>
      </div>
    );
  }

  // ── Active & configured → unified GLOBAL auth screen ────────────────────
  return (
    <div className="flex h-screen bg-slate-900">
      <TerminalAuthScreen
        authMode="GLOBAL"
        isOpen={true}
        cancellable={false}
        allowedRoles={terminalState.desktopMode === 'FRONT_DESK' ? ['RECEPTIONIST', 'FRONT_DESK'] : ['WAITER', 'WAITRESS', 'CASHIER']}
        onAuthenticated={(desktopMode) => {
          if (desktopMode === 'FRONT_DESK') {
            router.push('/frontdesk');
          } else if (desktopMode === 'POS') {
            router.push('/pos');
          } else {
            // Fallback: use the terminalState config we already have
            if (terminalState.desktopMode === 'FRONT_DESK') {
              router.push('/frontdesk');
            } else {
              router.push('/pos');
            }
          }
        }}
      />
    </div>
  );
}
