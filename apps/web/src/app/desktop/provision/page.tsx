'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLodgeCoreProvider as useLodgeCore } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProvisionTerminalPage() {
  const router = useRouter();
  const { provider } = useLodgeCore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [terminalName, setTerminalName] = useState('MAIN-POS-01');
  const [isProvisioning, setIsProvisioning] = useState(false);

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    setIsProvisioning(true);
    try {
      // Send IPC command to C# to handle provisioning
      const res = await provider.system?.provisionTerminal?.({
        email, password, propertyId, outletId, terminalName
      });
      
      if (res && res.success === false) {
        throw new Error(res.error || 'Provisioning failed');
      }

      // Redirect back to root desktop which will now see REGISTERED and show Operator selection
      router.push('/desktop');
    } catch (err: any) {
      console.error('Provisioning failed:', err);
      alert(`Provisioning failed: ${err.message || 'Check logs'}`);
    } finally {
      setIsProvisioning(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Provision Terminal</h1>
        <form onSubmit={handleProvision} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Admin Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Admin Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="h-px bg-slate-200 my-2"></div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Property ID</label>
            <Input value={propertyId} onChange={e => setPropertyId(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Outlet ID</label>
            <Input value={outletId} onChange={e => setOutletId(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Terminal Name</label>
            <Input value={terminalName} onChange={e => setTerminalName(e.target.value)} required />
          </div>
          <Button type="submit" disabled={isProvisioning} className="mt-4">
            {isProvisioning ? 'Provisioning...' : 'Provision Now'}
          </Button>
        </form>
      </div>
    </div>
  );
}
