'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, LockKeyhole, PlayCircle, ShieldCheck } from 'lucide-react';

type FrontdeskSession = { id: string; shiftReference: string; status: string; openingFloat: number; systemExpectedCash: number; cashAccount?: { id: string; name: string } };
type CashAccount = { id: string; name: string; type: string; balance: number };

export default function FrontdeskCashierPage() {
  const { propertyId } = useProperty();
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [current, setCurrent] = useState<FrontdeskSession | null>(null);
  const [accountId, setAccountId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [declaredCash, setDeclaredCash] = useState('');
  const [decision, setDecision] = useState('APPROVED');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    const [accountData, sessionData] = isDesktopMode
      ? await Promise.all([provider.frontdesk.listCashAccounts(propertyId), provider.frontdesk.getSession(propertyId)])
      : await Promise.all([
          fetch(`/api/v1/frontdesk/cash-accounts?propertyId=${propertyId}`).then(response => response.json()),
          fetch(`/api/v1/frontdesk/sessions?propertyId=${propertyId}`).then(response => response.json()),
        ]);
    const nextAccounts = accountData.data || [];
    setAccounts(nextAccounts);
    setAccountId(value => value || nextAccounts[0]?.id || '');
    setCurrent(sessionData.data?.sessions?.[0] || sessionData.data?.session || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [propertyId, isDesktopMode, provider.frontdesk]);

  const run = async (operation: () => Promise<any>) => {
    setBusy(true); setMessage('');
    try {
      const result = await operation();
      if (result?.error) throw new Error(result.error?.message || result.error);
      setMessage('Operation completed successfully.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operation failed'); } finally { setBusy(false); }
  };

  const openSession = () => run(() => isDesktopMode
    ? provider.frontdesk.openSession({ propertyId, cashAccountId: accountId, openingFloat: Number(openingFloat) })
    : fetch('/api/v1/frontdesk/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, cashAccountId: accountId, openingFloat: Number(openingFloat) }) }).then(response => response.json()));

  const closeSession = () => run(() => isDesktopMode
    ? provider.frontdesk.closeSession(current!.id, Number(declaredCash))
    : fetch(`/api/v1/frontdesk/sessions/${current!.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ declaredCash: Number(declaredCash) }) }).then(response => response.json()));

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin" /></div>;

  return <div className="max-w-5xl mx-auto space-y-6">
    <div><h1 className="text-3xl font-bold">Front Desk Cashier</h1><p className="text-muted-foreground mt-1">Open, close, and reconcile the operational shift without changing the financial ledger.</p></div>
    {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    {current ? <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />Shift {current.shiftReference}</CardTitle><Badge>{current.status}</Badge></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Till</p><p className="font-semibold">{current.cashAccount?.name || 'Assigned till'}</p></div><div><p className="text-xs text-muted-foreground">Opening float</p><p className="font-semibold">₦{Number(current.openingFloat).toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Expected cash</p><p className="font-semibold">₦{Number(current.systemExpectedCash).toLocaleString()}</p></div></div><div className="flex flex-wrap items-end gap-3"><div><label className="text-sm font-medium">Declared cash</label><Input value={declaredCash} onChange={event => setDeclaredCash(event.target.value)} placeholder="0.00" type="number" /></div><Button disabled={busy || !declaredCash || current.status !== 'OPEN'} onClick={closeSession}><LockKeyhole className="mr-2 h-4 w-4" />Close Shift</Button></div></CardContent></Card> : <Card><CardHeader><CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-blue-600" />Open Front Desk Shift</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><label className="text-sm font-medium">Till</label><select value={accountId} onChange={event => setAccountId(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select a till</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></div><div><label className="text-sm font-medium">Opening float</label><Input value={openingFloat} onChange={event => setOpeningFloat(event.target.value)} type="number" /></div><div className="flex items-end"><Button disabled={busy || !accountId} onClick={openSession}><PlayCircle className="mr-2 h-4 w-4" />Open Shift</Button></div></CardContent></Card>}
    <Card><CardHeader><CardTitle>Manager Reconciliation</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Closed shifts require a managerial decision and retain every exception in the audit trail.</p>{current?.status === 'CLOSED' && <div className="mt-4 flex gap-3"><select value={decision} onChange={event => setDecision(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="APPROVED">Approve</option><option value="APPROVED_WITH_VARIANCE">Approve with variance</option><option value="REJECTED">Reject for review</option></select><Button disabled={busy} onClick={() => run(() => fetch(`/api/v1/frontdesk/sessions/${current.id}/reconcile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) }).then(response => response.json()))}>Submit Decision</Button></div>}</CardContent></Card>
  </div>;
}
