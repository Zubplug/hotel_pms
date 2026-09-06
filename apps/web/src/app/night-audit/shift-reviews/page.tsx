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
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden bg-slate-950 px-8 py-10 print:hidden">
        {/* Animated Background Glows */}
        <div className="absolute top-0 left-1/4 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 translate-y-1/2 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 max-w-[800px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300 backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5" />
              Financial Reports
            </div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-slate-400 tracking-tight">
              Shift Report &amp; Review
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Advanced financial investigation workspace for shift reconciliation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedShift && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/night-audit/shift-reviews')}
                className="rounded-xl border-white/10 bg-white/5 text-white backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
              >
                <ArrowRight className="h-4 w-4 mr-1.5 rotate-180" /> Back to List
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl border-white/10 bg-white/5 text-white backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
            >
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportReport}
              disabled={!report?.shifts?.length}
              className="rounded-xl border-indigo-500/30 bg-indigo-600 text-white backdrop-blur-md hover:bg-indigo-500 hover:border-indigo-400 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-40"
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
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">Submitted Shifts</h2>
                  </div>
                  <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 font-semibold shadow-sm rounded-lg px-2.5 py-0.5">
                    {report.shifts.length} total
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.shifts.map((shift: any) => {
                    const variance = shift.declaredCash != null ? (Number(shift.declaredCash)) - (Number(shift.expectedCash ?? 0)) : null;
                    const isBalanced = variance === 0;
                    const isPending = variance === null;
                    
                    return (
                      <div key={shift.id} className="group relative bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                        {/* Decorative top border glow based on variance */}
                        <div className={`absolute top-0 left-0 w-full h-1 rounded-t-2xl opacity-40 transition-opacity group-hover:opacity-100 ${isPending ? 'bg-gradient-to-r from-slate-300 to-slate-400' : isBalanced ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-rose-500'}`} />
                        
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-slate-800 text-base">{shift.type.replace(/_/g, ' ')}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <User className="h-3.5 w-3.5 text-slate-400" /> {shift.operator ? `${shift.operator.firstName} ${shift.operator.lastName}` : 'Unknown Cashier'}
                            </p>
                          </div>
                          <StatusChip status={shift.controlStatus || shift.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-5 mt-auto">
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected</p>
                            <p className="text-sm font-semibold text-slate-700">{fmt(Number(shift.expectedCash ?? 0))}</p>
                          </div>
                          <div className={`rounded-xl p-3 border transition-colors ${isPending ? 'bg-slate-50/50 border-slate-100 group-hover:bg-slate-50' : isBalanced ? 'bg-emerald-50/50 border-emerald-100 group-hover:bg-emerald-50' : 'bg-rose-50/50 border-rose-100 group-hover:bg-rose-50'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isPending ? 'text-slate-500/70' : isBalanced ? 'text-emerald-600/70' : 'text-rose-600/70'}`}>Variance</p>
                            <p className={`text-sm font-bold ${isPending ? 'text-slate-600' : isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {isPending ? 'Pending' : fmt(variance)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(shift.openedAt), 'dd MMM yyyy, HH:mm')}
                          </span>
                          <Button size="sm" className="rounded-xl bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 transition-all h-8 text-xs px-4" onClick={() => {
                            setShiftId(shift.id);
                            router.push(`/night-audit/shift-reviews?shiftId=${shift.id}`, { scroll: false });
                          }}>
                            Review Shift
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mb-8 relative">
                {/* Subtle gradient background inside the card */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 pointer-events-none" />
                
                {/* Panel header */}
                <div className="relative border-b border-slate-100 px-8 py-5 flex items-center justify-between bg-white/40 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800 tracking-tight">Payment Handover &amp; Reconciliation</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Shift reference: {selectedShift.shiftReference || selectedShift.id?.slice(0, 12).toUpperCase()}</p>
                    </div>
                  </div>
                  <StatusChip status={selectedShift.controlStatus || selectedShift.status} />
                </div>

                <div className="relative p-8">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    {/* Type / location */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type / Location</p>
                      <p className="text-sm font-bold text-slate-800">
                        {selectedShift.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {selectedShift.outlet?.name || selectedShift.till?.name || 'Main Till'}
                      </p>
                    </div>

                    {/* Cashier */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cashier</p>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {selectedShift.operator
                            ? `${selectedShift.operator.firstName?.[0] ?? ''}${selectedShift.operator.lastName?.[0] ?? ''}`
                            : '?'}
                        </div>
                        <p className="text-sm font-bold text-slate-800">
                          {selectedShift.operator
                            ? `${selectedShift.operator.firstName} ${selectedShift.operator.lastName}`
                            : 'Unknown Cashier'}
                        </p>
                      </div>
                    </div>

                    {/* Opened */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opened At</p>
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {format(new Date(selectedShift.openedAt), 'dd MMM yyyy')}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {format(new Date(selectedShift.openedAt), 'HH:mm')}
                      </p>
                    </div>

                    {/* Closed */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closed At</p>
                      {selectedShift.closedAt ? (
                        <>
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-slate-400" />
                            {format(new Date(selectedShift.closedAt), 'dd MMM yyyy')}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">
                            {format(new Date(selectedShift.closedAt), 'HH:mm')}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-slate-400 italic">Still Open</p>
                      )}
                    </div>
                  </div>

                  {/* Financial Bento Box */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Opening Float', value: fmt(Number(selectedShift.openingFloat ?? 0)), icon: Banknote, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200/60' },
                      { label: 'Expected Cash', value: fmt(Number(selectedShift.expectedCash ?? 0)), icon: TrendingUp, color: 'text-indigo-700', sub: 'Physical cash only', bg: 'bg-indigo-50/50 border-indigo-100' },
                      { label: 'Declared Cash', value: selectedShift.declaredCash == null ? 'Not declared' : fmt(Number(selectedShift.declaredCash)), icon: ShieldCheck, color: 'text-slate-800', bg: 'bg-white border-slate-200/80 shadow-sm' },
                      {
                        label: 'Variance',
                        value: fmt(Math.abs(shiftVariance)),
                        icon: shiftVariance === 0 ? CheckCircle2 : shiftVariance > 0 ? TrendingUp : TrendingDown,
                        color: shiftVariance < 0 ? 'text-rose-600' : shiftVariance > 0 ? 'text-amber-600' : 'text-emerald-600',
                        bg: shiftVariance < 0 ? 'bg-rose-50/80 border-rose-200 ring-1 ring-rose-500/20' : shiftVariance > 0 ? 'bg-amber-50/80 border-amber-200 ring-1 ring-amber-500/20' : 'bg-emerald-50/80 border-emerald-200 ring-1 ring-emerald-500/20',
                        sub: shiftVariance === 0 ? 'Perfectly balanced' : shiftVariance > 0 ? 'Overage detected' : 'Shortage detected'
                      },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} className={`p-5 rounded-2xl border ${stat.bg} flex flex-col justify-between`}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-white/60 shadow-sm">
                              <Icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                          </div>
                          <div>
                            <p className={`text-xl font-black tracking-tight ${stat.color}`}>
                              {stat.label === 'Variance' && shiftVariance < 0 ? '-' : ''}{stat.value}
                            </p>
                            {stat.sub && <p className="text-[10px] font-medium text-slate-500 mt-1">{stat.sub}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="relative border-t border-slate-100 bg-slate-50/50 px-8 py-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Receipts to hand over</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Completed collections grouped by payment method.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Total Receipts</span>
                      <span className="text-sm font-bold text-slate-700">
                        {fmt(Object.values(selectedShift.paymentTotals ?? {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(selectedShift.paymentTotals ?? {}).map(([method, amount]: [string, any]) => (
                      <div key={method} className="flex items-center gap-4 rounded-xl border border-slate-200/60 bg-white px-5 py-3 shadow-sm flex-1 min-w-[200px]">
                        <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <CreditCard className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{method.replace(/_/g, ' ')}</p>
                          <p className="text-base font-black text-slate-800">{fmt(Number(amount || 0))}</p>
                        </div>
                      </div>
                    ))}
                    {Object.keys(selectedShift.paymentTotals ?? {}).length === 0 && (
                      <p className="text-sm text-slate-400 italic">No completed payment receipts recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── General Cashier Review Panel ─── */}
            {needsApproval && (
              <div className="bg-white rounded-3xl border border-indigo-200/60 shadow-lg shadow-indigo-500/5 overflow-hidden mb-8">
                <div className="bg-indigo-50/80 backdrop-blur-sm border-b border-indigo-100/80 px-8 py-5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-indigo-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-indigo-900">General Cashier Review</h2>
                    <p className="text-xs font-medium text-indigo-600/80 mt-0.5">Please record your official review decision.</p>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    Action required
                  </span>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <label className="block text-sm font-bold text-slate-800">
                        Review decision
                      </label>
                      <span className={`inline-flex items-center rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${shiftVariance === 0 ? 'bg-emerald-100/50 text-emerald-700 border border-emerald-200' : 'bg-rose-100/50 text-rose-700 border border-rose-200'}`}>
                        {shiftVariance === 0 ? 'Perfectly Balanced' : 'Variance Detected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="group" aria-label="Review decision">
                      {[
                        {
                          value: 'APPROVED',
                          title: 'Approve',
                          description: 'Balanced shift with no variance.',
                          icon: CheckCircle2,
                          disabled: shiftVariance !== 0,
                          selected: 'border-emerald-400 bg-emerald-50/40 ring-4 ring-emerald-500/20 shadow-md transform scale-[1.02]',
                          iconColor: 'text-emerald-500 bg-emerald-100/50',
                        },
                        {
                          value: 'APPROVED_WITH_VARIANCE',
                          title: 'Approve with variance',
                          description: 'Accept and document a shortage or overage.',
                          icon: AlertTriangle,
                          disabled: shiftVariance === 0,
                          selected: 'border-amber-400 bg-amber-50/40 ring-4 ring-amber-500/20 shadow-md transform scale-[1.02]',
                          iconColor: 'text-amber-500 bg-amber-100/50',
                        },
                        {
                          value: 'CASHLESS_ACKNOWLEDGED',
                          title: 'Acknowledge non-cash',
                          description: 'Physical documents received (no cash).',
                          icon: CheckCircle2,
                          disabled: (selectedShift?.expectedCash != null ? Number(selectedShift.expectedCash) : 0) !== 0 || shiftVariance !== 0,
                          selected: 'border-blue-400 bg-blue-50/40 ring-4 ring-blue-500/20 shadow-md transform scale-[1.02]',
                          iconColor: 'text-blue-500 bg-blue-100/50',
                        },
                        {
                          value: 'REJECTED',
                          title: 'Return for correction',
                          description: 'Send the shift back to the operator.',
                          icon: RotateCcw,
                          disabled: false,
                          selected: 'border-rose-400 bg-rose-50/40 ring-4 ring-rose-500/20 shadow-md transform scale-[1.02]',
                          iconColor: 'text-rose-500 bg-rose-100/50',
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
                              'group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                              isSelected ? option.selected : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5',
                              option.disabled && 'cursor-not-allowed opacity-40 hover:border-slate-200 hover:shadow-none hover:translate-y-0 hover:bg-slate-50/50'
                            )}
                          >
                            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors', isSelected ? option.iconColor : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500')}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-slate-800">{option.title}</span>
                              <span className="mt-0.5 block text-xs font-medium text-slate-500">{option.description}</span>
                              {option.disabled && (
                                <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {shiftVariance === 0 ? 'Requires variance' : 'Disabled (Variance exists)'}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <div className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                            )}
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
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-200/20 overflow-hidden mb-8">
                <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 px-8 py-5 flex items-center gap-3">
                  <div className="p-2 bg-slate-200/50 text-slate-600 rounded-xl">
                    <History className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Audit Timeline</h2>
                  <span className="ml-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-slate-200/80 text-slate-700 text-xs font-bold border border-slate-300/50">
                    {selectedShift.shiftControlAudits.length}
                  </span>
                </div>
                <div className="p-8">
                  <div className="relative pl-8 border-l-[3px] border-slate-100 space-y-8">
                    {selectedShift.shiftControlAudits.map((audit: any, i: number) => (
                      <div key={audit.id} className="relative group">
                        {/* Timeline dot */}
                        <div className="absolute -left-[41px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-4 ring-slate-100 group-hover:ring-indigo-100 transition-all">
                          <div className="h-2 w-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform" />
                        </div>
                        <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                              {audit.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[11px] font-bold tracking-wider text-slate-400 flex items-center gap-1.5 uppercase">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(audit.createdAt), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm mb-3">
                            <div className="flex items-center gap-1.5 text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
                              <User className="h-4 w-4 text-slate-400" />
                              <span className="font-semibold text-xs tracking-wider uppercase">{audit.performedBy.substring(0, 8)}</span>
                            </div>
                            
                            {audit.fromStatus && audit.toStatus && (
                              <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
                                <StatusChip status={audit.fromStatus} />
                                <ArrowRight className="h-4 w-4 text-slate-300" />
                                <StatusChip status={audit.toStatus} />
                              </div>
                            )}
                          </div>

                          {audit.reason && (
                            <div className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              {audit.reason}
                            </div>
                          )}
                          {audit.metadata?.notes && (
                            <div className="mt-4 relative rounded-xl bg-white border border-slate-200/60 p-4 text-sm text-slate-600 shadow-sm">
                              <div className="absolute top-0 left-4 -translate-y-1/2 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</div>
                              <p className="italic">{audit.metadata.notes}</p>
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
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-200/20 overflow-hidden mb-8">
              <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-200/50 text-slate-600 rounded-xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight">Transaction Details</h2>
                  </div>
                </div>
                {transactions.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shadow-sm">
                    {transactions.length} items
                  </span>
                )}
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                    <FileText className="h-10 w-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-700">No transactions found</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">No payments or refunds were recorded during this shift.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        {['Time', 'Type', 'Method', 'Guest / Order', 'Reference', 'Staff', 'Status', 'Amount'].map(
                          (h, i) => (
                            <th
                              key={i}
                              className={`px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i === 7 ? 'text-right' : 'text-left'}`}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {transactions.map((t, index) => (
                        <tr key={`${t.type}-${t.id}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50 transition-colors`}>
                          <td className="px-6 py-4 font-mono text-xs text-slate-400 whitespace-nowrap font-medium">
                            {format(new Date(t.date), 'HH:mm:ss')}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold border shadow-sm ${
                                t.type === 'PAYMENT' || t.type === 'POS PAYMENT'
                                  ? 'bg-blue-50/80 text-blue-700 border-blue-200/60'
                                  : t.type === 'POS CASH MOVEMENT'
                                    ? 'bg-amber-50/80 text-amber-700 border-amber-200/60'
                                    : 'bg-rose-50/80 text-rose-700 border-rose-200/60'
                              }`}
                            >
                              {t.type === 'PAYMENT' || t.type === 'POS PAYMENT' ? (
                                <CreditCard className="h-3.5 w-3.5" />
                              ) : t.type === 'POS CASH MOVEMENT' ? (
                                <Banknote className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {t.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-xs font-bold tracking-wider uppercase">
                            {t.method || '—'}
                          </td>
                          <td className="px-6 py-4">
                            {t.orderNumber ? (
                              <span className="font-mono text-xs font-semibold bg-slate-100/80 text-slate-600 border border-slate-200/60 px-2.5 py-1 rounded-lg shadow-sm">
                                Order {t.orderNumber}
                              </span>
                            ) : t.guest?.firstName
                              ? <span className="font-semibold text-slate-700">{`${t.guest.firstName} ${t.guest.lastName}`}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            {t.reference ? (
                              <span className="font-mono text-[11px] font-semibold bg-slate-100/80 text-slate-500 border border-slate-200/60 px-2 py-1 rounded-lg shadow-sm" title={t.reference}>
                                {t.reference.length > 18 ? `${t.reference.slice(0, 18)}…` : t.reference}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            {t.staffId ? (
                              <span className="font-mono text-[11px] font-bold tracking-widest text-slate-400" title={t.staffId}>
                                {t.staffId.slice(0, 8).toUpperCase()}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            <StatusChip status={t.status} />
                          </td>
                          <td className={`px-6 py-4 text-right font-black tabular-nums tracking-tight ${t.amount < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {fmt(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t-2 border-slate-100">
                      <tr>
                        <td colSpan={7} className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                          Net Total
                        </td>
                        <td className="px-6 py-5 text-right font-black text-slate-900 text-base tabular-nums bg-white shadow-sm border-l border-slate-100">
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
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-200/20 overflow-hidden mb-8">
                <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 px-8 py-5 flex items-center gap-3">
                  <div className="p-2 bg-slate-200/50 text-slate-600 rounded-xl">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight">POS Audit Evidence</h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Receipt printing and authorization activity attached to this shift.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        {['Time', 'Evidence', 'Reference', 'Device / Staff', 'Reason'].map((heading) => (
                          <th key={heading} className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-left">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
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
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((evidence, index) => (
                        <tr key={evidence.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50 transition-colors`}>
                          <td className="px-6 py-4 font-mono text-[11px] font-medium text-slate-400 whitespace-nowrap">
                            {format(new Date(evidence.date), 'dd MMM yyyy HH:mm:ss')}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{evidence.evidence}</td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-[11px] font-semibold bg-slate-100/80 text-slate-500 border border-slate-200/60 px-2 py-1 rounded-lg shadow-sm" title={evidence.reference}>
                              {evidence.reference.slice(0, 18)}{evidence.reference.length > 18 ? '…' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase" title={evidence.deviceStaff}>
                              {evidence.deviceStaff.slice(0, 24)}{evidence.deviceStaff.length > 24 ? '…' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-sm font-medium">{evidence.reason}</td>
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
