'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/ui/amount-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, ArrowRightLeft, Banknote, Check, CheckCircle2, ChevronDown, FileText, Loader2, LockKeyhole, PlayCircle, Printer, ShieldCheck, WalletCards } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { toast } from 'sonner';

type FrontdeskSession = { id: string; shiftReference: string; status: string; controlStatus?: string; openingFloat: number; systemExpectedCash: number; cashAccount?: { id: string; name: string } };
type CashAccount = { id: string; name: string; type: string; balance: number };
type ShiftSummary = {
  property?: { name?: string; address?: string; city?: string; state?: string; phone?: string; email?: string; baseCurrency?: string } | null;
  session: { shiftReference: string; status: string; staffName: string; till: string; businessDate?: string; openingFloat: number; expectedCash: number; declaredCash?: number | null; variance?: number | null; openedAt: string; closedAt?: string | null };
  payments: { count: number; cash: number; card: number; bankTransfer: number; other: number; total: number };
  charges: { count: number; room: number; laundry: number; other: number; total: number };
  cash: { openingFloat: number; cashIn: number; cashDrops: number; paidOuts: number; transfersOut: number; refunds: number; expected: number; declared?: number | null; variance?: number | null };
  exceptions: { pendingSync: number; failedSync: number };
  rows: Array<{ date: string; kind: string; amount: number; method?: string; description?: string; reference?: string; guest?: string; room?: string; rooms?: string[]; confirmationNumber?: string; type?: string; source?: string }>;
};

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

export default function FrontdeskCashierPage() {
  const { propertyId } = useProperty();
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const logout = useLogout();
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [current, setCurrent] = useState<FrontdeskSession | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [accountId, setAccountId] = useState('');
  const [declaredCash, setDeclaredCash] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showOpenSuccess, setShowOpenSuccess] = useState(false);
  const [showCloseSuccess, setShowCloseSuccess] = useState(false);
  const [showHandoverSuccess, setShowHandoverSuccess] = useState(false);
  const [dailyReport, setDailyReport] = useState<any | null>(null);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [showShiftReport, setShowShiftReport] = useState(false);
  const [printTarget, setPrintTarget] = useState<'daily' | 'shift' | null>(null);
  const effectiveControlStatus = current?.controlStatus || (current?.status === 'CLOSED' ? 'SUBMITTED' : current?.status || '');
  const canSubmitShift = effectiveControlStatus === 'OPEN' || effectiveControlStatus === 'RETURNED';

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
    const rawNextSession = sessionData.data?.sessions?.[0] || sessionData.data?.session || null;
    
    // Treat shifts that are fully reconciled, handed over, or deposited as concluded.
    // Also treat HANDOVER_PENDING as concluded for the cashier, so they can open a new shift.
    const isConcluded = rawNextSession && (
      rawNextSession.status === 'RECONCILED' || 
      ['HANDED_OVER', 'HANDOVER_PENDING', 'DEPOSIT_PENDING', 'DEPOSITED', 'RECONCILED'].includes(rawNextSession.controlStatus || '')
    );
    const nextSession = isConcluded ? null : rawNextSession;

    setAccounts(nextAccounts);
    setAccountId(value => value || nextAccounts[0]?.id || '');
    setCurrent(nextSession);
    if (nextSession && provider.frontdesk.getSessionSummary) {
      const summaryData = await provider.frontdesk.getSessionSummary(nextSession.id);
      const fetchedSummary = summaryData.data || null;
      setSummary(fetchedSummary);
      if (fetchedSummary && fetchedSummary.cash.expected === 0) {
        setDeclaredCash('0');
      }
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

  const closeSession = () => run(async () => {
      const result = await (isDesktopMode
      ? provider.frontdesk.closeSession(current!.id, Number(declaredCash))
      : fetch(`/api/v1/frontdesk/sessions/${current!.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ declaredCash: Number(declaredCash) }) }).then(response => response.json()));
    if (result && typeof result === 'object' && 'error' in result && result.error) throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
    setShowCloseConfirm(false);
    setShowCloseSuccess(true);
    return result;
  });

  const openSession = () => run(async () => {
    const result = await (isDesktopMode
      ? provider.frontdesk.openSession({ propertyId, cashAccountId: accountId, openingFloat: 0 })
      : fetch('/api/v1/frontdesk/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, cashAccountId: accountId, openingFloat: 0 }) }).then(response => response.json()));
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
    }
    setShowOpenSuccess(true);
    return result;
  });

  const initiateHandover = () => run(async () => {
    if (!propertyId || !current?.id) return;
    const res = await fetch('/api/v1/financial-control/handovers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `frontdesk-handover:${current.id}` },
      body: JSON.stringify({ propertyId, frontdeskSessionIds: [current.id] })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to initiate handover');
    }
    setMessage('Handover initiated successfully. Please deliver your cash to the General Cashier.');
    setShowHandoverSuccess(true);
    return true;
  });

  const printA4Report = (target: 'daily' | 'shift') => {
    if ((target === 'daily' && !dailyReport) || (target === 'shift' && !summary)) return;
    setPrintTarget(target);
    setShowDailyReport(false);
    setShowShiftReport(false);
    setTimeout(() => window.print(), 120);
  };

  const printTerminalReport = async () => {
    if (!HardwareBridge.isAvailable()) {
      toast.error('Terminal printer is not available');
      return;
    }
    if (!summary) return;
    
    try {
      const res = await HardwareBridge.printShiftReport({
        staffName: summary.session.staffName,
        ordersCount: summary.payments.count,
        grossSales: summary.payments.total,
        netSales: summary.payments.total,
        cashSales: summary.payments.cash,
        cardSales: summary.payments.card,
        roomCharges: summary.charges.room,
        totalDiscounts: 0,
        currency: summary.property?.baseCurrency || 'NGN',
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
        reportTitle: 'FRONT DESK END-OF-DAY REPORT',
        folioPayments: summary.rows
          .filter((r: any) => r.kind === 'PAYMENT' || (r.amount > 0 && r.method))
          .map((r: any) => ({
            roomNumber: String(r.room || r.rooms?.join(', ') || '-'),
            guestName: String(r.guest || '-'),
            receiptNumber: String(r.reference || '-'),
            amount: Number(r.amount || 0),
            method: String(r.method || 'Payment'),
            currency: summary.property?.baseCurrency || 'NGN'
          })),
        paymentSummary: dailyReport?.paymentSummary?.map((i: any) => ({
          method: i.method,
          amount: Number(i.amount || 0),
          count: Number(i.count || 0)
        })) || []
      });
      if (!res.success) {
        toast.error(`Printer Error: ${res.error || 'Unknown error'}`);
      } else {
        toast.success('Control sheet sent to terminal printer');
      }
    } catch (e: any) {
      toast.error(`Printer Error: ${e.message || String(e)}`);
    }
  };

  const varianceTone = useMemo(() => {
    const variance = Number(summary?.cash.variance ?? 0);
    return variance === 0 ? 'text-emerald-700' : variance > 0 ? 'text-blue-700' : 'text-red-700';
  }, [summary]);

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#f5f8fc]"><div className="flex flex-col items-center gap-3 text-slate-500"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600"><Loader2 className="h-6 w-6 animate-spin" /></span><span className="text-sm font-medium">Preparing your cashier workspace…</span></div></div>;

  return <div className="frontdesk-cashier-shell min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.10),_transparent_28%),linear-gradient(180deg,#f6f9fd_0%,#eef3f9_100%)] px-4 py-5 text-slate-900 sm:px-6 lg:px-8 lg:py-8">
    <div className="mx-auto max-w-[1440px] space-y-6 pb-12">
    {dailyReport && <div id="frontdesk-a4-report" className="hidden bg-white text-slate-900 print:block">
      <div className="border-b-2 border-slate-900 pb-5"><p className="text-xs font-bold uppercase tracking-[.22em] text-indigo-700">{dailyReport.property?.name || 'LodgeCore Front Desk'}</p><p className="mt-1 text-xs text-slate-500">{dailyReport.property?.address || ''}{dailyReport.property?.city ? ` · ${dailyReport.property.city}` : ''}{dailyReport.property?.phone ? ` · ${dailyReport.property.phone}` : ''}</p><h1 className="mt-3 text-3xl font-bold">Front Desk Daily Control Sheet</h1><p className="mt-2 text-sm text-slate-500">Business date: {dailyReport.startDate || summary?.session?.businessDate || new Date().toISOString().slice(0, 10)} · Prepared by Front Desk</p></div>
      <div className="mt-6 grid grid-cols-3 gap-3"><div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Check-ins</p><p className="mt-2 text-xl font-bold">{dailyReport.checkIns?.length || 0}</p></div><div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Gross room charges</p><p className="mt-2 text-xl font-bold">{money((dailyReport.checkIns || []).reduce((sum: number, item: any) => sum + Number(item.grossAmount || 0), 0))}</p></div><div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Discounts</p><p className="mt-2 text-xl font-bold">-{money((dailyReport.checkIns || []).reduce((sum: number, item: any) => sum + Number(item.discountAmount || 0), 0))}</p></div></div>
      <h2 className="mt-8 border-b pb-2 text-lg font-bold">Today&apos;s Check-ins and Room Charges</h2><table className="mt-3 w-full border-collapse text-sm"><thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-2">Room</th><th className="py-2">Guest</th><th className="py-2">Confirmation</th><th className="py-2 text-right">Gross</th><th className="py-2 text-right">Discount</th><th className="py-2 text-right">Net</th></tr></thead><tbody>{(dailyReport.checkIns || []).map((item: any) => <tr key={`print-${item.confirmationNumber}-${item.roomNumber}`} className="border-b"><td className="py-2">{item.roomNumber}</td><td className="py-2">{item.guestName}</td><td className="py-2">{item.confirmationNumber || '—'}</td><td className="py-2 text-right">{money(item.grossAmount)}</td><td className="py-2 text-right">{item.discountAmount ? `-${money(item.discountAmount)}` : '—'}</td><td className="py-2 text-right font-semibold">{money(item.netAmount)}</td></tr>)}</tbody></table>
      <div className="mt-8 grid grid-cols-2 gap-8"><div><h2 className="border-b pb-2 text-lg font-bold">Payment Type Summary</h2><div className="mt-3 space-y-2">{(dailyReport.paymentSummary || []).map((item: any) => <SummaryRow key={`print-payment-${item.method}`} label={`${item.method} (${item.count})`} value={money(item.amount)} />)}</div></div><div><h2 className="border-b pb-2 text-lg font-bold">Report Control</h2><div className="mt-3 space-y-2"><SummaryRow label="Sessions" value={String(dailyReport.totals?.sessions || 0)} /><SummaryRow label="Report rows" value={String(dailyReport.rows?.length || 0)} /><SummaryRow label="Net movement" value={money(dailyReport.totals?.net || 0)} strong /></div></div></div>
      <div className="mt-14 grid grid-cols-3 gap-8 text-xs text-slate-500"><div className="border-t pt-2">Front Desk signature</div><div className="border-t pt-2">Auditor signature</div><div className="border-t pt-2">General Cashier signature</div></div><p className="mt-10 text-center text-[10px] text-slate-400">Generated from the terminal&apos;s offline transaction ledger · {new Date().toLocaleString()}</p>
    </div>}
    <style jsx global>{`@media print { @page { size: A4; margin: 12mm; } body * { visibility: hidden !important; } #frontdesk-${printTarget || 'shift'}-a4-report, #frontdesk-${printTarget || 'shift'}-a4-report * { visibility: visible !important; } #frontdesk-${printTarget || 'shift'}-a4-report { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; min-height: 270mm; padding: 0 !important; background: #fff !important; box-shadow: none !important; } }`}</style>
    <Dialog open={showShiftReport} onOpenChange={setShowShiftReport}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-0 bg-slate-100 p-0 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div><DialogTitle className="text-lg text-slate-900">Print Preview</DialogTitle><DialogDescription className="text-xs">Front Office Deposit Control Sheet (A4)</DialogDescription></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => setShowShiftReport(false)}>Cancel</Button><Button onClick={() => printA4Report('shift')} disabled={!summary} className="bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"><Printer className="mr-2 h-4 w-4" />Print A4</Button></div>
        </div>
        <div className="p-4 sm:p-8">
          {summary && <div id="frontdesk-shift-a4-report" className="mx-auto w-full max-w-[210mm] bg-white p-[12mm] text-slate-900 shadow-xl print:p-0 print:shadow-none">
            <div className="border-b-2 border-slate-900 pb-5"><p className="text-xs font-bold uppercase tracking-[.22em] text-indigo-700">{summary.property?.name || 'LodgeCore Front Desk'}</p><p className="mt-1 text-xs text-slate-500">{summary.property?.address || ''}{summary.property?.city ? ` · ${summary.property.city}` : ''}{summary.property?.phone ? ` · ${summary.property.phone}` : ''}</p><h1 className="mt-3 text-3xl font-bold">Front Office Deposit Control Sheet</h1><p className="mt-2 text-sm text-slate-500">{summary.session.shiftReference} · Business date: {summary.session.businessDate || 'Current business date'}</p></div><div className="mt-6 grid grid-cols-4 gap-3"><div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-500">Cashier</p><p className="mt-1 font-bold">{summary.session.staffName}</p></div><div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-500">Till</p><p className="mt-1 font-bold">{summary.session.till}</p></div><div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-500">Status</p><p className="mt-1 font-bold">{effectiveControlStatus.replaceAll('_', ' ')}</p></div><div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-slate-500">Transactions</p><p className="mt-1 font-bold">{summary.payments.count}</p></div></div><div className="mt-7 grid grid-cols-2 gap-8"><div><h2 className="border-b pb-2 text-lg font-bold">Payment capture</h2><div className="mt-3 space-y-2"><SummaryRow label="Cash" value={money(summary.payments.cash)} /><SummaryRow label="Card / POS" value={money(summary.payments.card)} /><SummaryRow label="Bank transfer" value={money(summary.payments.bankTransfer)} /><SummaryRow label="Other" value={money(summary.payments.other)} /><SummaryRow label="Total payments" value={money(summary.payments.total)} strong /></div></div><div><h2 className="border-b pb-2 text-lg font-bold">Shift analysis</h2><div className="mt-3 space-y-2"><SummaryRow label="Room charges" value={money(summary.charges.room)} /><SummaryRow label="Other charges" value={money(summary.charges.laundry + summary.charges.other)} /><SummaryRow label="Total charges" value={money(summary.charges.total)} strong /><SummaryRow label="Net movement" value={money(summary.payments.total - summary.charges.total)} strong /></div></div></div><h2 className="mt-7 border-b pb-2 text-lg font-bold">Cash reconciliation</h2><div className="mt-3 grid grid-cols-2 gap-x-12 gap-y-2"><SummaryRow label="Opening float" value={money(summary.cash.openingFloat)} /><SummaryRow label="Cash received" value={money(summary.payments.cash)} /><SummaryRow label="Cash in" value={money(summary.cash.cashIn)} /><SummaryRow label="Drops / paid out / refunds" value={money(summary.cash.refunds + summary.cash.cashDrops + summary.cash.paidOuts + summary.cash.transfersOut)} /><SummaryRow label="Expected cash" value={money(summary.cash.expected)} strong /><SummaryRow label="Declared cash" value={summary.cash.declared == null ? 'Not declared' : money(summary.cash.declared)} /><SummaryRow label="Variance" value={summary.cash.variance == null ? 'Not declared' : money(summary.cash.variance)} strong /></div><h2 className="mt-7 border-b pb-2 text-lg font-bold">Folio Payments</h2><table className="mt-3 w-full border-collapse text-[10px]"><thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-2">Room</th><th className="py-2">Guest / confirmation</th><th className="py-2">Receipt Ref</th><th className="py-2">Method</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{summary.rows.filter((r: any) => r.kind === 'PAYMENT' || (r.amount > 0 && r.method)).map((row, index) => <tr key={`shift-print-${row.date}-${index}`} className="border-b border-slate-200"><td className="py-2 font-medium">{row.room || row.rooms?.join(', ') || '—'}</td><td className="py-2">{row.guest || '—'}</td><td className="py-2">{row.reference || '—'}</td><td className="py-2">{row.method || 'Payment'}</td><td className="py-2 text-right font-semibold">{money(row.amount)}</td></tr>)}<tr className="bg-slate-50"><td colSpan={4} className="py-3 px-2 font-bold text-right text-xs">Total Payments Collected:</td><td className="py-3 px-2 text-right font-bold text-xs">{money(summary.rows.filter((r: any) => r.kind === 'PAYMENT' || (r.amount > 0 && r.method)).reduce((acc, curr) => acc + Number(curr.amount || 0), 0))}</td></tr></tbody></table><div className="mt-12 grid grid-cols-3 gap-8 text-xs text-slate-500"><div className="border-t border-slate-800 pt-2 font-bold text-slate-900">Cashier signature</div><div className="border-t border-slate-800 pt-2 font-bold text-slate-900">Night Auditor signature</div><div className="border-t border-slate-800 pt-2 font-bold text-slate-900">General Cashier signature</div></div><p className="mt-8 text-center text-[10px] text-slate-400">Generated from the cashier shift ledger · {new Date().toLocaleString()}</p>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={showDailyReport} onOpenChange={setShowDailyReport}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-0 bg-slate-50 p-0 shadow-2xl">
        <div className="border-b border-slate-200 bg-white px-6 py-5 sm:px-8"><DialogHeader><div className="flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-indigo-600">Front Office Finance Control</p><DialogTitle className="text-2xl tracking-tight text-slate-900">End-of-Day Control Sheet</DialogTitle><DialogDescription className="mt-1 max-w-2xl text-slate-500">Review today&apos;s room activity, payment capture, and cashier controls before handing the report to the auditor.</DialogDescription></div><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">A4 ready</span></div></DialogHeader></div>
        {dailyReport && <div className="space-y-5 text-sm">
          <div className="space-y-5 px-6 py-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Check-ins</p><p className="mt-2 text-2xl font-bold text-slate-900">{dailyReport.checkIns?.length || 0}</p><p className="mt-1 text-xs text-slate-500">Today&apos;s arrivals</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross room charges</p><p className="mt-2 text-2xl font-bold text-slate-900">{money((dailyReport.checkIns || []).reduce((sum: number, item: any) => sum + Number(item.grossAmount || 0), 0))}</p><p className="mt-1 text-xs text-slate-500">Before discounts</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Discounts</p><p className="mt-2 text-2xl font-bold text-amber-800">-{money((dailyReport.checkIns || []).reduce((sum: number, item: any) => sum + Number(item.discountAmount || 0), 0))}</p><p className="mt-1 text-xs text-amber-700">Approved deductions</p></div></div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-slate-900">Today&apos;s room activity</h3><p className="mt-1 text-xs text-slate-500">Check-ins and accommodation values posted for the business date.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{dailyReport.checkIns?.length || 0} records</span></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Room</th><th className="px-5 py-3">Guest</th><th className="hidden px-5 py-3 md:table-cell">Confirmation</th><th className="px-5 py-3 text-right">Gross</th><th className="hidden px-5 py-3 text-right sm:table-cell">Discount</th><th className="px-5 py-3 text-right">Net</th></tr></thead><tbody className="divide-y divide-slate-100">{(dailyReport.checkIns || []).map((item: any) => <tr key={`${item.confirmationNumber}-${item.roomNumber}`} className="text-slate-700"><td className="px-5 py-3 font-semibold text-slate-900">{item.roomNumber}</td><td className="px-5 py-3"><span className="block max-w-[180px] truncate">{item.guestName}</span><span className="text-xs text-slate-400 md:hidden">{item.confirmationNumber || 'No confirmation'}</span></td><td className="hidden px-5 py-3 text-slate-500 md:table-cell">{item.confirmationNumber || '—'}</td><td className="px-5 py-3 text-right">{money(item.grossAmount)}</td><td className="hidden px-5 py-3 text-right text-amber-700 sm:table-cell">{item.discountAmount ? `-${money(item.discountAmount)}` : '—'}</td><td className="px-5 py-3 text-right font-semibold text-slate-900">{money(item.netAmount)}</td></tr>)}</tbody></table>{!dailyReport.checkIns?.length && <p className="p-10 text-center text-slate-500">No check-ins were recorded for today.</p>}</div></div>
            <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-slate-900">Payment capture</h3><p className="mt-1 text-xs text-slate-500">Collections recorded by payment method.</p><div className="mt-4 space-y-3">{(dailyReport.paymentSummary || []).map((item: any) => <SummaryRow key={item.method} label={`${item.method} (${item.count})`} value={money(item.amount)} />)}{!dailyReport.paymentSummary?.length && <p className="text-slate-500">No payments recorded.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-slate-900">Report totals</h3><p className="mt-1 text-xs text-slate-500">Control totals for this business date.</p><div className="mt-4 space-y-3"><SummaryRow label="Total rows" value={String(dailyReport.rows?.length || 0)} /><SummaryRow label="Sessions" value={String(dailyReport.totals?.sessions || 0)} /><SummaryRow label="Net movement" value={money(dailyReport.totals?.net || 0)} strong /></div></div></div>
            {summary && <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Cashier control</h3><p className="mt-1 text-xs text-slate-600">Current shift reconciliation included in the A4 control sheet.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">{summary.session.shiftReference}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><SummaryRow label="Expected cash" value={money(summary.cash.expected)} strong /><SummaryRow label="Declared cash" value={summary.cash.declared == null ? 'Not declared' : money(summary.cash.declared)} /><SummaryRow label="Variance" value={summary.cash.variance == null ? 'Not declared' : money(summary.cash.variance)} strong valueClass={varianceTone} /></div></div>}
          </div>
        </div>}
        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:px-8"><Button variant="outline" onClick={() => setShowDailyReport(false)}>Close</Button><Button onClick={() => printA4Report('shift')} disabled={!summary} className="bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"><Printer className="mr-2 h-4 w-4" />Print A4 Control Sheet</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirm shift submission</DialogTitle><DialogDescription>Are you sure you want to close and submit this Front Desk shift? The till will be locked and the report will be sent for cashier or manager review.</DialogDescription></DialogHeader>
        <div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Expected cash</span><span className="font-semibold">{money(summary?.cash.expected || 0)}</span></div><div className="mt-1 flex justify-between"><span className="text-slate-500">Counted cash</span><span className="font-semibold">{money(Number(declaredCash) || 0)}</span></div><div className="mt-1 flex justify-between"><span className="text-slate-500">Variance</span><span className={`font-semibold ${Number(declaredCash) - Number(summary?.cash.expected || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money((Number(declaredCash) || 0) - Number(summary?.cash.expected || 0))}</span></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setShowCloseConfirm(false)}>Go back</Button><Button onClick={closeSession} disabled={busy}>Confirm and submit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={showCloseSuccess} onOpenChange={setShowCloseSuccess}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Shift submitted successfully</DialogTitle><DialogDescription>Your Front Desk shift has been closed and sent for review.</DialogDescription></DialogHeader>
        <div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex justify-between"><span>Shift reference</span><span className="font-semibold">{current?.shiftReference}</span></div><div className="mt-1 flex justify-between"><span>Control status</span><span className="font-semibold">SUBMITTED — Awaiting review</span></div></div>
        <DialogFooter><Button onClick={() => setShowCloseSuccess(false)}>Continue</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={showOpenSuccess} onOpenChange={setShowOpenSuccess}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Front Desk shift opened</DialogTitle><DialogDescription>The till is ready for Front Desk transactions.</DialogDescription></DialogHeader>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex justify-between"><span>Till</span><span className="font-semibold">{accounts.find(account => account.id === accountId)?.name || 'Selected till'}</span></div><div className="mt-1 flex justify-between"><span>Opening float</span><span className="font-semibold">₦0.00</span></div><div className="mt-1 flex justify-between"><span>Control status</span><span className="font-semibold">OPEN</span></div></div>
        <DialogFooter><Button onClick={() => setShowOpenSuccess(false)}>Continue</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="relative overflow-hidden rounded-[28px] bg-[#0b1730] px-6 py-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" /><div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-60 w-60 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />Front Desk Operations <span className="text-white/20">/</span> Cashier Control</div><h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Cashier shift workspace</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Control today&apos;s till, review every collection, and close the shift with a traceable handover.</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => setShowShiftReport(true)} disabled={busy || !summary} className="border border-indigo-300/20 bg-indigo-500/15 text-indigo-100 shadow-none hover:bg-indigo-500/25"><Printer className="mr-2 h-4 w-4" />Front Office Deposit Control Sheet</Button><Button onClick={printTerminalReport} disabled={busy || !summary} className="border border-emerald-300/20 bg-emerald-500/15 text-emerald-100 shadow-none hover:bg-emerald-500/25"><Printer className="mr-2 h-4 w-4" />Print to Terminal</Button></div>
      </div>
      <div className="relative mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Signed accountability trail</span><span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-indigo-300" />Till control enabled</span><span className="inline-flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-amber-300" />Offline-ready collections</span></div>
    </div>
    {message && <div className="rounded-2xl border border-indigo-200 bg-white px-5 py-4 text-sm font-medium text-indigo-800 shadow-sm">{message}</div>}

    {!current ? <Card className="overflow-hidden rounded-[30px] border-0 bg-white shadow-[0_24px_70px_rgba(15,23,42,.10)]"><div className="grid lg:grid-cols-[.85fr_1.15fr]"><div className="relative overflow-hidden bg-[#0b1730] px-6 py-8 text-white sm:px-8 sm:py-10"><div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" /><div className="relative"><span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/15 text-indigo-200"><PlayCircle className="h-6 w-6" /></span><p className="text-[10px] font-bold uppercase tracking-[.22em] text-indigo-300">New shift setup</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Ready for today&apos;s collections?</h2><p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Choose the Front Desk till assigned to you. Opening floats are disabled for this workflow and always start at ₦0.00.</p><div className="mt-8 space-y-3 text-xs text-slate-400"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">✓</span>Offline transactions remain queued safely</div><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">✓</span>Every payment is tied to this till</div></div></div></div><div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10"><div className="mb-7"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-indigo-600">Till assignment</p><h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Select your cashier till</h3><p className="mt-1 text-sm text-slate-500">Only an available till can be opened for this shift.</p></div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Cashier till</label><div className="mt-2"><TillDropdown accounts={accounts} value={accountId} onChange={setAccountId} /></div>{accountId && <div className="mt-3 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><Banknote className="h-4 w-4" /></span><div><p className="text-xs font-bold text-indigo-950">{accounts.find(account => account.id === accountId)?.name || 'Selected till'}</p><p className="mt-0.5 text-[11px] text-indigo-700/70">Opening float: ₦0.00 · Ready to open</p></div></div>}<Button className="mt-7 h-14 w-full rounded-2xl bg-indigo-600 text-base font-semibold shadow-xl shadow-indigo-600/20 hover:bg-indigo-500" disabled={busy || !accountId} onClick={openSession}><PlayCircle className="mr-2 h-5 w-5" />Open Front Desk shift</Button></div></div></Card> : <>
      <Card className="overflow-hidden rounded-[28px] border-0 bg-[#0b1730] text-white shadow-[0_18px_50px_rgba(15,23,42,.18)]"><CardContent className="relative flex flex-col justify-between gap-6 p-6 sm:p-8 md:flex-row md:items-center"><div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent" /><div className="relative"><div className="mb-3 flex flex-wrap items-center gap-2 text-emerald-300"><ShieldCheck className="h-5 w-5" /><span className="text-[10px] font-bold uppercase tracking-[.2em]">Shift control status</span><Badge className="border border-emerald-300/20 bg-emerald-400/15 text-emerald-200">{effectiveControlStatus.replaceAll('_', ' ')}</Badge></div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{summary?.session.shiftReference || current.shiftReference}</h2><p className="mt-2 text-sm text-slate-300">{summary?.session.staffName || 'Assigned receptionist'} <span className="text-slate-600">·</span> {summary?.session.till || current.cashAccount?.name || 'Assigned till'}</p></div><div className="relative flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4"><div className="md:text-right"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Opened</p><p className="mt-1 font-medium text-slate-100">{dateTime(summary?.session.openedAt)}</p></div><span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-semibold text-slate-300">A4 control sheet</span></div></CardContent></Card>

      {summary && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Total payments" value={money(summary.payments.total)} detail={`${summary.payments.count} transactions`} icon={<WalletCards className="h-4 w-4" />} />
          <Metric title="Total charges" value={money(summary.charges.total)} detail={`${summary.charges.count} charges`} icon={<FileText className="h-4 w-4" />} />
          <Metric title="Expected cash" value={money(summary.cash.expected)} detail={`Opening float ${money(summary.cash.openingFloat)}`} icon={<Banknote className="h-4 w-4" />} />
          <Metric title="Variance" value={summary.cash.variance == null ? 'Not declared' : money(summary.cash.variance)} detail={summary.cash.variance == null ? 'Enter physical cash below' : summary.cash.variance === 0 ? 'Till balances exactly' : summary.cash.variance > 0 ? 'Overage' : 'Shortage'} icon={summary.cash.variance === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} valueClass={varianceTone} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]"><CardHeader className="border-b border-slate-100 px-6 py-5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><WalletCards className="h-4 w-4" /></span>Payment breakdown</CardTitle></CardHeader><CardContent className="space-y-4 px-6 py-5">{[['Cash', summary.payments.cash], ['Card / POS', summary.payments.card], ['Bank transfer', summary.payments.bankTransfer], ['Other', summary.payments.other]].map(([label, value]) => <SummaryRow key={String(label)} label={String(label)} value={money(value)} />)}<div className="rounded-xl bg-emerald-50 px-4 py-3"><SummaryRow label="Total collected" value={money(summary.payments.total)} strong valueClass="text-emerald-700" /></div></CardContent></Card>
          <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]"><CardHeader className="border-b border-slate-100 px-6 py-5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600"><FileText className="h-4 w-4" /></span>Charge breakdown</CardTitle></CardHeader><CardContent className="space-y-4 px-6 py-5">{[['Room charges', summary.charges.room], ['Laundry', summary.charges.laundry], ['Other Front Desk', summary.charges.other]].map(([label, value]) => <SummaryRow key={String(label)} label={String(label)} value={money(value)} />)}<div className="rounded-xl bg-indigo-50 px-4 py-3"><SummaryRow label="Total charges" value={money(summary.charges.total)} strong valueClass="text-indigo-700" /></div></CardContent></Card>
        </div>

        <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 py-5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Banknote className="h-4 w-4" /></span>Cash reconciliation</CardTitle><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Till proof</span></CardHeader><CardContent className="grid gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4"><SummaryRow label="Opening float" value={money(summary.cash.openingFloat)} /><SummaryRow label="Cash received" value={money(summary.payments.cash)} /><SummaryRow label="Cash in" value={money(summary.cash.cashIn)} /><SummaryRow label="Refunds / drops / paid out" value={money(summary.cash.refunds + summary.cash.cashDrops + summary.cash.paidOuts + summary.cash.transfersOut)} /><SummaryRow label="Expected cash" value={money(summary.cash.expected)} strong /><SummaryRow label="Declared cash" value={summary.cash.declared == null ? 'Not declared' : money(summary.cash.declared)} /><SummaryRow label="Variance" value={summary.cash.variance == null ? '—' : money(summary.cash.variance)} strong valueClass={varianceTone} /></CardContent></Card>

        <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 py-5"><CardTitle className="flex items-center gap-3 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white"><LockKeyhole className="h-4 w-4" /></span>Close and submit shift</CardTitle><Badge variant={summary.exceptions.failedSync ? 'destructive' : 'secondary'}>{summary.exceptions.failedSync ? `${summary.exceptions.failedSync} failed sync` : 'No sync failures'}</Badge></CardHeader><CardContent className="space-y-5 px-6 py-6"><p className="max-w-2xl text-sm leading-6 text-slate-500">Count the physical till, enter the exact amount, then close the session. The system will lock Front Desk transactions and send the report for management review.</p>{summary.exceptions.failedSync > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Resolve failed synchronization events before submitting this shift.</p>}
        {summary.cash.expected === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">Cashless Shift Detected:</span> No expected cash to drop.
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between"><div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Physical cash counted</label><AmountInput value={declaredCash} onValueChange={setDeclaredCash} placeholder="0.00" className="mt-2 h-12 bg-white" /></div><Button className="h-12 rounded-xl bg-slate-900 px-6 font-semibold shadow-lg shadow-slate-900/15 hover:bg-slate-800" disabled={busy || !declaredCash || !canSubmitShift || summary.exceptions.failedSync > 0} onClick={() => setShowCloseConfirm(true)}><LockKeyhole className="mr-2 h-4 w-4" />{effectiveControlStatus === 'RETURNED' ? 'Correct and resubmit shift' : summary.cash.expected === 0 && declaredCash === '0' ? 'Submit Cashless Shift' : 'Close and submit shift'}</Button></div></CardContent></Card>

        <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]"><CardHeader className="border-b border-slate-100 px-6 py-5"><CardTitle className="text-base">Recent session activity</CardTitle></CardHeader><CardContent className="px-6 py-2"><div className="divide-y divide-slate-100">{summary.rows.slice(0, 8).map((row, index) => <div key={`${row.date}-${index}`} className="flex items-center justify-between gap-4 py-4 text-sm"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><FileText className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="truncate font-medium text-slate-800">{row.description || row.kind}</p><p className="text-xs text-slate-400">{dateTime(row.date)} · {row.method || '—'}</p></div></div><span className="font-semibold text-slate-700">{money(row.amount)}</span></div>)}{summary.rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No session activity recorded yet.</p>}</div></CardContent></Card>
      </>}
    </>}

    {current?.status === 'CLOSED' && ['SUBMITTED', 'UNDER_REVIEW'].includes(effectiveControlStatus) && <Card className="border-amber-200 bg-amber-50"><CardHeader><CardTitle className="text-amber-900">Awaiting management review</CardTitle></CardHeader><CardContent><p className="text-sm text-amber-800">This shift has been submitted. General Cashier or Finance will review it; Front Desk staff cannot approve their own shift.</p></CardContent></Card>}

    {current?.status === 'CLOSED' && (effectiveControlStatus === 'APPROVED' || effectiveControlStatus === 'APPROVED_WITH_VARIANCE') && <Card className="border-indigo-200 bg-indigo-50"><CardHeader><CardTitle className="text-indigo-900">Initiate Cash Handover</CardTitle></CardHeader><CardContent><p className="text-sm text-indigo-700">Your shift has been approved by management. Please initiate the handover process to formally transfer the physical cash to the General Cashier.</p><div className="mt-4 flex justify-end"><Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={busy} onClick={initiateHandover}><ArrowRightLeft className="mr-2 h-4 w-4" />Initiate Handover</Button></div></CardContent></Card>}
    <Dialog open={showHandoverSuccess} onOpenChange={setShowHandoverSuccess}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Handover initiated</DialogTitle><DialogDescription>Your approved shift is now waiting for the General Cashier to receive the physical cash.</DialogDescription></DialogHeader><div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex justify-between"><span>Shift reference</span><span className="font-semibold">{current?.shiftReference}</span></div><div className="mt-1 flex justify-between"><span>Next status</span><span className="font-semibold">HANDOVER PENDING</span></div></div><DialogFooter><Button onClick={() => logout()}>Log out and start next shift</Button></DialogFooter></DialogContent></Dialog>
    </div>
  </div>;
}

function TillDropdown({ accounts, value, onChange }: { accounts: CashAccount[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = accounts.find(a => a.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { CASH: 'Cash till', BANK: 'Bank account', SAFE: 'Safe', OTHER: 'Other' };
    return map[type?.toUpperCase()] ?? type;
  };

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      CASH: 'bg-emerald-100 text-emerald-700',
      BANK: 'bg-blue-100 text-blue-700',
      SAFE: 'bg-amber-100 text-amber-700',
    };
    return map[type?.toUpperCase()] ?? 'bg-slate-100 text-slate-600';
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={[
          'flex h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition-all duration-200',
          open
            ? 'border-indigo-500 bg-white ring-4 ring-indigo-500/10 shadow-md'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white shadow-inner',
        ].join(' ')}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Banknote className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-slate-900">{selected.name}</span>
              <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${typeColor(selected.type)}`}>
                {typeLabel(selected.type)}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-slate-400 font-normal">Choose an available till…</span>
        )}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)] ring-1 ring-black/5"
          style={{ animation: 'tillDropIn 0.18s cubic-bezier(0.16,1,0.3,1)' }}
        >
          <style>{`@keyframes tillDropIn { from { opacity:0; transform:translateY(-6px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
          <div className="max-h-72 overflow-y-auto p-2">
            {accounts.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No tills available.</p>
            )}
            {accounts.map(account => {
              const isSelected = account.id === value;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => { onChange(account.id); setOpen(false); }}
                  className={[
                    'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150',
                    isSelected
                      ? 'bg-indigo-50 text-indigo-900'
                      : 'hover:bg-slate-50 text-slate-800',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600',
                    ].join(' ')}
                  >
                    <Banknote className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{account.name}</span>
                    <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${typeColor(account.type)}`}>
                      {typeLabel(account.type)}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <p className="text-[11px] text-slate-400">Opening float is always ₦0.00 for Front Desk shifts</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, detail, icon, valueClass = '' }: { title: string; value: string; detail: string; icon: ReactNode; valueClass?: string }) {
  return <Card className="rounded-[24px] border-0 bg-white shadow-[0_14px_40px_rgba(15,23,42,.06)]"><CardContent className="relative overflow-hidden p-5"><div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-indigo-500/5 blur-2xl" /><div className="relative flex items-center justify-between text-slate-400"><span className="text-[10px] font-bold uppercase tracking-[.16em]">{title}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">{icon}</span></div><p className={`relative mt-4 text-2xl font-bold tracking-tight ${valueClass || 'text-slate-900'}`}>{value}</p><p className="relative mt-1 text-xs text-slate-500">{detail}</p></CardContent></Card>;
}

function SummaryRow({ label, value, strong = false, valueClass = '' }: { label: string; value: string; strong?: boolean; valueClass?: string }) {
  return <div className="flex items-center justify-between gap-3"><span className={strong ? 'font-semibold' : 'text-sm text-muted-foreground'}>{label}</span><span className={`${strong ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span></div>;
}
