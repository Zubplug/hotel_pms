'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FileText,
  CreditCard,
  XCircle,
  RotateCcw,
  History,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { cn } from '@/lib/utils';

const fmt = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN:                'bg-blue-50 text-blue-700 border-blue-200',
    CLOSED:              'bg-slate-100 text-slate-600 border-slate-200',
    SUBMITTED:           'bg-amber-50 text-amber-700 border-amber-200',
    UNDER_REVIEW:        'bg-violet-50 text-violet-700 border-violet-200',
    APPROVED:            'bg-emerald-50 text-emerald-700 border-emerald-200',
    APPROVED_WITH_VARIANCE: 'bg-amber-50 text-amber-700 border-amber-200',
    REJECTED:            'bg-red-50 text-red-700 border-red-200',
    PENDING_HANDOVER:    'bg-orange-50 text-orange-700 border-orange-200',
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
  const [shiftId, setShiftId] = useState<string | null>(null);

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

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['shiftReport', propertyId, date, userId, shiftId],
    queryFn: fetchShiftReport,
    enabled: !!propertyId,
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

  const approveShift = async () => {
    if (!selectedShift || !shiftId) return;
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Hero Header ─── */}
      <div className="bg-gradient-to-r from-[#0b1120] via-[#0e1829] to-[#0b1120] px-8 py-7 print:hidden">
        <div className="max-w-[800px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">
              Financial Reports
            </p>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Shift Report &amp; Review
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Financial investigation workspace for shift reconciliation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedShift && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/night-audit/shift-reviews')}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white mr-2"
              >
                <ArrowRight className="h-4 w-4 mr-1.5 rotate-180" /> Back to List
              </Button>
            )}
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
              disabled={!report?.shifts?.length}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:opacity-40"
            >
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-7 space-y-6">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 rounded-full border-[3px] border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-slate-400">Loading shift data…</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl p-5">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Error loading report</p>
              <p className="text-sm text-red-600 mt-0.5">{(error as Error).message}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* ─── Submitted Shifts List ─── */}
            {!selectedShift && report?.shifts && report.shifts.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="bg-slate-50/60 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-700">Submitted Shifts ({report.shifts.length})</h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        {['Date', 'Type', 'Cashier', 'Status', 'Expected', 'Declared', 'Variance', ''].map((h, i) => (
                          <th key={i} className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i >= 4 && i <= 6 ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.shifts.map((shift: any) => {
                        const variance = (Number(shift.declaredCash ?? 0)) - (Number(shift.expectedCash ?? 0));
                        return (
                          <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3.5 text-slate-700 whitespace-nowrap">{format(new Date(shift.openedAt), 'dd MMM yyyy, HH:mm')}</td>
                            <td className="px-5 py-3.5 font-medium text-slate-700">{shift.type}</td>
                            <td className="px-5 py-3.5 text-slate-700">{shift.operator ? `${shift.operator.firstName} ${shift.operator.lastName}` : 'Unknown'}</td>
                            <td className="px-5 py-3.5"><StatusChip status={shift.controlStatus || shift.status} /></td>
                            <td className="px-5 py-3.5 text-right font-medium text-slate-700">{fmt(Number(shift.expectedCash ?? 0))}</td>
                            <td className="px-5 py-3.5 text-right font-medium text-slate-700">{shift.declaredCash != null ? fmt(Number(shift.declaredCash)) : '—'}</td>
                            <td className={`px-5 py-3.5 text-right font-bold tabular-nums ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {fmt(variance)}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Button size="sm" variant="outline" className="text-xs h-7 border-slate-200" onClick={() => router.push(`/night-audit/shift-reviews?shiftId=${shift.id}`)}>
                                Review
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {!selectedShift && (!report?.shifts || report.shifts.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm text-center px-6 mb-6">
                <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No shifts to review</p>
                <p className="text-sm text-slate-400 mt-1">There are no submitted shifts for the selected date.</p>
              </div>
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
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Investigation Notes{decision !== 'APPROVED' ? ' (Required)' : ''}
                    </label>
                    <Input
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Details of investigation or reason for decision…"
                      className="bg-white border-slate-200 rounded-xl"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={approveShift}
                      disabled={approving}
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
            {selectedShift && (
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
            )}

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
