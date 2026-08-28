'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Banknote, CheckCircle2, FileText, Loader2, LockKeyhole, PlayCircle, Printer, ShieldCheck, WalletCards } from 'lucide-react';

type FrontdeskSession = { id: string; shiftReference: string; status: string; openingFloat: number; systemExpectedCash: number; cashAccount?: { id: string; name: string } };
type CashAccount = { id: string; name: string; type: string; balance: number };
type ShiftSummary = {
  session: { shiftReference: string; status: string; staffName: string; till: string; openingFloat: number; expectedCash: number; declaredCash?: number | null; variance?: number | null; openedAt: string; closedAt?: string | null };
  payments: { count: number; cash: number; card: number; bankTransfer: number; other: number; total: number };
  charges: { count: number; room: number; laundry: number; other: number; total: number };
  cash: { openingFloat: number; cashIn: number; cashDrops: number; paidOuts: number; transfersOut: number; refunds: number; expected: number; declared?: number | null; variance?: number | null };
  exceptions: { pendingSync: number; failedSync: number };
  rows: Array<{ date: string; kind: string; amount: number; method?: string; description?: string }>;
};

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

export default function FrontdeskCashierPage() {
  const { propertyId } = useProperty();
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [current, setCurrent] = useState<FrontdeskSession | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [accountId, setAccountId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [declaredCash, setDeclaredCash] = useState('');
  const [decision, setDecision] = useState('APPROVED');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
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
    const nextSession = sessionData.data?.sessions?.[0] || sessionData.data?.session || null;
    setAccounts(nextAccounts);
    setAccountId(value => value || nextAccounts[0]?.id || '');
    setCurrent(nextSession);
    if (nextSession && provider.frontdesk.getSessionSummary) {
      const summaryData = await provider.frontdesk.getSessionSummary(nextSession.id);
      setSummary(summaryData.data || null);
    } else {
      setSummary(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => { if (!cancelled) await load(); });
    return () => { cancelled = true; };
    // load intentionally captures the current provider/property context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, isDesktopMode, provider.frontdesk]);

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true); setMessage('');
    try {
      const result = await operation();
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const error = result.error;
        throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
      }
      setMessage('Operation completed successfully.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operation failed'); } finally { setBusy(false); }
  };

  const closeSession = () => run(() => isDesktopMode
    ? provider.frontdesk.closeSession(current!.id, Number(declaredCash))
    : fetch(`/api/v1/frontdesk/sessions/${current!.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ declaredCash: Number(declaredCash) }) }).then(response => response.json()));

  const openSession = () => run(() => isDesktopMode
    ? provider.frontdesk.openSession({ propertyId, cashAccountId: accountId, openingFloat: Number(openingFloat) })
    : fetch('/api/v1/frontdesk/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, cashAccountId: accountId, openingFloat: Number(openingFloat) }) }).then(response => response.json()));

  const reconcileSession = () => run(() => provider.frontdesk.reconcileSession
    ? provider.frontdesk.reconcileSession(current!.id, decision, reconciliationNotes)
    : Promise.reject(new Error('Reconciliation is unavailable on this terminal.')));

  const printReport = () => {
    if (!summary || !provider.hardware.printShiftReport) return;
    return run(() => provider.hardware.printShiftReport!({
      staffName: summary.session.staffName,
      ordersCount: 0,
      grossSales: summary.charges.total,
      netSales: summary.charges.total,
      cashSales: summary.payments.cash,
      cardSales: summary.payments.card,
      roomCharges: summary.charges.room,
      totalDiscounts: 0,
      currency: 'NGN',
      printedAt: new Date().toISOString(),
      shiftReference: summary.session.shiftReference,
      till: summary.session.till,
      expectedCash: summary.cash.expected,
      declaredCash: summary.cash.declared,
      variance: summary.cash.variance,
      bankTransferSales: summary.payments.bankTransfer,
      otherPayments: summary.payments.other,
      laundryCharges: summary.charges.laundry,
      otherCharges: summary.charges.other,
      cashIn: summary.cash.cashIn,
      cashDrops: summary.cash.cashDrops,
      paidOuts: summary.cash.paidOuts,
      transfersOut: summary.cash.transfersOut,
      cashRefunds: summary.cash.refunds,
      paymentsCount: summary.payments.count,
      chargesCount: summary.charges.count,
      pendingSync: summary.exceptions.pendingSync,
      failedSync: summary.exceptions.failedSync,
    }));
  };

  const varianceTone = useMemo(() => {
    const variance = Number(summary?.cash.variance ?? 0);
    return variance === 0 ? 'text-emerald-700' : variance > 0 ? 'text-blue-700' : 'text-red-700';
  }, [summary]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin" /></div>;

  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><h1 className="text-3xl font-bold tracking-tight">Front Desk Cashier</h1><p className="mt-1 text-muted-foreground">Review every transaction, reconcile the till, and close the shift with a signed audit trail.</p></div>
      {summary && <Button variant="outline" onClick={printReport} disabled={!isDesktopMode || busy}><Printer className="mr-2 h-4 w-4" />Print End-of-Shift Report</Button>}
    </div>
    {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

    {!current ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-blue-600" />Open Front Desk Shift</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><label className="text-sm font-medium">Till</label><select value={accountId} onChange={event => setAccountId(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select a till</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></div><div><label className="text-sm font-medium">Opening float</label><Input value={openingFloat} onChange={event => setOpeningFloat(event.target.value)} type="number" /></div><div className="flex items-end"><Button disabled={busy || !accountId} onClick={openSession}><PlayCircle className="mr-2 h-4 w-4" />Open Shift</Button></div></CardContent></Card> : <>
      <Card className="border-slate-200 bg-slate-950 text-white"><CardContent className="flex flex-col justify-between gap-5 p-6 md:flex-row md:items-center"><div><div className="mb-2 flex items-center gap-2 text-emerald-300"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-widest">Shift report status</span><Badge className="bg-emerald-500/20 text-emerald-200">{current.status.replaceAll('_', ' ')}</Badge></div><h2 className="text-2xl font-bold">{summary?.session.shiftReference || current.shiftReference}</h2><p className="mt-1 text-sm text-slate-300">{summary?.session.staffName || 'Assigned receptionist'} · {summary?.session.till || current.cashAccount?.name || 'Assigned till'}</p></div><div className="text-left md:text-right"><p className="text-xs uppercase tracking-wider text-slate-400">Opened</p><p className="font-medium">{dateTime(summary?.session.openedAt)}</p></div></CardContent></Card>

      {summary && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Total payments" value={money(summary.payments.total)} detail={`${summary.payments.count} transactions`} icon={<WalletCards className="h-4 w-4" />} />
          <Metric title="Total charges" value={money(summary.charges.total)} detail={`${summary.charges.count} charges`} icon={<FileText className="h-4 w-4" />} />
          <Metric title="Expected cash" value={money(summary.cash.expected)} detail={`Opening float ${money(summary.cash.openingFloat)}`} icon={<Banknote className="h-4 w-4" />} />
          <Metric title="Variance" value={summary.cash.variance == null ? 'Not declared' : money(summary.cash.variance)} detail={summary.cash.variance == null ? 'Enter physical cash below' : summary.cash.variance === 0 ? 'Till balances exactly' : summary.cash.variance > 0 ? 'Overage' : 'Shortage'} icon={summary.cash.variance === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} valueClass={varianceTone} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Payment breakdown</CardTitle></CardHeader><CardContent className="space-y-3">{[['Cash', summary.payments.cash], ['Card / POS', summary.payments.card], ['Bank transfer', summary.payments.bankTransfer], ['Other', summary.payments.other]].map(([label, value]) => <SummaryRow key={String(label)} label={String(label)} value={money(value)} />)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Charge breakdown</CardTitle></CardHeader><CardContent className="space-y-3">{[['Room charges', summary.charges.room], ['Laundry', summary.charges.laundry], ['Other Front Desk', summary.charges.other]].map(([label, value]) => <SummaryRow key={String(label)} label={String(label)} value={money(value)} />)}<div className="border-t pt-3"><SummaryRow label="Total charges" value={money(summary.charges.total)} strong /></div></CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle>Cash reconciliation</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryRow label="Opening float" value={money(summary.cash.openingFloat)} /><SummaryRow label="Cash received" value={money(summary.payments.cash)} /><SummaryRow label="Cash in" value={money(summary.cash.cashIn)} /><SummaryRow label="Refunds / drops / paid out" value={money(summary.cash.refunds + summary.cash.cashDrops + summary.cash.paidOuts + summary.cash.transfersOut)} /><SummaryRow label="Expected cash" value={money(summary.cash.expected)} strong /><SummaryRow label="Declared cash" value={summary.cash.declared == null ? 'Not declared' : money(summary.cash.declared)} /><SummaryRow label="Variance" value={summary.cash.variance == null ? '—' : money(summary.cash.variance)} strong valueClass={varianceTone} /></CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Close and submit shift</CardTitle><Badge variant={summary.exceptions.failedSync ? 'destructive' : 'secondary'}>{summary.exceptions.failedSync ? `${summary.exceptions.failedSync} failed sync` : 'No sync failures'}</Badge></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Count the physical till, enter the exact amount, then close the session. The system will lock Front Desk transactions and send the report for reconciliation.</p><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div><label className="text-sm font-medium">Physical cash counted</label><Input value={declaredCash} onChange={event => setDeclaredCash(event.target.value)} placeholder="0.00" type="number" /></div><Button disabled={busy || !declaredCash || current.status !== 'OPEN'} onClick={closeSession}><LockKeyhole className="mr-2 h-4 w-4" />Close and submit shift</Button></div></CardContent></Card>

        <Card><CardHeader><CardTitle>Recent session activity</CardTitle></CardHeader><CardContent><div className="divide-y rounded-md border">{summary.rows.slice(0, 8).map((row, index) => <div key={`${row.date}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div><p className="font-medium">{row.description || row.kind}</p><p className="text-xs text-muted-foreground">{dateTime(row.date)} · {row.method || '—'}</p></div><span className="font-semibold">{money(row.amount)}</span></div>)}{summary.rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No session activity recorded yet.</p>}</div></CardContent></Card>
      </>}
    </>}

    {(current?.status === 'CLOSED' || current?.status === 'UNDER_REVIEW') && <Card><CardHeader><CardTitle>Manager reconciliation</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Record the managerial decision. Approval with variance is required when the declared cash differs from expected cash.</p><div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr_auto]"><select value={decision} onChange={event => setDecision(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="APPROVED">Approve</option><option value="APPROVED_WITH_VARIANCE">Approve with variance</option><option value="REJECTED">Reject for review</option></select><Input value={reconciliationNotes} onChange={event => setReconciliationNotes(event.target.value)} placeholder="Decision notes (optional)" /><Button disabled={busy || !provider.frontdesk.reconcileSession} onClick={reconcileSession}><ShieldCheck className="mr-2 h-4 w-4" />Submit decision</Button></div></CardContent></Card>}
  </div>;
}

function Metric({ title, value, detail, icon, valueClass = '' }: { title: string; value: string; detail: string; icon: ReactNode; valueClass?: string }) {
  return <Card><CardContent className="p-5"><div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-semibold uppercase tracking-wider">{title}</span>{icon}</div><p className={`mt-3 text-2xl font-bold ${valueClass}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function SummaryRow({ label, value, strong = false, valueClass = '' }: { label: string; value: string; strong?: boolean; valueClass?: string }) {
  return <div className="flex items-center justify-between gap-3"><span className={strong ? 'font-semibold' : 'text-sm text-muted-foreground'}>{label}</span><span className={`${strong ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span></div>;
}
