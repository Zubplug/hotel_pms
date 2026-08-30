"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

export type ResolutionAction = 
  | { type: 'ARRIVALS'; item: any }
  | { type: 'DEPARTURES'; item: any }
  | { type: 'ROOM_DISCREPANCY'; item: any }
  | { type: 'POS_SESSION'; item: any }
  | { type: 'FRONTDESK_SHIFT'; item: any }
  | { type: 'FOLIO_PREVIEW'; item: any }
  | { type: 'SYNC_CONFLICT'; item: any }
  | null;

interface Props {
  action: ResolutionAction;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResolutionManager({ action, onClose, onSuccess }: Props) {
  if (!action) return null;

  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={action?.type === 'FOLIO_PREVIEW' ? "sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none" : "sm:max-w-[500px]"}>
        {action.type === 'ARRIVALS' && <ArrivalResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'DEPARTURES' && <DepartureResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'ROOM_DISCREPANCY' && <RoomDiscrepancyResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'POS_SESSION' && <PosSessionResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'FRONTDESK_SHIFT' && <FrontdeskShiftResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'FOLIO_PREVIEW' && <FolioPreview item={action.item} onClose={onClose} />}
        {action.type === 'SYNC_CONFLICT' && <FinancialSyncResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

// Sub-components

function ArrivalResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'no-show' | 'cancel') => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: '{}'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `Failed to mark as ${action}`);
      }
      toast.success(`Reservation marked as ${action}`);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleLateArrival = async () => {
    setLoading('late');
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/late-arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: '{}'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to mark late arrival');
      }
      toast.success('Reservation marked for late arrival');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const totalBalance = item.folios?.reduce((acc: number, f: any) => acc + Number(f.balance), 0) || 0;
  const isPaid = totalBalance < 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Resolve Pending Arrival</DialogTitle>
        <DialogDescription>
          {item.primaryGuest?.firstName} {item.primaryGuest?.lastName} (Conf: {item.confirmationNumber})
          <div className="mt-2 text-sm">
            {isPaid ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                <CheckCircle2 className="h-4 w-4" /> Pre-paid/Deposit: {Math.abs(totalBalance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                <AlertTriangle className="h-4 w-4" /> No prepayment on file
              </span>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>
      
      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">{error}</div>}
      
      <div className="grid gap-3 py-4">
        <Button variant="outline" className="justify-between" onClick={() => handleAction('no-show')} disabled={!!loading}>
          <span>Mark as No-Show</span>
          {loading === 'no-show' && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
        <Button variant="outline" className="justify-between" onClick={() => handleAction('cancel')} disabled={!!loading}>
          <span>Cancel Reservation</span>
          {loading === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
        <Button variant="outline" className="justify-between" onClick={handleLateArrival} disabled={!!loading}>
          <span>Mark as Late Arrival</span>
          {loading === 'late' && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={!!loading}>Cancel</Button>
      </DialogFooter>
    </>
  );
}

function DepartureResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipperConfirm, setShowSkipperConfirm] = useState(false);
  const [showRetainConfirm, setShowRetainConfirm] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [skipperReason, setSkipperReason] = useState('');
  const [retainReasonCode, setRetainReasonCode] = useState('EARLY_DEPARTURE');
  const [retainNotes, setRetainNotes] = useState('');
  const [refundReason, setRefundReason] = useState('Refund unavailable during Night Audit');

  const balance = item.folios?.reduce((acc: number, f: any) => acc + Number(f.balance || 0), 0) || 0;
  const hasBalance = balance !== 0;
  const isSkipper = balance > 0;
  const isCredit = balance < 0;

  const handleCheckout = async () => {
    setLoading('checkout');
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: '{}'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to check out');
      }
      toast.success('Successfully checked out');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleSkipper = async () => {
    if (!skipperReason.trim()) {
      setError('A reason is required to transfer to City Ledger.');
      return;
    }
    setLoading('skipper');
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/skipper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: skipperReason })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to process skipper checkout');
      }
      toast.success('Successfully transferred to City Ledger and checked out');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleRetainCredit = async () => {
    if (!retainNotes.trim()) {
      setError('A reason is required to retain the credit balance.');
      return;
    }
    setLoading('retain');
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/retain-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reasonCode: retainReasonCode, reason: retainNotes })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to process retention checkout');
      }
      toast.success('Successfully retained credit and checked out');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleTransferRefund = async () => {
    if (!refundReason.trim()) {
      setError('A reason is required to transfer the refund liability.');
      return;
    }
    setLoading('transfer-refund');
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/transfer-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: refundReason })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to transfer refund liability');
      }
      toast.success('Successfully transferred to Refund Payable and checked out');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleExtend = async () => {
    // A simplified extend - add 1 night
    setLoading('extend');
    setError(null);
    try {
      const d = new Date(item.checkOut);
      d.setDate(d.getDate() + 1);
      const res = await fetch(`/api/v1/reservations/${item.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ newCheckoutDate: d.toISOString().split('T')[0], idempotencyKey: crypto.randomUUID() })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to extend stay');
      }
      toast.success('Successfully extended stay by 1 night');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Resolve Pending Departure</DialogTitle>
        <DialogDescription>
          {item.primaryGuest?.firstName} {item.primaryGuest?.lastName} (Conf: {item.confirmationNumber})
        </DialogDescription>
      </DialogHeader>

      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">{error}</div>}

      {showSkipperConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-3">
            <h4 className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Transfer Balance & Force Check-Out
            </h4>
            <p>This guest has an outstanding balance of <strong>{balance.toFixed(2)}</strong>.</p>
            <p>The balance will be transferred to the <strong>City Ledger / Accounts Receivable</strong> and the reservation will be checked out.</p>
            <p className="font-medium">The guest will still owe this amount to the hotel.</p>
            <div className="space-y-1.5 pt-2 border-t border-amber-200/50">
              <label className="text-xs font-semibold">Reason (Required)</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-amber-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 outline-none" 
                placeholder="Guest left without settling balance..."
                value={skipperReason}
                onChange={e => setSkipperReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowSkipperConfirm(false)} disabled={!!loading}>Cancel</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleSkipper} disabled={!!loading || !skipperReason.trim()}>
              {loading === 'skipper' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer & Check-Out
            </Button>
          </div>
        </div>
      ) : showRetainConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 space-y-3">
            <h4 className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-emerald-600" /> Retain {Math.abs(balance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} and Check Out?
            </h4>
            <p>This will apply an approved early-departure/retention charge of <strong>{Math.abs(balance).toFixed(2)}</strong>.</p>
            <p>The guest will no longer have a credit balance.</p>
            <div className="space-y-1.5 pt-2 border-t">
              <label className="text-xs font-semibold">Retention Code (Required)</label>
              <select className="w-full px-3 py-2 border rounded-md bg-white text-sm outline-none" value={retainReasonCode} onChange={e => setRetainReasonCode(e.target.value)}>
                <option value="EARLY_DEPARTURE">Early departure penalty</option>
                <option value="DEPOSIT_FORFEITURE">Deposit forfeiture</option>
                <option value="NO_SHOW">Cancellation/no-show penalty</option>
                <option value="OTHER">Other approved retention reason</option>
              </select>
            </div>
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold">Notes (Required)</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded-md bg-white text-sm outline-none" 
                placeholder="Manager approved retention..."
                value={retainNotes}
                onChange={e => setRetainNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowRetainConfirm(false)} disabled={!!loading}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleRetainCredit} disabled={!!loading || !retainNotes.trim()}>
              {loading === 'retain' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Retain & Check-Out
            </Button>
          </div>
        </div>
      ) : showRefundConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-3">
            <h4 className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Transfer {Math.abs(balance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} to Pending Guest Refunds?
            </h4>
            <p>This will record <strong>{Math.abs(balance).toFixed(2)}</strong> as a liability owed by the hotel to the guest.</p>
            <p className="font-semibold text-rose-600">No money will be refunded now.</p>
            <p>Finance will process the actual refund transfer at a later date.</p>
            <div className="space-y-1.5 pt-2 border-t border-blue-200">
              <label className="text-xs font-semibold">Reason (Required)</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-blue-300 rounded-md bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowRefundConfirm(false)} disabled={!!loading}>Cancel</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleTransferRefund} disabled={!!loading || !refundReason.trim()}>
              {loading === 'transfer-refund' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer & Check-Out
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium">Outstanding Balance</span>
            <span className={`font-semibold ${isSkipper ? 'text-rose-600' : isCredit ? 'text-blue-600' : 'text-emerald-600'}`}>
              {balance.toFixed(2)}
            </span>
          </div>

          {!hasBalance ? (
            <Button className="w-full justify-between bg-indigo-600 hover:bg-indigo-700" onClick={handleCheckout} disabled={!!loading}>
              <span>Process Check-Out</span>
              {loading === 'checkout' && <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
          ) : isCredit ? (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 space-y-3">
              <p className="font-semibold">Credit Balance - Cannot Check Out</p>
              <p>This guest has an overpayment of <strong>{Math.abs(balance).toFixed(2)}</strong>. You must zero this balance before checking out.</p>
              <div className="grid gap-2 pt-2">
                <Button size="sm" variant="outline" className="w-full justify-between bg-white text-slate-700" onClick={() => window.open(`/reservations/${item.id}/folios`, '_blank')}>
                  <span>Go to Billing (Actual Refund)</span>
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-between border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800" onClick={() => setShowRetainConfirm(true)}>
                  <span>Retain Credit (Early Departure Fee)</span>
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-between border-blue-200 bg-blue-100 hover:bg-blue-200 text-blue-800" onClick={() => setShowRefundConfirm(true)}>
                  <span>Transfer to Pending Guest Refunds (Liability)</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700 space-y-3">
              <p className="font-semibold">Balance Due - Cannot Standard Check-Out</p>
              <p>This reservation has a non-zero folio balance. You can process payment in billing, or if the guest has left, transfer the debt to Accounts Receivable (City Ledger).</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="bg-white" onClick={() => window.open(`/reservations/${item.id}/folios`, '_blank')}>Go to Billing</Button>
                <Button size="sm" variant="secondary" className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200" onClick={() => setShowSkipperConfirm(true)}>
                  Transfer to City Ledger (Skipper)
                </Button>
              </div>
            </div>
          )}

          <div className="relative border-t mt-4 pt-4">
            <Button variant="outline" className="w-full justify-between" onClick={handleExtend} disabled={!!loading}>
              <span>Extend Stay (1 Night)</span>
              {loading === 'extend' && <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={!!loading}>Cancel</Button>
      </DialogFooter>
    </>
  );
}

function RoomDiscrepancyResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    setLoading(true);
    setError(null);
    try {
      // Reconcile HK status with PMS status. For a skip/sleep we usually force the HK status.
      // Expected comes from PMS.
      const res = await fetch(`/api/v1/housekeeping/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ 
          roomId: item.roomId, 
          action: 'RECONCILE', 
          pmsStatus: item.expected,
          targetStatus: item.expected === 'OCCUPIED' ? 'PENDING' : 'CLEAN' 
        })
      });
      if (!res.ok) {
        throw new Error('Failed to reconcile room status');
      }
      toast.success('Room status reconciled');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Room Discrepancy</DialogTitle>
        <DialogDescription>Room {item.roomNumber}</DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">{error}</div>}
      <div className="py-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-xl bg-slate-50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">PMS Status</p>
            <p className="font-semibold">{item.pmsStatus}</p>
            <p className="text-xs text-indigo-600 mt-1">Expected: {item.expected}</p>
          </div>
          <div className="p-4 border rounded-xl bg-amber-50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Housekeeping</p>
            <p className="font-semibold text-amber-700">{item.hkStatus}</p>
          </div>
        </div>
        <Button className="w-full" onClick={handleFix} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reconcile Status'}
        </Button>
      </div>
    </>
  );
}

function PosSessionResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declared, setDeclared] = useState('');
  const [reason, setReason] = useState('');
  
  // Fake expected for demo purposes; normally fetched from /api/v1/pos/sessions/[id]/summary
  const expected = 150000;
  const variance = Number(declared || 0) - expected;

  const handleClose = async () => {
    if (!reason && variance !== 0) {
      setError('A reason is required for non-zero variances.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/pos/sessions/${item.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ declaredAmount: Number(declared), reason })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to close POS session');
      }
      toast.success('POS session closed and reconciled');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Close POS Session</DialogTitle>
        <DialogDescription>
          {item.outlet?.name} - Opened by {item.openedBy}
        </DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">{error}</div>}
      <div className="py-4 space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
          <span className="text-sm font-medium">Expected Cash</span>
          <span className="font-semibold">{expected.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Actual Declared Cash</label>
          <input type="number" className="w-full border rounded-md px-3 py-2 text-sm" value={declared} onChange={e => setDeclared(e.target.value)} placeholder="0.00" />
        </div>
        {declared && (
          <div className={`flex items-center justify-between p-3 border rounded-lg ${variance === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            <span className="text-sm font-medium">Variance</span>
            <span className="font-semibold">{variance > 0 ? '+' : ''}{variance.toFixed(2)}</span>
          </div>
        )}
        {variance !== 0 && declared !== '' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Variance Reason (Required)</label>
            <input type="text" className="w-full border rounded-md px-3 py-2 text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the variance..." />
          </div>
        )}
        <Button className="w-full" onClick={handleClose} disabled={loading || declared === ''}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm & Close Session'}
        </Button>
      </div>
    </>
  );
}

function FrontdeskShiftResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declared, setDeclared] = useState('');
  const [reason, setReason] = useState('');
  
  // Fake expected for demo purposes
  const expected = 50000;
  const variance = Number(declared || 0) - expected;

  const handleClose = async () => {
    if (!reason && variance !== 0) {
      setError('A reason is required for non-zero variances.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/frontdesk/sessions/${item.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ declaredAmount: Number(declared), reason })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed to close shift');
      }
      toast.success('Front Desk shift closed');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Close Front Desk Shift</DialogTitle>
        <DialogDescription>Shift {item.shiftReference}</DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">{error}</div>}
      <div className="py-4 space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
          <span className="text-sm font-medium">Expected Cash Drawer</span>
          <span className="font-semibold">{expected.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Actual Declared Cash</label>
          <input type="number" className="w-full border rounded-md px-3 py-2 text-sm" value={declared} onChange={e => setDeclared(e.target.value)} placeholder="0.00" />
        </div>
        {declared && (
          <div className={`flex items-center justify-between p-3 border rounded-lg ${variance === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            <span className="text-sm font-medium">Variance</span>
            <span className="font-semibold">{variance > 0 ? '+' : ''}{variance.toFixed(2)}</span>
          </div>
        )}
        {variance !== 0 && declared !== '' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Variance Reason (Required)</label>
            <input type="text" className="w-full border rounded-md px-3 py-2 text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the variance..." />
          </div>
        )}
        <Button className="w-full" onClick={handleClose} disabled={loading || declared === ''}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm & Close Shift'}
        </Button>
      </div>
    </>
  );
}

function FinancialSyncResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (action: 'FORCE_EDGE_EVENT' | 'REJECT_EDGE_EVENT') => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/sync/conflicts/${item.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ action, resolutionComment: `Night Audit manual resolution: ${action}` })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.error?.message || 'Failed to resolve conflict');
      }
      toast.success('Sync conflict resolved');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Financial Sync Conflict</DialogTitle>
        <DialogDescription>A POS or remote device attempted to sync data that conflicts with the PMS.</DialogDescription>
      </DialogHeader>
      
      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">{error}</div>}
      
      <div className="py-4 space-y-4">
        <div className="p-4 border rounded-xl bg-slate-50 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium">{item.aggregateType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Event:</span>
            <span className="font-medium">{item.hotelEvent?.eventType || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Device:</span>
            <span className="font-medium">{item.hotelEvent?.deviceId || 'Unknown'}</span>
          </div>

          {item.hotelEvent?.payload && (
            <div className="pt-3 mt-3 border-t space-y-2">
              <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">Sync Payload Data</p>
              {item.hotelEvent.payload.amount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium font-mono text-indigo-700">
                    {Number(item.hotelEvent.payload.amount).toLocaleString('en-NG', { style: 'currency', currency: item.hotelEvent.payload.currency || 'NGN' })}
                  </span>
                </div>
              )}
              {item.hotelEvent.payload.description && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium">{item.hotelEvent.payload.description}</span>
                </div>
              )}
              {item.hotelEvent.payload.method && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium">{item.hotelEvent.payload.method}</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
            {item.errorDetails?.message || 'Version mismatch detected.'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="w-full whitespace-normal h-auto py-3 px-4 flex flex-col items-start gap-1"
            onClick={() => handleResolve('REJECT_EDGE_EVENT')} 
            disabled={!!loading}
          >
            <span className="font-semibold text-sm">Reject Event</span>
            <span className="text-xs text-muted-foreground text-left">Discard the POS change. The PMS state wins.</span>
            {loading === 'REJECT_EDGE_EVENT' && <Loader2 className="absolute right-4 h-4 w-4 animate-spin" />}
          </Button>

          <Button 
            className="w-full whitespace-normal h-auto py-3 px-4 flex flex-col items-start gap-1 bg-rose-600 hover:bg-rose-700 text-white"
            onClick={() => handleResolve('FORCE_EDGE_EVENT')} 
            disabled={!!loading}
          >
            <span className="font-semibold text-sm">Force Sync</span>
            <span className="text-xs text-rose-200 text-left">Apply the POS charge/payment forcibly.</span>
            {loading === 'FORCE_EDGE_EVENT' && <Loader2 className="absolute right-4 h-4 w-4 animate-spin text-white" />}
          </Button>
        </div>
      </div>
    </>
  );
}

function FolioPreview({ item, onClose }: { item: any; onClose: () => void }) {
  return (
    <div className="bg-slate-50 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-900/5">
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <FolioDetailView folioId={item.id} onBack={onClose} />
      </div>
    </div>
  );
}
