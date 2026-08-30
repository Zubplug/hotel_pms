"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export type ResolutionAction = 
  | { type: 'ARRIVALS'; item: any }
  | { type: 'DEPARTURES'; item: any }
  | { type: 'ROOM_DISCREPANCY'; item: any }
  | { type: 'POS_SESSION'; item: any }
  | { type: 'FRONTDESK_SHIFT'; item: any }
  | { type: 'FOLIO_PREVIEW'; item: any }
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
      <DialogContent className="sm:max-w-[500px]">
        {action.type === 'ARRIVALS' && <ArrivalResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'DEPARTURES' && <DepartureResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'ROOM_DISCREPANCY' && <RoomDiscrepancyResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'POS_SESSION' && <PosSessionResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'FRONTDESK_SHIFT' && <FrontdeskShiftResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'FOLIO_PREVIEW' && <FolioPreview item={action.item} onClose={onClose} />}
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

  const balance = item.folios?.reduce((acc: number, f: any) => acc + Number(f.balance || 0), 0) || 0;
  const hasBalance = balance !== 0;

  const handleCheckout = async () => {
    setLoading('checkout');
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${item.id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
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
        body: JSON.stringify({ newCheckOut: d.toISOString().split('T')[0] })
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

      <div className="py-4 space-y-4">
        <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium">Outstanding Balance</span>
          <span className={`font-semibold ${hasBalance ? 'text-rose-600' : 'text-emerald-600'}`}>
            {balance.toFixed(2)}
          </span>
        </div>

        {hasBalance ? (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
            <p className="font-semibold mb-1">Cannot Check Out</p>
            <p>This reservation has a non-zero folio balance. Please go to the billing screen to process payment, discounts, or refunds before checking out.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="bg-white" onClick={() => window.open(`/reservations/${item.id}/folios`, '_blank')}>Go to Billing</Button>
            </div>
          </div>
        ) : (
          <Button className="w-full justify-between bg-indigo-600 hover:bg-indigo-700" onClick={handleCheckout} disabled={!!loading}>
            <span>Process Check-Out</span>
            {loading === 'checkout' && <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>
        )}

        <div className="relative border-t mt-4 pt-4">
          <Button variant="outline" className="w-full justify-between" onClick={handleExtend} disabled={!!loading}>
            <span>Extend Stay (1 Night)</span>
            {loading === 'extend' && <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>
        </div>
      </div>
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
        body: JSON.stringify({ roomId: item.roomId, action: 'RECONCILE', targetStatus: item.expected === 'OCCUPIED' ? 'DIRTY' : 'CLEAN' })
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Front Desk</p>
            <p className="font-semibold">{item.expected}</p>
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

function FolioPreview({ item, onClose }: { item: any; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Folio Preview</DialogTitle>
        <DialogDescription>Folio #{item.folioNumber || item.id}</DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4">
        <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium">Current Balance</span>
          <span className="font-semibold text-amber-600">{Number(item.balance || 0).toFixed(2)}</span>
        </div>
        <div className="p-4 border rounded-xl text-sm">
          <p className="text-muted-foreground mb-3">This is a read-only preview. To process financial adjustments or payments, you must open the full billing interface.</p>
          <Button variant="outline" className="w-full bg-white" onClick={() => window.open(`/finance/folios/${item.id}`, '_blank')}>
            Open Billing Workspace
          </Button>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Close Preview</Button>
      </DialogFooter>
    </>
  );
}
