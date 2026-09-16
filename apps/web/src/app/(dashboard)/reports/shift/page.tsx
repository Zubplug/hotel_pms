'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import {
  Loader2,
  Download,
  Printer,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  Banknote,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ArrowLeft,
  FileText,
  CreditCard,
  XCircle,
  RotateCcw,
  History,
  Activity,
  BarChart3,
  CircleDollarSign,
  Filter,
  Radio,
  RefreshCw,
  Search,
  WalletCards,
  Check,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const fmt = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN:                'bg-blue-50 text-blue-700 border-blue-200',
    CLOSING:             'bg-blue-50 text-blue-700 border-blue-200',
    CLOSED:              'bg-slate-100 text-slate-600 border-slate-200',
    SUBMITTED:           'bg-amber-50 text-amber-700 border-amber-200',
    UNDER_REVIEW:        'bg-violet-50 text-violet-700 border-violet-200',
    APPROVED:            'bg-emerald-50 text-emerald-700 border-emerald-200',
    APPROVED_WITH_VARIANCE: 'bg-amber-50 text-amber-700 border-amber-200',
    REJECTED:            'bg-red-50 text-red-700 border-red-200',
    PENDING_HANDOVER:    'bg-orange-50 text-orange-700 border-orange-200',
    HANDOVER_PENDING:    'bg-orange-50 text-orange-700 border-orange-200',
    RECONCILED:          'bg-emerald-50 text-emerald-700 border-emerald-200',
    CASHLESS_ACKNOWLEDGED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${map[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {label}
    </span>
  );
}

export default function ShiftReportPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState<string>('ALL');
  const [shiftScope, setShiftScope] = useState('ALL');
  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shiftNavigatorOpen, setShiftNavigatorOpen] = useState(false);

  const [decision, setDecision] = useState('APPROVED');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [approvalState, setApprovalState] = useState('');
  const [reviewDialog, setReviewDialog] = useState<'success' | 'error' | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    setShiftId(new URLSearchParams(window.location.search).get('shiftId'));
  }, []);

  const fetchShiftReport = async () => {
    if (!propertyId) return null;
    const start = startOfDay(new Date(date)).toISOString();
    const end = endOfDay(new Date(date)).toISOString();
    let url = `/api/v1/reports/shift?propertyId=${propertyId}&startDate=${start}&endDate=${end}`;
    if (shiftId) url += `&shiftId=${encodeURIComponent(shiftId)}`;
    if (userId !== 'ALL') url += `&userId=${userId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
    return data.data;
  };

  const fetchShiftOverview = async () => {
    if (!propertyId) return null;
    let url = `/api/v1/reports/shift?propertyId=${propertyId}&scope=CONTROL_ROOM`;
    if (userId !== 'ALL') url += `&userId=${userId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch shift overview');
    return data.data;
  };

  const { data: report, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['shiftReport', propertyId, date, userId, shiftId],
    queryFn: fetchShiftReport,
    enabled: !!propertyId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const { data: overviewReport, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview } = useQuery({
    queryKey: ['shiftOverview', propertyId, date, userId],
    queryFn: fetchShiftOverview,
    enabled: !!propertyId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const selectedShift = shiftId ? report?.shifts?.[0] : null;
  const needsApproval =
    selectedShift &&
    (selectedShift.type === 'FRONT_DESK'
      ? ['SUBMITTED', 'UNDER_REVIEW', 'CLOSED'].includes(
          selectedShift.controlStatus || selectedShift.status
        )
      : ['SUBMITTED', 'UNDER_REVIEW'].includes(selectedShift.controlStatus) ||
        selectedShift.settlementStatus === 'PENDING_HANDOVER');

  const shiftVariance = selectedShift
    ? (selectedShift.declaredCash != null ? Number(selectedShift.declaredCash) : 0) -
      (selectedShift.expectedCash != null ? Number(selectedShift.expectedCash) : 0)
    : 0;
  const requiresInvestigationNotes = decision !== 'APPROVED';
  const notesAreValid = !requiresInvestigationNotes || approvalNotes.trim().length >= 10;
  const reviewInputsAreValid = notesAreValid && (decision !== 'APPROVED_WITH_VARIANCE' || Boolean(reasonCode));

  const approveShift = async () => {
    if (!selectedShift || !shiftId) return;
    if (!reviewInputsAreValid) {
      setApprovalState(decision === 'APPROVED_WITH_VARIANCE' && !reasonCode ? 'Select a variance reason before submitting.' : 'Add at least 10 characters to the required investigation notes.');
      return;
    }
    setApproving(true);
    setApprovalState('');
    try {
      const response = await fetch(
        `/api/v1/reports/shift/${encodeURIComponent(shiftId)}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            notes: approvalNotes,
            reasonCode: decision === 'APPROVED_WITH_VARIANCE' ? reasonCode : undefined,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to approve shift');
      setApprovalState(
        decision === 'REJECTED' ? 'Shift returned for correction.' : 'Shift successfully approved.'
      );
      setReviewDialog('success');
    } catch (err) {
      setApprovalState(err instanceof Error ? err.message : 'Unable to process review');
      setReviewDialog('error');
    } finally {
      setApproving(false);
    }
  };

  const exportReport = () => {
    const rows = (report?.shifts || []).map((shift: any) => [
      shift.type,
      shift.shiftReference || shift.id,
      shift.controlStatus || shift.status,
      shift.operator ? `${shift.operator.firstName} ${shift.operator.lastName}` : '',
      Number(shift.expectedCash || 0),
      Number(shift.declaredCash || 0),
      Number(shift.variance || 0),
    ]);
    const csv = [
      ['Type', 'Shift', 'Status', 'Operator', 'Expected Handover', 'Declared Cash', 'Variance'],
      ...rows,
    ]
      .map((row) =>
        row.map((value: any) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `shift-report-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (selectedShift) {
      if (shiftVariance === 0) setDecision('APPROVED');
      else setDecision('APPROVED_WITH_VARIANCE');
    }
  }, [selectedShift, shiftVariance]);

  // Build transactions list
  const transactions: any[] = [];
  if (report?.items) {
    report.items.payments.forEach((p: any) =>
      transactions.push({
        id: p.id, type: 'PAYMENT', date: p.createdAt, method: p.method,
        amount: Number(p.amount), guest: p.folio?.reservation?.primaryGuest,
        reservationId: p.folio?.reservation?.id, staffId: p.receivedBy, status: p.status,
        reference: p.receiptNumber || p.reference || p.providerTransactionId || p.id,
      })
    );
    report.items.refunds.forEach((r: any) =>
      transactions.push({
        id: r.id, type: 'REFUND', date: r.createdAt, method: r.payment?.method,
        amount: -Number(r.amount), guest: r.payment?.folio?.reservation?.primaryGuest,
        reservationId: r.payment?.folio?.reservation?.id, staffId: r.authorizedBy, status: r.status,
        reference: r.payment?.receiptNumber || r.payment?.reference || r.id,
      })
    );
    report.items.posPayments?.forEach((p: any) =>
      transactions.push({
        id: p.id,
        type: 'POS PAYMENT',
        date: p.date,
        method: p.method,
        amount: Number(p.amount),
        orderNumber: p.orderNumber,
        staffId: p.operatorId,
        status: p.status,
        reference: p.reference || p.id,
      })
    );
    report.items.posCashMovements?.forEach((movement: any) => {
      const inflow = ['OPENING_FLOAT', 'CASH_IN', 'CASH_TRANSFER_IN'].includes(movement.type);
      transactions.push({
        id: movement.id,
        type: 'POS CASH MOVEMENT',
        date: movement.createdAt,
        method: movement.type,
        amount: inflow ? Number(movement.amount) : -Number(movement.amount),
        staffId: movement.userId,
        status: 'RECORDED',
        reference: movement.receiptReference || movement.operationId || movement.id,
      });
    });
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const dashboardReport = overviewReport || report;
  const pageLoading = isLoading || overviewLoading;
  const pageError = error || overviewError;
  const isDetailView = Boolean(shiftId);
  const shifts = dashboardReport?.shifts ?? [];
  const getShiftStatus = (shift: any) => shift.controlStatus || shift.status || 'OPEN';
  const liveShifts = shifts.filter((shift: any) => ['OPEN', 'CLOSING'].includes(getShiftStatus(shift)) || shift.status === 'OPEN');
  const unreconciledShifts = shifts.filter((shift: any) => !['APPROVED', 'RECONCILED', 'HANDED_OVER', 'DEPOSITED', 'CASHLESS_ACKNOWLEDGED'].includes(getShiftStatus(shift)));
  const reviewableShifts = shifts.filter((shift: any) => ['SUBMITTED', 'UNDER_REVIEW', 'CLOSED', 'RETURNED', 'PENDING_HANDOVER', 'HANDOVER_PENDING'].includes(getShiftStatus(shift)));
  const declaredShifts = shifts.filter((shift: any) => shift.declaredCash != null);
  const expectedCashExposure = unreconciledShifts.reduce((sum: number, shift: any) => sum + Number(shift.expectedCash || 0), 0);
  const varianceExposure = declaredShifts.reduce((sum: number, shift: any) => sum + Number(shift.variance || 0), 0);
  const operatorOptions = Array.from(new Map(shifts.filter((shift: any) => shift.operator?.id).map((shift: any) => [shift.operator.id, shift.operator])).values());
  const sortedShifts = [...shifts].sort((a: any, b: any) => {
    const priority = (shift: any) => {
      const status = getShiftStatus(shift);
      if (['RETURNED'].includes(status)) return 0;
      if (['SUBMITTED', 'UNDER_REVIEW', 'CLOSED', 'PENDING_HANDOVER', 'HANDOVER_PENDING'].includes(status)) return 1;
      if (['OPEN', 'CLOSING'].includes(status) || shift.status === 'OPEN') return 2;
      return 3;
    };
    return priority(a) - priority(b) || new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
  });
  const visibleShifts = sortedShifts.filter((shift: any) => {
    const status = getShiftStatus(shift);
    const matchesScope = shiftScope === 'ALL'
      || (shiftScope === 'LIVE' && (['OPEN', 'CLOSING'].includes(status) || shift.status === 'OPEN'))
      || (shiftScope === 'UNRECONCILED' && unreconciledShifts.some((item: any) => item.id === shift.id))
      || (shiftScope === 'REVIEW' && reviewableShifts.some((item: any) => item.id === shift.id));
    const haystack = `${shift.operator?.firstName || ''} ${shift.operator?.lastName || ''} ${shift.outlet?.name || ''} ${shift.till?.name || ''} ${shift.shiftReference || shift.id}`.toLowerCase();
    return matchesScope && (!shiftSearch.trim() || haystack.includes(shiftSearch.trim().toLowerCase()));
  });
  const refreshReports = () => {
    void refetch();
    void refetchOverview();
  };
  const setSelectedShift = (id: string) => {
    setShiftId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('shiftId', id);
    router.push(`/reports/shift?${params.toString()}`);
  };
  const clearSelectedShift = () => {
    setShiftId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('shiftId');
    router.push(`/reports/shift${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0b1120] via-[#101d34] to-[#0b1120] px-6 py-8 print:hidden sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative z-10 max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
              General cashier operations
            </p>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isDetailView ? 'Shift detail & reconciliation' : 'Shift control room'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isDetailView ? 'Review one shift, document the outcome, and complete its control trail.' : 'Monitor every live till, reconcile submitted shifts, and protect the audit trail.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportReport}
              disabled={!shifts.length}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:opacity-40"
            >
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 px-5 py-7 sm:px-8">
        {!isDetailView && !pageLoading && !pageError && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Filter className="h-5 w-5" /></div>
                <div><p className="text-sm font-semibold text-slate-900">Shift workspace</p><p className="text-xs text-slate-500">Select a business date and focus the queue below.</p></div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 w-full rounded-xl sm:w-40" aria-label="Business date for detail report" />
                <Select value={userId} onValueChange={(value) => setUserId(value || 'ALL')}>
                  <SelectTrigger className="h-10 w-full rounded-xl sm:w-48"><SelectValue placeholder="All cashiers" /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">All cashiers</SelectItem>{operatorOptions.map((operator: any) => <SelectItem key={operator.id} value={operator.id}>{operator.firstName} {operator.lastName}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" className="h-10 rounded-xl" onClick={refreshReports} disabled={pageLoading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {[['ALL', `All shifts (${shifts.length})`], ['LIVE', `Live now (${liveShifts.length})`], ['UNRECONCILED', `Unreconciled (${unreconciledShifts.length})`], ['REVIEW', `Needs review (${reviewableShifts.length})`]].map(([value, label]) => <button key={value} type="button" onClick={() => setShiftScope(value)} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition', shiftScope === value ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700')}>{label}</button>)}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live refresh every 30 seconds{dataUpdatedAt ? ` · Updated ${format(new Date(dataUpdatedAt), 'HH:mm:ss')}` : ''}</div>
            </div>
          </section>
        )}
        {/* Loading */}
        {pageLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 rounded-full border-[3px] border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-slate-400">Loading shift data…</p>
          </div>
        )}

        {/* Error */}
        {pageError && !pageLoading && (
          <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl p-5">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Error loading report</p>
              <p className="text-sm text-red-600 mt-0.5">{(pageError as Error).message}</p>
            </div>
          </div>
        )}

        {!pageLoading && !pageError && (
          <>
            {!isDetailView && (
              <>
            {/* ─── Portfolio control snapshot ─── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Live shifts', value: liveShifts.length, detail: liveShifts.length ? 'Currently open or closing' : 'No active tills', icon: Radio, tone: liveShifts.length ? 'text-blue-700 bg-blue-50' : 'text-slate-500 bg-slate-100' },
                { label: 'Needs reconciliation', value: reviewableShifts.length, detail: 'Submitted or awaiting decision', icon: ShieldCheck, tone: reviewableShifts.length ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50' },
                { label: 'Cash exposure', value: fmt(expectedCashExposure), detail: 'Expected cash in unreconciled tills', icon: CircleDollarSign, tone: 'text-indigo-700 bg-indigo-50' },
                { label: 'Net variance', value: fmt(varianceExposure), detail: declaredShifts.length ? `${declaredShifts.length} declared shift${declaredShifts.length === 1 ? '' : 's'}` : 'No declarations yet', icon: varianceExposure < 0 ? TrendingDown : varianceExposure > 0 ? TrendingUp : CheckCircle2, tone: varianceExposure < 0 ? 'text-rose-700 bg-rose-50' : varianceExposure > 0 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50' },
              ].map((card) => {
                const Icon = card.icon;
                return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{card.value}</p><p className="mt-1 text-xs text-slate-400">{card.detail}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" /></span></div></div>;
              })}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              {/* Live and unreconciled worklist */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600"><Activity className="h-4 w-4" />Shift operations</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Live &amp; unreconciled shifts</h2><p className="mt-1 text-sm text-slate-500">Prioritized by exception, review urgency, and active cash custody.</p></div>
                    <div className="relative w-full sm:w-56"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={shiftSearch} onChange={(event) => setShiftSearch(event.target.value)} placeholder="Search cashier or till" className="h-9 rounded-xl pl-9 text-xs" /></div>
                  </div>
                </div>
                {visibleShifts.length === 0 ? <div className="flex flex-col items-center justify-center px-6 py-16 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500" /><p className="mt-3 text-sm font-semibold text-slate-700">No shifts match this view</p><p className="mt-1 text-sm text-slate-400">Try another date, filter, or search term.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-50/80 text-left"><th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift / operator</th><th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</th><th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th><th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected cash</th><th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Variance</th><th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleShifts.map((shift: any) => { const status = getShiftStatus(shift); const variance = shift.variance == null ? null : Number(shift.variance); const isLive = ['OPEN', 'CLOSING'].includes(status) || shift.status === 'OPEN'; return <tr key={shift.id} className="group transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${shift.type === 'POS' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{shift.type === 'POS' ? 'POS' : 'FD'}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{shift.operator ? `${shift.operator.firstName} ${shift.operator.lastName}` : 'Unassigned operator'}</p><p className="truncate font-mono text-[10px] text-slate-400">{shift.shiftReference || shift.id.slice(0, 12).toUpperCase()}</p></div></div></td><td className="px-5 py-4"><p className="font-medium text-slate-700">{shift.outlet?.name || shift.till?.name || 'Till'}</p><p className="text-xs text-slate-400">Opened {format(new Date(shift.openedAt), 'HH:mm')}</p></td><td className="px-5 py-4"><div className="flex items-center gap-2">{isLive && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}<StatusChip status={status} /></div></td><td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-700">{fmt(Number(shift.expectedCash || 0))}</td><td className={`px-5 py-4 text-right font-bold tabular-nums ${variance == null ? 'text-slate-400' : variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{variance == null ? 'Not declared' : fmt(variance)}</td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setSelectedShift(shift.id)}>{isLive ? 'Monitor' : 'Review'}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></td></tr>; })}</tbody></table></div>}
              </section>

              {/* Cashier intelligence */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-600"><BarChart3 className="h-4 w-4" />Cashier intelligence</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Collection mix</h2><p className="mt-1 text-sm text-slate-500">Gross collections across the selected date.</p></div><WalletCards className="h-5 w-5 text-emerald-500" /></div>
                {Object.entries(dashboardReport?.summary || {}).length === 0 ? <div className="flex h-48 items-center justify-center text-sm text-slate-400">No collection activity yet.</div> : <div className="mt-7 space-y-5">{Object.entries(dashboardReport?.summary || {}).slice(0, 5).map(([method, values]: [string, any], index) => { const amount = Number(values?.net || 0); const total = Object.values(dashboardReport?.summary || {}).reduce((sum: number, item: any) => sum + Math.max(Number(item?.net || 0), 0), 0) || 1; const percentage = Math.max((amount / total) * 100, 0); return <div key={method}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium capitalize text-slate-700">{method.replace(/_/g, ' ').toLowerCase()}</span><span className="font-semibold text-slate-900">{fmt(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === 0 ? 'bg-indigo-500' : index === 1 ? 'bg-emerald-500' : index === 2 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${Math.min(percentage, 100)}%` }} /></div><p className="mt-1 text-right text-[11px] text-slate-400">{percentage.toFixed(1)}% of net collections</p></div>; })}</div>}
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs"><span className="font-medium text-slate-500">Net collections</span><span className="font-bold text-slate-900">{fmt(Number(dashboardReport?.cashierTotals?.net || 0))}</span></div>
              </section>
            </div>
              </>
            )}

            {selectedShift && (
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm print:hidden sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3"><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-indigo-200 bg-white text-indigo-700 shadow-sm hover:bg-indigo-50" onClick={clearSelectedShift} aria-label="Back to shift queue"><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600">Selected shift review</p><p className="mt-1 text-sm text-slate-600">Move between operational shifts without leaving the detail workspace.</p></div></div>
                  <div className="flex w-full items-end gap-2 lg:w-auto"><div className="min-w-0 flex-1 lg:min-w-[360px]"><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">Shift navigator</label><Popover open={shiftNavigatorOpen} onOpenChange={setShiftNavigatorOpen}><PopoverTrigger render={<Button variant="outline" className="h-12 w-full justify-between rounded-xl border-indigo-200 bg-white px-3 text-left shadow-sm hover:bg-indigo-50" />}><span className="flex min-w-0 items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold ${selectedShift.type === 'POS' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{selectedShift.type === 'POS' ? 'POS' : 'FD'}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{selectedShift.operator ? `${selectedShift.operator.firstName} ${selectedShift.operator.lastName}` : 'Unassigned operator'}</span><span className="flex items-center gap-1 truncate text-[11px] text-slate-500"><MapPin className="h-3 w-3 shrink-0" />{selectedShift.outlet?.name || selectedShift.till?.name || 'Till'}<span className="text-slate-300">·</span>{getShiftStatus(selectedShift).replace(/_/g, ' ')}</span></span></span><ChevronDown className={cn('h-4 w-4 shrink-0 text-indigo-500 transition-transform', shiftNavigatorOpen && 'rotate-180')} /></PopoverTrigger><PopoverContent align="end" className="w-[min(430px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-indigo-100 bg-white p-0 shadow-xl"><div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Switch shift</p><p className="mt-1 text-xs text-slate-400">Select an active or unreconciled shift to review.</p></div><div className="max-h-[min(420px,60vh)] overflow-y-auto p-2">{shifts.map((shift: any) => { const isSelected = shift.id === selectedShift.id; const status = getShiftStatus(shift); const isLive = ['OPEN', 'CLOSING'].includes(status) || shift.status === 'OPEN'; return <button key={shift.id} type="button" onClick={() => { setSelectedShift(shift.id); setShiftNavigatorOpen(false); }} className={cn('flex w-full items-center gap-3 rounded-xl p-3 text-left transition', isSelected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50')}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${shift.type === 'POS' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{shift.type === 'POS' ? 'POS' : 'FD'}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-800">{shift.operator ? `${shift.operator.firstName} ${shift.operator.lastName}` : 'Unassigned operator'}</span>{isLive && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />}</span><span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0 text-slate-400" />{shift.outlet?.name || shift.till?.name || 'Till'}<span className="text-slate-300">·</span>{shift.shiftReference || shift.id.slice(0, 8).toUpperCase()}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><StatusChip status={status} />{shift.expectedCash != null && <span className="text-[10px] font-medium text-slate-400">{fmt(Number(shift.expectedCash || 0))} expected</span>}</span>{isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}</button>; })}</div></PopoverContent></Popover></div><Button variant="outline" className="h-11 rounded-xl border-indigo-200 bg-white px-4 text-indigo-700 shadow-sm hover:bg-indigo-50" onClick={clearSelectedShift}>Queue</Button></div>
                </div>
              </section>
            )}

            {/* ─── Cash Reconciliation Panel ─── */}
            {selectedShift && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Panel header */}
                <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-700">Payment Handover &amp; Reconciliation</h2>
                  </div>
                  <StatusChip status={selectedShift.controlStatus || selectedShift.status} />
                </div>

                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-5">
                  {/* Type / location */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Type / Location</p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedShift.type}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedShift.outlet?.name || selectedShift.till?.name || 'Till'}
                    </p>
                  </div>

                  {/* Cashier */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cashier</p>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {selectedShift.operator
                          ? `${selectedShift.operator.firstName?.[0] ?? ''}${selectedShift.operator.lastName?.[0] ?? ''}`
                          : '?'}
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedShift.operator
                          ? `${selectedShift.operator.firstName} ${selectedShift.operator.lastName}`
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Opened */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Opened</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {format(new Date(selectedShift.openedAt), 'dd MMM yyyy')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(selectedShift.openedAt), 'HH:mm')}
                    </p>
                  </div>

                  {/* Shift Reference */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Reference</p>
                    <p className="text-xs font-mono font-semibold text-slate-700">
                      {selectedShift.shiftReference || selectedShift.id?.slice(0, 12).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Financial strip */}
                <div className="border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                  {[
                    { label: 'Opening Float', value: fmt(Number(selectedShift.openingFloat ?? 0)), icon: Banknote, color: 'text-slate-700' },
                    { label: 'Expected Cash Handover', value: fmt(Number(selectedShift.expectedCash ?? 0)), icon: TrendingUp, color: 'text-blue-700', sub: 'Physical cash only' },
                    { label: 'Declared Cash', value: selectedShift.declaredCash == null ? 'Not declared' : fmt(Number(selectedShift.declaredCash)), icon: ShieldCheck, color: 'text-slate-700' },
                    {
                      label: 'Variance',
                      value: fmt(shiftVariance) + (shiftVariance !== 0 ? (shiftVariance > 0 ? ' OVER' : ' SHORT') : ''),
                      icon: shiftVariance === 0 ? Minus : shiftVariance > 0 ? TrendingUp : TrendingDown,
                      color: shiftVariance < 0 ? 'text-red-600' : shiftVariance > 0 ? 'text-amber-600' : 'text-emerald-600',
                      bg: shiftVariance < 0 ? 'bg-red-50' : shiftVariance > 0 ? 'bg-amber-50' : 'bg-emerald-50',
                    },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className={`p-5 ${stat.bg ?? ''}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                          <p className="text-xs font-medium text-slate-400">{stat.label}</p>
                        </div>
                        <p className={`text-lg font-black tracking-tight ${stat.color}`}>
                          {stat.value}
                        </p>
                        {stat.sub && <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-6 py-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receipts to hand over</h3>
                      <p className="text-xs text-slate-400 mt-1">Completed collections grouped by payment method.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {fmt(Object.values(selectedShift.paymentTotals ?? {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Object.entries(selectedShift.paymentTotals ?? {}).map(([method, amount]: [string, any]) => (
                      <div key={method} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{method.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">{fmt(Number(amount || 0))}</p>
                      </div>
                    ))}
                    {Object.keys(selectedShift.paymentTotals ?? {}).length === 0 && <p className="text-sm text-slate-400">No completed payment receipts recorded.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ─── General Cashier Review Panel ─── */}
            {needsApproval && (
              <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
                <div className="bg-indigo-50/60 border-b border-indigo-100 px-6 py-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-semibold text-indigo-800">General Cashier Review</h2>
                  <span className="ml-auto text-xs text-indigo-500 font-medium">Action required</span>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Review decision
                        </label>
                        <p className="text-xs text-slate-400 mt-1">
                          Select the outcome to record in the shift audit trail.
                        </p>
                      </div>
                      <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        {shiftVariance === 0 ? 'Balanced shift' : 'Variance detected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="group" aria-label="Review decision">
                      {[
                        {
                          value: 'APPROVED',
                          title: 'Approve',
                          description: 'Balanced shift with no variance.',
                          icon: CheckCircle2,
                          disabled: shiftVariance !== 0,
                          selected: 'border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100',
                          iconColor: 'text-emerald-600',
                        },
                        {
                          value: 'APPROVED_WITH_VARIANCE',
                          title: 'Approve with variance',
                          description: 'Accept and document a shortage or overage.',
                          icon: AlertTriangle,
                          disabled: shiftVariance === 0,
                          selected: 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-100',
                          iconColor: 'text-amber-600',
                        },
                        {
                          value: 'CASHLESS_ACKNOWLEDGED',
                          title: 'Acknowledge non-cash handover',
                          description: 'Physical documents received (no cash).',
                          icon: CheckCircle2,
                          disabled: (selectedShift?.expectedCash != null ? Number(selectedShift.expectedCash) : 0) !== 0 || shiftVariance !== 0,
                          selected: 'border-blue-300 bg-blue-50/80 ring-2 ring-blue-100',
                          iconColor: 'text-blue-600',
                        },
                        {
                          value: 'REJECTED',
                          title: 'Return for correction',
                          description: 'Send the shift back to the operator.',
                          icon: RotateCcw,
                          disabled: false,
                          selected: 'border-rose-300 bg-rose-50/80 ring-2 ring-rose-100',
                          iconColor: 'text-rose-600',
                        },
                      ].map((option) => {
                        const Icon = option.icon;
                        const isSelected = decision === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={option.disabled}
                            aria-pressed={isSelected}
                            onClick={() => setDecision(option.value)}
                            className={cn(
                              'group relative flex min-h-[88px] items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                              isSelected ? option.selected : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                              option.disabled && 'cursor-not-allowed opacity-45 hover:border-slate-200 hover:bg-white'
                            )}
                          >
                            <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm', option.iconColor)}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-slate-800">{option.title}</span>
                              <span className="mt-1 block text-xs leading-4 text-slate-500">{option.description}</span>
                              {option.disabled && (
                                <span className="mt-1.5 block text-[10px] font-medium text-slate-400">
                                  {shiftVariance === 0 ? 'Only available with a variance' : 'Unavailable while variance exists'}
                                </span>
                              )}
                            </span>
                            {isSelected && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-indigo-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Variance reason */}
                  {decision === 'APPROVED_WITH_VARIANCE' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <label className="block text-xs font-semibold text-amber-900 mb-1.5 uppercase tracking-wider">
                        Variance reason <span className="text-amber-600">*</span>
                      </label>
                      <Select value={reasonCode} onValueChange={(v) => setReasonCode(v || '')}>
                        <SelectTrigger className="bg-white border-amber-200 rounded-xl">
                          <SelectValue placeholder="Select the reason for this variance…" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            ['CASH_COUNTING_ERROR', 'Cash Counting Error'],
                            ['MISSING_RECEIPT', 'Missing Receipt'],
                            ['UNAUTHORIZED_PAYOUT', 'Unauthorized Payout'],
                            ['REFUND_ERROR', 'Refund Error'],
                            ['WRONG_CHANGE', 'Wrong Change Given'],
                            ['CASH_DROP_ERROR', 'Cash Drop Error'],
                            ['SYSTEM_ERROR', 'System Error'],
                            ['UNKNOWN', 'Unknown'],
                            ['OTHER', 'Other'],
                          ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Notes */}
                  <div className={cn('rounded-2xl border p-4 transition-colors', requiresInvestigationNotes ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50')}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <label htmlFor="investigation-notes" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
                          Investigation notes
                          {requiresInvestigationNotes && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-rose-700">Required</span>}
                          {!requiresInvestigationNotes && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-slate-500">Optional</span>}
                        </label>
                        <p id="investigation-notes-help" className="mt-1 text-xs leading-5 text-slate-500">
                          {requiresInvestigationNotes ? 'Record what was checked and why this decision is appropriate. This becomes part of the permanent audit trail.' : 'Add context for the reviewer or future audit reference.'}
                        </p>
                      </div>
                      <span className={cn('text-xs tabular-nums', requiresInvestigationNotes && !notesAreValid ? 'font-semibold text-amber-700' : 'text-slate-400')}>{approvalNotes.length}/1000</span>
                    </div>
                    <Textarea
                      id="investigation-notes"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value.slice(0, 1000))}
                      placeholder={requiresInvestigationNotes ? 'Example: Counted cash with the operator, checked cash-drop slips, and confirmed the shortage relates to…' : 'Add optional review context…'}
                      rows={4}
                      maxLength={1000}
                      aria-required={requiresInvestigationNotes}
                      aria-invalid={requiresInvestigationNotes && approvalNotes.length > 0 && !notesAreValid}
                      aria-describedby="investigation-notes-help"
                      className={cn('mt-3 resize-y rounded-xl bg-white text-sm leading-6 shadow-sm', requiresInvestigationNotes && !notesAreValid ? 'border-amber-300 focus-visible:border-amber-400 focus-visible:ring-amber-200' : 'border-slate-200')}
                    />
                    {requiresInvestigationNotes && !notesAreValid && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Enter at least 10 characters before submitting this review.</p>}
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={approveShift}
                      disabled={approving || !reviewInputsAreValid}
                      className={cn(
                        'rounded-xl px-5 font-semibold',
                        decision === 'REJECTED'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      )}
                    >
                      {approving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
                      ) : (
                        <><ShieldCheck className="h-4 w-4 mr-2" /> Submit Review</>
                      )}
                    </Button>
                    {approvalState && !reviewDialog && (
                      <p className={`text-sm font-medium ${approvalState.toLowerCase().includes('error') || approvalState.toLowerCase().includes('unable') ? 'text-red-600' : 'text-indigo-700'}`}>
                        {approvalState}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Audit Timeline ─── */}
            {selectedShift?.shiftControlAudits?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-700">Audit Timeline</h2>
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                    {selectedShift.shiftControlAudits.length}
                  </span>
                </div>
                <div className="p-6">
                  <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
                    {selectedShift.shiftControlAudits.map((audit: any, i: number) => (
                      <div key={audit.id} className="relative">
                        {/* Timeline dot */}
                        <span className="absolute -left-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-white" />
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">
                              {audit.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(audit.createdAt), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Staff: <span className="font-mono">{audit.performedBy.substring(0, 8).toUpperCase()}</span>
                          </p>
                          {audit.fromStatus && audit.toStatus && (
                            <div className="flex items-center gap-2 mt-1">
                              <StatusChip status={audit.fromStatus} />
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <StatusChip status={audit.toStatus} />
                            </div>
                          )}
                          {audit.reason && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {audit.reason}
                            </Badge>
                          )}
                          {audit.metadata?.notes && (
                            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 italic">
                              "{audit.metadata.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Transaction Details ─── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-700">Transaction Details</h2>
                {transactions.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                    {transactions.length}
                  </span>
                )}
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <FileText className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600">No transactions found</p>
                  <p className="text-sm text-slate-400 mt-1">No payments or refunds for this shift/period.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        {['Time', 'Type', 'Method', 'Guest / Order', 'Receipt / Reference', 'Staff', 'Status', 'Amount'].map(
                          (h, i) => (
                            <th
                              key={i}
                              className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i === 7 ? 'text-right' : 'text-left'}`}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((t) => (
                        <tr key={`${t.type}-${t.id}`} className="hover:bg-slate-50/70 transition-colors">
                          {/* Time */}
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {format(new Date(t.date), 'HH:mm:ss')}
                          </td>
                          {/* Type */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                                t.type === 'PAYMENT' || t.type === 'POS PAYMENT'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : t.type === 'POS CASH MOVEMENT'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              {t.type === 'PAYMENT' || t.type === 'POS PAYMENT' ? (
                                <CreditCard className="h-3 w-3" />
                              ) : t.type === 'POS CASH MOVEMENT' ? (
                                <Banknote className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              {t.type}
                            </span>
                          </td>
                          {/* Method */}
                          <td className="px-5 py-3.5 text-slate-600 uppercase text-xs font-semibold tracking-wide">
                            {t.method || '—'}
                          </td>
                          {/* Guest / order */}
                          <td className="px-5 py-3.5 text-slate-700">
                            {t.orderNumber ? (
                              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                Order {t.orderNumber}
                              </span>
                            ) : t.guest?.firstName
                              ? `${t.guest.firstName} ${t.guest.lastName}`
                              : <span className="text-slate-400">—</span>}
                          </td>
                          {/* Receipt / reference */}
                          <td className="px-5 py-3.5">
                            {t.reference ? (
                              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md" title={t.reference}>
                                {t.reference.length > 18 ? `${t.reference.slice(0, 18)}…` : t.reference}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          {/* Staff */}
                          <td className="px-5 py-3.5">
                            {t.staffId ? (
                              <span className="font-mono text-xs text-slate-500" title={t.staffId}>
                                {t.staffId.slice(0, 8).toUpperCase()}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <StatusChip status={t.status} />
                          </td>
                          {/* Amount */}
                          <td className={`px-5 py-3.5 text-right font-bold tabular-nums ${t.amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {fmt(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={7} className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Net Total ({transactions.length} items)
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-slate-900 text-sm tabular-nums">
                          {fmt(transactions.reduce((s, t) => s + t.amount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ─── POS Receipt & Authorization Evidence ─── */}
            {((report?.items?.posReceiptAudits?.length ?? 0) > 0 || (report?.items?.posAuthorizationAudits?.length ?? 0) > 0) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">POS Audit Evidence</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Receipt printing and authorization activity attached to this shift.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        {['Time', 'Evidence', 'Reference', 'Device / Staff', 'Reason'].map((heading) => (
                          <th key={heading} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ...(report?.items?.posReceiptAudits || []).map((audit: any) => ({
                          id: `receipt-${audit.id}`,
                          date: audit.createdAt,
                          evidence: `Receipt ${String(audit.type).replaceAll('_', ' ')}`,
                          reference: audit.operationId || audit.orderId || audit.id,
                          deviceStaff: `${audit.deviceId || '—'} / ${audit.userId || '—'}`,
                          reason: audit.reason || `Print count: ${audit.printCount ?? 1}`,
                        })),
                        ...(report?.items?.posAuthorizationAudits || []).map((audit: any) => ({
                          id: `authorization-${audit.id}`,
                          date: audit.createdAt,
                          evidence: `Authorization ${audit.action}`,
                          reference: audit.operationId || audit.id,
                          deviceStaff: `${audit.deviceId || '—'} / ${audit.authorizedBy || audit.requestedBy || '—'}`,
                          reason: audit.reason || '—',
                        })),
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((evidence) => (
                        <tr key={evidence.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">{format(new Date(evidence.date), 'dd MMM yyyy HH:mm:ss')}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-700">{evidence.evidence}</td>
                          <td className="px-5 py-3.5"><span className="font-mono text-xs text-slate-500" title={evidence.reference}>{evidence.reference.slice(0, 18)}{evidence.reference.length > 18 ? '…' : ''}</span></td>
                          <td className="px-5 py-3.5"><span className="font-mono text-xs text-slate-500" title={evidence.deviceStaff}>{evidence.deviceStaff.slice(0, 24)}{evidence.deviceStaff.length > 24 ? '…' : ''}</span></td>
                          <td className="px-5 py-3.5 text-slate-600">{evidence.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Review Result Dialog ─── */}
      <Dialog
        open={reviewDialog !== null}
        onOpenChange={(open) => !open && !approving && setReviewDialog(null)}
      >
        <DialogContent className="rounded-2xl">
          {reviewDialog === 'success' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Review Completed
                </DialogTitle>
                <DialogDescription className="pt-1">
                  {approvalState} The shift is now available for the next handover step.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  onClick={() => { setReviewDialog(null); router.refresh(); }}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <XCircle className="h-5 w-5 text-red-600" /> Review Could Not Be Completed
                </DialogTitle>
                <DialogDescription className="pt-1">{approvalState}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setReviewDialog(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
