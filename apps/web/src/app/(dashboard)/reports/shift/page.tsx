'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Loader2, Download, Printer } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';

export default function ShiftReportPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState<string>('ALL');
  const [shiftId, setShiftId] = useState<string | null>(null);
  
  // Review Form State
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
  const needsApproval = selectedShift && (
    selectedShift.type === 'FRONT_DESK' 
      ? ['SUBMITTED', 'UNDER_REVIEW', 'CLOSED'].includes(selectedShift.controlStatus || selectedShift.status)
      : ['SUBMITTED', 'UNDER_REVIEW'].includes(selectedShift.controlStatus) || selectedShift.settlementStatus === 'PENDING_HANDOVER'
  );

  const approveShift = async () => {
    if (!selectedShift || !shiftId) return;
    setApproving(true);
    setApprovalState('');
    try {
      const response = await fetch(`/api/v1/reports/shift/${encodeURIComponent(shiftId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: approvalNotes, reasonCode: decision === 'APPROVED_WITH_VARIANCE' ? reasonCode : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to approve shift');
      setApprovalState(decision === 'REJECTED' ? 'Shift returned for correction.' : 'Shift successfully approved.');
      setReviewDialog('success');
    } catch (approvalError) {
      setApprovalState(approvalError instanceof Error ? approvalError.message : 'Unable to process review');
      setReviewDialog('error');
    } finally {
      setApproving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const printReport = () => window.print();
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
    const csv = [['Type', 'Shift', 'Status', 'Operator', 'Expected Cash', 'Declared Cash', 'Variance'], ...rows]
      .map(row => row.map((value: any) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `shift-report-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Transactions ---
  const transactions: any[] = [];
  if (report?.items) {
    report.items.payments.forEach((p: any) => transactions.push({
      id: p.id, type: 'PAYMENT', date: p.createdAt, method: p.method,
      amount: Number(p.amount), guest: p.folio?.reservation?.primaryGuest,
      reservationId: p.folio?.reservation?.id, staffId: p.receivedBy, status: p.status,
    }));
    report.items.refunds.forEach((r: any) => transactions.push({
      id: r.id, type: 'REFUND', date: r.createdAt, method: r.payment?.method,
      amount: -Number(r.amount), guest: r.payment?.folio?.reservation?.primaryGuest,
      reservationId: r.payment?.folio?.reservation?.id, staffId: r.authorizedBy, status: r.status,
    }));
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const shiftVariance = selectedShift ? (selectedShift.declaredCash != null ? selectedShift.declaredCash - selectedShift.expectedCash : 0) : 0;

  useEffect(() => {
    if (selectedShift) {
       if (shiftVariance === 0) setDecision('APPROVED');
       else setDecision('APPROVED_WITH_VARIANCE');
    }
  }, [selectedShift, shiftVariance]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shift Report & Review</h1>
          <p className="text-muted-foreground mt-1">Financial investigation workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={printReport}><Printer className="w-4 h-4 mr-2" /> Print</Button>
          <Button variant="outline" onClick={exportReport} disabled={!report?.shifts?.length}><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 text-red-800 rounded-lg border border-red-200">
          Error loading report: {(error as Error).message}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          
          {/* Main Shift details */}
          {selectedShift && (
            <Card>
              <CardHeader><CardTitle>Cash Reconciliation</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Type / Location</p><p className="font-semibold">{selectedShift.type} · {selectedShift.outlet?.name || selectedShift.till?.name || 'Till'}</p></div>
                <div><p className="text-xs text-muted-foreground">Cashier</p><p className="font-semibold">{selectedShift.operator ? `${selectedShift.operator.firstName} ${selectedShift.operator.lastName}` : 'Unknown'}</p></div>
                <div><p className="text-xs text-muted-foreground">Control Status</p><p className="font-semibold">{selectedShift.controlStatus || selectedShift.status}</p></div>
                <div><p className="text-xs text-muted-foreground">Opened</p><p className="font-semibold">{format(new Date(selectedShift.openedAt), 'PPpp')}</p></div>
                
                <div><p className="text-xs text-muted-foreground">Opening Float</p><p className="font-semibold">{formatCurrency(selectedShift.openingFloat)}</p></div>
                <div><p className="text-xs text-muted-foreground">Expected Cash (Server Recalculated)</p><p className="font-semibold">{formatCurrency(selectedShift.expectedCash)}</p></div>
                <div><p className="text-xs text-muted-foreground">Declared Cash</p><p className="font-semibold">{selectedShift.declaredCash == null ? 'Not declared' : formatCurrency(selectedShift.declaredCash)}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground">Variance</p>
                  <p className={`font-semibold ${shiftVariance < 0 ? 'text-red-600' : shiftVariance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatCurrency(shiftVariance)} 
                    {shiftVariance !== 0 && (shiftVariance > 0 ? ' (OVER)' : ' (SHORT)')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Panel */}
          {needsApproval && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardHeader><CardTitle>General Cashier Review</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Decision</label>
                      <Select value={decision} onValueChange={(v) => setDecision(v || '')}>
                        <SelectTrigger className="mt-1 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPROVED" disabled={shiftVariance !== 0}>Approve (Balanced)</SelectItem>
                          <SelectItem value="APPROVED_WITH_VARIANCE" disabled={shiftVariance === 0}>Approve with Variance</SelectItem>
                          <SelectItem value="REJECTED">Return for Correction</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {decision === 'APPROVED_WITH_VARIANCE' && (
                      <div>
                        <label className="text-sm font-medium">Variance Reason Code</label>
                        <Select value={reasonCode} onValueChange={(v) => setReasonCode(v || '')}>
                          <SelectTrigger className="mt-1 bg-white">
                            <SelectValue placeholder="Select reason..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH_COUNTING_ERROR">Cash Counting Error</SelectItem>
                            <SelectItem value="MISSING_RECEIPT">Missing Receipt</SelectItem>
                            <SelectItem value="UNAUTHORIZED_PAYOUT">Unauthorized Payout</SelectItem>
                            <SelectItem value="REFUND_ERROR">Refund Error</SelectItem>
                            <SelectItem value="WRONG_CHANGE">Wrong Change Given</SelectItem>
                            <SelectItem value="CASH_DROP_ERROR">Cash Drop Error</SelectItem>
                            <SelectItem value="SYSTEM_ERROR">System Error</SelectItem>
                            <SelectItem value="UNKNOWN">Unknown</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Investigation Notes {decision !== 'APPROVED' ? '(Required)' : ''}</label>
                    <Input 
                      value={approvalNotes} 
                      onChange={e => setApprovalNotes(e.target.value)} 
                      placeholder="Details of investigation..." 
                      className="mt-1 bg-white"
                    />
                  </div>

                  <div>
                    <Button onClick={approveShift} disabled={approving}>
                      {approving ? 'Processing…' : 'Submit Review'}
                    </Button>
                    {approvalState && (
                      <p className={`mt-2 text-sm font-medium ${approvalState.includes('Unable') || approvalState.includes('Error') ? 'text-red-600' : 'text-indigo-700'}`}>
                        {approvalState}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Timeline Panel */}
          {selectedShift?.shiftControlAudits && selectedShift.shiftControlAudits.length > 0 && (
             <Card>
               <CardHeader><CardTitle>Audit Timeline</CardTitle></CardHeader>
               <CardContent>
                 <div className="relative border-l border-muted pl-4 ml-2 space-y-6">
                   {selectedShift.shiftControlAudits.map((audit: any) => (
                     <div key={audit.id} className="relative">
                       <span className="absolute -left-6 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                       <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-2">
                           <span className="text-sm font-semibold">{audit.action.replace(/_/g, ' ')}</span>
                           <span className="text-xs text-muted-foreground">{format(new Date(audit.createdAt), 'PPpp')}</span>
                         </div>
                         <p className="text-sm text-muted-foreground">
                           By Staff ID: {audit.performedBy.substring(0, 8)}
                         </p>
                         {audit.fromStatus && audit.toStatus && (
                            <p className="text-xs font-mono text-muted-foreground mt-1">
                              {audit.fromStatus} &rarr; {audit.toStatus}
                            </p>
                         )}
                         {audit.reason && (
                           <Badge variant="outline" className="mt-1 w-max">{audit.reason}</Badge>
                         )}
                         {audit.metadata?.notes && (
                           <div className="mt-2 text-sm bg-muted p-2 rounded-md italic">"{audit.metadata.notes}"</div>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
          )}

          {/* Transaction List */}
          <Card>
            <CardHeader><CardTitle>Transaction Details</CardTitle></CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-center p-6">No transactions found for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Reservation</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={`${t.type}-${t.id}`}>
                        <TableCell className="whitespace-nowrap">{format(new Date(t.date), 'HH:mm:ss')}</TableCell>
                        <TableCell>
                          <Badge variant={t.type === 'PAYMENT' ? 'default' : 'destructive'} className="text-xs">
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{t.method}</TableCell>
                        <TableCell>{t.guest?.firstName} {t.guest?.lastName}</TableCell>
                        <TableCell className="font-mono text-xs">{t.reservationId?.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground" title={t.staffId}>
                          {t.staffId?.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.status}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${t.amount < 0 ? 'text-red-600' : ''}`}>
                          {formatCurrency(t.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog open={reviewDialog !== null} onOpenChange={open => !open && !approving && setReviewDialog(null)}>
        <DialogContent>
          {reviewDialog === 'success' ? <><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Review completed</DialogTitle><DialogDescription>{approvalState} The shift is now available for the next handover step.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => { setReviewDialog(null); router.refresh(); }}>Continue</Button></DialogFooter></> : <><DialogHeader><DialogTitle>Review could not be completed</DialogTitle><DialogDescription>{approvalState}</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setReviewDialog(null)}>Close</Button></DialogFooter></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
