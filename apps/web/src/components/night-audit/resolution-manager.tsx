"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FolioDetailView } from '@/components/finance/FolioDetailView';
import { TransactionVerificationResolution } from './transaction-verification-resolution';
import { ComplimentaryVerificationResolution } from './complimentary-verification-resolution';

export type ResolutionAction = 
  | { type: 'ARRIVALS'; item: any }
  | { type: 'DEPARTURES'; item: any }
  | { type: 'ROOM_DISCREPANCY'; item: any }
  | { type: 'POS_SESSION'; item: any }
  | { type: 'FRONTDESK_SHIFT'; item: any }
  | { type: 'FOLIO_PREVIEW'; item: any }
  | { type: 'ROOM_CHARGES_PREVIEW'; item: any }
  | { type: 'SYNC_CONFLICT'; item: any }
  | { type: 'TRANSACTION_VERIFICATION'; item: any }
  | { type: 'DISCOUNT_APPROVAL'; item: any }
  | { type: 'COMPLIMENTARY_VERIFICATION'; item: any }
  | { type: 'CHECKIN_BYPASS'; item: any }
  | { type: 'CASH_HANDOVER'; item: any }
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
      <DialogContent 
        className={action?.type === 'FOLIO_PREVIEW' || action?.type === 'ROOM_CHARGES_PREVIEW'
          ? "sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none" 
          : "sm:max-w-[500px] border-white/[0.08] shadow-[0_40px_120px_rgba(0,0,0,0.8)]"}
        style={action?.type !== 'FOLIO_PREVIEW' && action?.type !== 'ROOM_CHARGES_PREVIEW' ? { background: '#07090f', color: 'white' } : undefined}
      >
        {action.type === 'ARRIVALS' && <ArrivalResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'DEPARTURES' && <DepartureResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'ROOM_DISCREPANCY' && <RoomDiscrepancyResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'POS_SESSION' && <PosSessionResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'FRONTDESK_SHIFT' && <FrontdeskShiftResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'FOLIO_PREVIEW' && <FolioPreview item={action.item} onClose={onClose} />}
        {action.type === 'ROOM_CHARGES_PREVIEW' && <RoomChargesPreview item={action.item} onClose={onClose} />}
        {action.type === 'SYNC_CONFLICT' && <FinancialSyncResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'TRANSACTION_VERIFICATION' && <TransactionVerificationResolution propertyId={action.item.propertyId} transactions={action.item.unverifiedTransactions} onOpenChange={(open) => !open && onClose()} onSuccess={onSuccess} open={true} />}
        {action.type === 'DISCOUNT_APPROVAL' && <DiscountApprovalResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'COMPLIMENTARY_VERIFICATION' && <ComplimentaryVerificationResolution propertyId={action.item.propertyId} records={action.item.records} onOpenChange={(open) => !open && onClose()} open={true} onSuccess={onSuccess} />}
        {action.type === 'CHECKIN_BYPASS' && <CheckinBypassResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
        {action.type === 'CASH_HANDOVER' && <CashHandoverResolution item={action.item} onSuccess={onSuccess} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function CashHandoverResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receive = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/financial-control/handovers/${item.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Received from Night Audit wizard' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || body.error || 'Unable to receive handover');
      toast.success('Cash handover received into General Cashier custody');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Unable to receive handover');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">Receive cash handover</DialogTitle>
        <DialogDescription className="text-slate-400">
          Confirm physical receipt of this approved handover. The custody transfer and GL posting will be recorded atomically.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-4 text-sm text-slate-300">
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <p className="font-semibold text-amber-200">{item.drawerName || item.location || 'Cash drawer'}</p>
          <p className="mt-1 text-xs text-slate-400">Reference: {item.handoverReference || item.id}</p>
          {item.amount !== undefined && <p className="mt-2 text-lg font-bold text-white">{Number(item.amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</p>}
        </div>
        {error && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}
        <p className="text-xs leading-5 text-slate-500">Count the physical cash and verify the handover reference before confirming. This action cannot be undone from the wizard.</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading} className="text-slate-300 hover:text-white">Cancel</Button>
        <Button onClick={receive} disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          {loading ? 'Receiving…' : 'Confirm receipt'}
        </Button>
      </DialogFooter>
    </>
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
        <DialogTitle className="text-white">Resolve Pending Arrival</DialogTitle>
        <DialogDescription className="text-slate-400">
          {item.primaryGuest?.firstName} {item.primaryGuest?.lastName} (Conf: {item.confirmationNumber})
          <div className="mt-2 text-sm">
            {isPaid ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-md">
                <CheckCircle2 className="h-4 w-4" /> Pre-paid/Deposit: {Math.abs(totalBalance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-md">
                <AlertTriangle className="h-4 w-4" /> No prepayment on file
              </span>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>
      
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}
      
      <div className="grid gap-3 py-4">
        <Button variant="outline" className="justify-between border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white" onClick={() => handleAction('no-show')} disabled={!!loading}>
          <span>Mark as No-Show</span>
          {loading === 'no-show' && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
        <Button variant="outline" className="justify-between border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white" onClick={() => handleAction('cancel')} disabled={!!loading}>
          <span>Cancel Reservation</span>
          {loading === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
        <Button variant="outline" className="justify-between border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white" onClick={handleLateArrival} disabled={!!loading}>
          <span>Mark as Late Arrival</span>
          {loading === 'late' && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={!!loading} className="text-slate-300 hover:text-white">Cancel</Button>
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
        <DialogTitle className="text-white">Resolve Pending Departure</DialogTitle>
        <DialogDescription className="text-slate-400">
          {item.primaryGuest?.firstName} {item.primaryGuest?.lastName} (Conf: {item.confirmationNumber})
        </DialogDescription>
      </DialogHeader>

      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}

      {showSkipperConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-amber-400/[0.05] border border-amber-400/20 rounded-xl text-sm text-amber-200 space-y-3">
            <h4 className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Transfer Balance & Force Check-Out
            </h4>
            <p>This guest has an outstanding balance of <strong>{balance.toFixed(2)}</strong>.</p>
            <p>The balance will be transferred to the <strong>City Ledger / Accounts Receivable</strong> and the reservation will be checked out.</p>
            <p className="font-medium text-amber-300">The guest will still owe this amount to the hotel.</p>
            <div className="space-y-1.5 pt-2 border-t border-amber-400/20">
              <label className="text-xs font-semibold text-amber-400">Reason (Required)</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-white/[0.1] rounded-md bg-black/20 text-white focus:border-amber-400/50 outline-none" 
                placeholder="Guest left without settling balance..."
                value={skipperReason}
                onChange={e => setSkipperReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-white/[0.1] bg-white/[0.02] text-white hover:bg-white/[0.05]" onClick={() => setShowSkipperConfirm(false)} disabled={!!loading}>Cancel</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-none" onClick={handleSkipper} disabled={!!loading || !skipperReason.trim()}>
              {loading === 'skipper' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer & Check-Out
            </Button>
          </div>
        </div>
      ) : showRetainConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-slate-300 space-y-3">
            <h4 className="font-bold flex items-center gap-2 text-white">
              <AlertTriangle className="h-4 w-4 text-emerald-400" /> Retain {Math.abs(balance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} and Check Out?
            </h4>
            <p>This will apply an approved early-departure/retention charge of <strong>{Math.abs(balance).toFixed(2)}</strong>.</p>
            <p>The guest will no longer have a credit balance.</p>
            <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
              <label className="text-xs font-semibold text-slate-400">Retention Code (Required)</label>
              <select className="w-full px-3 py-2 border border-white/[0.1] rounded-md bg-black/20 text-white outline-none" value={retainReasonCode} onChange={e => setRetainReasonCode(e.target.value)}>
                <option value="EARLY_DEPARTURE">Early departure penalty</option>
                <option value="DEPOSIT_FORFEITURE">Deposit forfeiture</option>
                <option value="NO_SHOW">Cancellation/no-show penalty</option>
                <option value="OTHER">Other approved retention reason</option>
              </select>
            </div>
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-400">Notes (Required)</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-white/[0.1] rounded-md bg-black/20 text-white outline-none" 
                placeholder="Manager approved retention..."
                value={retainNotes}
                onChange={e => setRetainNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-white/[0.1] bg-white/[0.02] text-white hover:bg-white/[0.05]" onClick={() => setShowRetainConfirm(false)} disabled={!!loading}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-none" onClick={handleRetainCredit} disabled={!!loading || !retainNotes.trim()}>
              {loading === 'retain' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Retain & Check-Out
            </Button>
          </div>
        </div>
      ) : showRefundConfirm ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-blue-400/[0.05] border border-blue-400/20 rounded-xl text-sm text-blue-200 space-y-3">
            <h4 className="font-bold flex items-center gap-2 text-white">
              <AlertTriangle className="h-4 w-4 text-blue-400" /> Transfer {Math.abs(balance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} to Pending Guest Refunds?
            </h4>
            <p>This will record <strong>{Math.abs(balance).toFixed(2)}</strong> as a liability owed by the hotel to the guest.</p>
            <p className="font-semibold text-rose-400">No money will be refunded now.</p>
            <p>Finance will process the actual refund transfer at a later date.</p>
            <div className="space-y-1.5 pt-2 border-t border-blue-400/20">
              <label className="text-xs font-semibold text-blue-400">Reason (Required)</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-white/[0.1] rounded-md bg-black/20 text-white outline-none focus:border-blue-400/50" 
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-white/[0.1] bg-white/[0.02] text-white hover:bg-white/[0.05]" onClick={() => setShowRefundConfirm(false)} disabled={!!loading}>Cancel</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none" onClick={handleTransferRefund} disabled={!!loading || !refundReason.trim()}>
              {loading === 'transfer-refund' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer & Check-Out
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Outstanding Balance</span>
            <span className={`font-semibold ${isSkipper ? 'text-rose-400' : isCredit ? 'text-blue-400' : 'text-emerald-400'}`}>
              {balance.toFixed(2)}
            </span>
          </div>

          {!hasBalance ? (
            <Button className="w-full justify-between bg-indigo-600 hover:bg-indigo-700 text-white border-none" onClick={handleCheckout} disabled={!!loading}>
              <span>Process Check-Out</span>
              {loading === 'checkout' && <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
          ) : isCredit ? (
            <div className="p-4 bg-blue-400/[0.05] border border-blue-400/20 rounded-xl text-sm text-blue-200 space-y-3">
              <p className="font-semibold text-white">Credit Balance - Cannot Check Out</p>
              <p>This guest has an overpayment of <strong>{Math.abs(balance).toFixed(2)}</strong>. You must zero this balance before checking out.</p>
              <div className="grid gap-2 pt-2">
                <Button size="sm" variant="outline" className="w-full justify-between border-white/[0.1] bg-white/[0.05] text-white hover:bg-white/[0.1]" onClick={() => window.open(`/reservations/${item.id}/folios`, '_blank')}>
                  <span>Go to Billing (Actual Refund)</span>
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-between border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-300" onClick={() => setShowRetainConfirm(true)}>
                  <span>Retain Credit (Early Departure Fee)</span>
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-between border-blue-400/30 bg-blue-400/10 hover:bg-blue-400/20 text-blue-300" onClick={() => setShowRefundConfirm(true)}>
                  <span>Transfer to Pending Guest Refunds (Liability)</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-400/[0.05] border border-rose-400/20 rounded-xl text-sm text-rose-200 space-y-3">
              <p className="font-semibold text-white">Balance Due - Cannot Standard Check-Out</p>
              <p>This reservation has a non-zero folio balance. You can process payment in billing, or if the guest has left, transfer the debt to Accounts Receivable (City Ledger).</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="border-white/[0.1] bg-white/[0.05] text-white hover:bg-white/[0.1]" onClick={() => window.open(`/reservations/${item.id}/folios`, '_blank')}>Go to Billing</Button>
                <Button size="sm" variant="outline" className="bg-rose-400/10 hover:bg-rose-400/20 text-rose-300 border border-rose-400/30" onClick={() => setShowSkipperConfirm(true)}>
                  Transfer to City Ledger (Skipper)
                </Button>
              </div>
            </div>
          )}

          <div className="relative border-t border-white/[0.08] mt-4 pt-4">
            <Button variant="outline" className="w-full justify-between border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white" onClick={handleExtend} disabled={!!loading}>
              <span>Extend Stay (1 Night)</span>
              {loading === 'extend' && <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={!!loading} className="text-slate-300 hover:text-white">Cancel</Button>
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
        <DialogTitle className="text-white">Room Discrepancy</DialogTitle>
        <DialogDescription className="text-slate-400">Room {item.roomNumber}</DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}
      <div className="py-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border border-white/[0.08] rounded-xl bg-white/[0.03]">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PMS Status</p>
            <p className="font-semibold text-white">{item.pmsStatus}</p>
            <p className="text-[11px] text-indigo-400 mt-1 font-medium">Expected: {item.expected}</p>
          </div>
          <div className="p-4 border border-amber-400/20 rounded-xl bg-amber-400/10">
            <p className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wider mb-1">Housekeeping</p>
            <p className="font-semibold text-amber-300">{item.hkStatus}</p>
          </div>
        </div>
        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none" onClick={handleFix} disabled={loading}>
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
  const [openOrders, setOpenOrders] = useState<any[] | null>(null);
  const [checkingOrders, setCheckingOrders] = useState(true);

  const expected = Number(item.expectedCash || 0);
  const variance = Number(declared || 0) - expected;

  useEffect(() => {
    async function fetchOpenOrders() {
      try {
        setCheckingOrders(true);
        const res = await fetch(`/api/v1/pos/sessions/${item.id}/open-orders`);
        if (res.ok) {
          const body = await res.json();
          setOpenOrders(body.data ?? []);
        } else {
          setOpenOrders([]);
        }
      } catch {
        setOpenOrders([]);
      } finally {
        setCheckingOrders(false);
      }
    }
    fetchOpenOrders();
  }, [item.id]);

  const hasOpenOrders = (openOrders?.length ?? 0) > 0;

  const handleClose = async () => {
    if (!reason && variance !== 0) {
      setError('A reason is required for non-zero variances.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/pos/sessions/${item.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ actualCash: Number(declared), authorizerId: null, reason })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to close POS session');
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
        <DialogTitle className="text-white">Close POS Session</DialogTitle>
        <DialogDescription className="text-slate-400">
          {item.outlet?.name} - Opened by {item.openedBy}
        </DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}

      {checkingOrders ? (
        <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> Checking for open orders…
        </div>
      ) : hasOpenOrders ? (
        <div className="py-4 space-y-4">
          <div className="p-4 bg-rose-400/[0.05] border border-rose-400/30 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-rose-400/10 rounded-lg shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <p className="font-bold text-rose-300 text-base">
                  Cannot Close Shift — {openOrders!.length} Open Order{openOrders!.length !== 1 ? 's' : ''} Must Be Resolved
                </p>
                <p className="text-rose-200/80 text-sm mt-0.5">
                  This shift cannot be closed until all pending orders are settled or voided by the responsible waiter.
                </p>
              </div>
            </div>

            <div className="bg-black/20 border border-white/[0.08] rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">⚡ Action Required — Tell the Waiter to:</p>
              <ol className="text-[13px] text-slate-300 space-y-2 list-none mt-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-400/70 shrink-0">1.</span>
                  <span>Log back into their POS terminal using their PIN or staff card.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-400/70 shrink-0">2.</span>
                  <span>Open each order listed below and <strong>collect payment</strong> from the guest, OR</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-400/70 shrink-0">3.</span>
                  <span>If the table is empty, <strong>void the order</strong> with a valid reason before logging out.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-400/70 shrink-0">4.</span>
                  <span>Once all orders are resolved, return here and click <strong>Resolve</strong> again to close the shift.</span>
                </li>
              </ol>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Pending Orders ({openOrders!.length})
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {openOrders!.map((order: any) => (
                <div
                  key={order.id}
                  className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] text-sm shadow-sm transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-200">
                        #{order.orderNumber}
                        {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
                      </p>
                      {order.outletName && (
                        <p className="text-xs text-slate-400">{order.outletName}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-slate-500">Waiter:</span>
                        <span className="text-xs font-semibold text-rose-300">
                          {order.waiterName ?? 'Unknown — contact outlet supervisor'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-500">Status:</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          {order.status?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-white shrink-0 text-base tabular-nums">
                      ₦{Number(order.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">Dismiss</Button>
          </DialogFooter>
        </div>
      ) : (
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between p-3 border border-white/[0.08] rounded-lg bg-white/[0.03]">
            <span className="text-sm font-medium text-slate-300">Expected Cash</span>
            <span className="font-bold text-white tabular-nums">₦{expected.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Actual Declared Cash</label>
            <input type="number" className="w-full border border-white/[0.1] rounded-md px-3 py-2 text-sm bg-black/20 text-white outline-none focus:border-indigo-400/50 tabular-nums" value={declared} onChange={e => setDeclared(e.target.value)} placeholder="0.00" />
          </div>
          {declared && (
            <div className={`flex items-center justify-between p-3 border rounded-lg ${variance === 0 ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' : 'bg-rose-400/10 text-rose-300 border-rose-400/20'}`}>
              <span className="text-sm font-medium">Variance</span>
              <span className="font-bold tabular-nums">{variance > 0 ? '+' : ''}{variance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {variance !== 0 && declared !== '' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Variance Reason (Required)</label>
              <input type="text" className="w-full border border-white/[0.1] rounded-md px-3 py-2 text-sm bg-black/20 text-white outline-none focus:border-indigo-400/50" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the variance..." />
            </div>
          )}
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none" onClick={handleClose} disabled={loading || declared === ''}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm & Close Session'}
          </Button>
        </div>
      )}
    </>
  );
}


function FrontdeskShiftResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declared, setDeclared] = useState('');
  const [reason, setReason] = useState('');
  
  const expected = Number(item.systemExpectedCash || item.expectedCash || 0);
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
        body: JSON.stringify({ declaredCash: Number(declared), reason })
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
        <DialogTitle className="text-white">Close Front Desk Shift</DialogTitle>
        <DialogDescription className="text-slate-400">Shift {item.shiftReference}</DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}
      <div className="py-4 space-y-4">
        <div className="flex items-center justify-between p-3 border border-white/[0.08] rounded-lg bg-white/[0.03]">
          <span className="text-sm font-medium text-slate-300">Expected Cash Drawer</span>
          <span className="font-bold text-white tabular-nums">{expected.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Actual Declared Cash</label>
          <input type="number" className="w-full border border-white/[0.1] rounded-md px-3 py-2 text-sm bg-black/20 text-white outline-none focus:border-indigo-400/50 tabular-nums" value={declared} onChange={e => setDeclared(e.target.value)} placeholder="0.00" />
        </div>
        {declared && (
          <div className={`flex items-center justify-between p-3 border rounded-lg ${variance === 0 ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' : 'bg-amber-400/10 text-amber-300 border-amber-400/20'}`}>
            <span className="text-sm font-medium">Variance</span>
            <span className="font-bold tabular-nums">{variance > 0 ? '+' : ''}{variance.toFixed(2)}</span>
          </div>
        )}
        {variance !== 0 && declared !== '' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Variance Reason (Required)</label>
            <input type="text" className="w-full border border-white/[0.1] rounded-md px-3 py-2 text-sm bg-black/20 text-white outline-none focus:border-indigo-400/50" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the variance..." />
          </div>
        )}
        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none" onClick={handleClose} disabled={loading || declared === ''}>
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
        <DialogTitle className="text-white">Financial Sync Conflict</DialogTitle>
        <DialogDescription className="text-slate-400">A POS or remote device attempted to sync data that conflicts with the PMS.</DialogDescription>
      </DialogHeader>
      
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}
      
      <div className="py-4 space-y-4">
        <div className="p-4 border border-white/[0.08] rounded-xl bg-white/[0.03] space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Type:</span>
            <span className="font-medium text-white">{item.aggregateType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Event:</span>
            <span className="font-medium text-white">{item.hotelEvent?.eventType || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Device:</span>
            <span className="font-medium text-white">{item.hotelEvent?.deviceId || 'Unknown'}</span>
          </div>

          {item.hotelEvent?.payload && (
            <div className="pt-3 mt-3 border-t border-white/[0.08] space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Sync Payload Data</p>
              {item.hotelEvent.payload.amount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="font-medium font-mono text-indigo-400 tabular-nums">
                    {Number(item.hotelEvent.payload.amount).toLocaleString('en-NG', { style: 'currency', currency: item.hotelEvent.payload.currency || 'NGN' })}
                  </span>
                </div>
              )}
              {item.hotelEvent.payload.description && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Description:</span>
                  <span className="font-medium text-white">{item.hotelEvent.payload.description}</span>
                </div>
              )}
              {item.hotelEvent.payload.method && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-medium text-white">{item.hotelEvent.payload.method}</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 mt-2 border-t border-white/[0.08] text-[11px] text-slate-500">
            {item.errorDetails?.message || 'Version mismatch detected.'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="w-full whitespace-normal h-auto py-3 px-4 flex flex-col items-start gap-1 border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white"
            onClick={() => handleResolve('REJECT_EDGE_EVENT')} 
            disabled={!!loading}
          >
            <span className="font-semibold text-sm text-white">Reject Event</span>
            <span className="text-[10px] text-slate-400 text-left leading-tight mt-1">Discard the POS change. The PMS state wins.</span>
            {loading === 'REJECT_EDGE_EVENT' && <Loader2 className="absolute right-4 h-4 w-4 animate-spin text-white" />}
          </Button>

          <Button 
            className="w-full whitespace-normal h-auto py-3 px-4 flex flex-col items-start gap-1 bg-rose-600 hover:bg-rose-700 text-white border-none"
            onClick={() => handleResolve('FORCE_EDGE_EVENT')} 
            disabled={!!loading}
          >
            <span className="font-semibold text-sm">Force Sync</span>
            <span className="text-[10px] text-rose-200 text-left leading-tight mt-1">Apply the POS charge/payment forcibly.</span>
            {loading === 'FORCE_EDGE_EVENT' && <Loader2 className="absolute right-4 h-4 w-4 animate-spin text-white" />}
          </Button>
        </div>
      </div>
    </>
  );
}

function FolioPreview({ item, onClose }: { item: any; onClose: () => void }) {
  return (
    <div className="bg-[#07090f] rounded-2xl overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)] border border-white/[0.08]">
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <FolioDetailView folioId={item.id} onBack={onClose} readOnly={true} darkMode />
      </div>
    </div>
  );
}

function RoomChargesPreview({ item, onClose }: { item: any; onClose: () => void }) {
  const items = Array.isArray(item.items) ? item.items : [];
  const currency = item.currency || 'NGN';
  const money = (amount: number) => new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
  const gross = items.reduce((sum: number, charge: any) => sum + Number(charge.grossAmount ?? charge.amount ?? 0), 0);
  const discount = items.reduce((sum: number, charge: any) => sum + Number(charge.discountAmount || 0), 0);
  const net = items.reduce((sum: number, charge: any) => sum + Number(charge.netAmount ?? Number(charge.amount || 0) - Number(charge.discountAmount || 0)), 0);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#07090f] p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.8)]">
      <DialogHeader>
        <DialogTitle className="text-white">Review room charges</DialogTitle>
        <DialogDescription className="text-slate-400">
          Confirm these nightly charges before continuing. They are posted only when you confirm and execute the Night Audit.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-3 py-5">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Gross</p>
          <p className="mt-1 font-bold tabular-nums">{money(gross)}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Discounts</p>
          <p className="mt-1 font-bold tabular-nums text-amber-300">{money(discount)}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">Net to post</p>
          <p className="mt-1 font-bold tabular-nums text-emerald-300">{money(net)}</p>
        </div>
      </div>

      <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-white/[0.08]">
        {items.map((charge: any) => (
          <div key={charge.operationId || charge.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/[0.06] p-4 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">Room {charge.roomNumber || '—'} · {charge.guestName || 'Guest'}</p>
              <p className="mt-1 text-xs text-slate-500">Confirmation: {charge.confirmationNumber || 'Unavailable'}{charge.roomType ? ` · ${charge.roomType}` : ''}</p>
            </div>
            <div className="text-right text-sm tabular-nums">
              <p className="font-semibold text-white">{money(Number(charge.netAmount ?? charge.amount ?? charge.grossAmount ?? 0))}</p>
              {Number(charge.discountAmount || 0) > 0 && <p className="text-xs text-amber-300">Discount {money(Number(charge.discountAmount))}</p>}
            </div>
          </div>
        ))}
      </div>

      <DialogFooter className="mt-5">
        <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">Back to audit</Button>
      </DialogFooter>
    </div>
  );
}

function DiscountApprovalResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/manager/approvals/${item.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `Failed to ${action} discount`);
      }
      toast.success(`Discount ${action}d successfully`);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const d = item.details || {};

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">Review Discount</DialogTitle>
        <DialogDescription className="text-slate-400">
          A discount requires approval before room charges can be posted.
        </DialogDescription>
      </DialogHeader>
      
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}
      
      <div className="py-4 space-y-4">
        <div className="p-4 border border-white/[0.08] rounded-xl bg-white/[0.03] space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Type:</span>
            <span className="font-medium text-white">{d.targetType || 'RESERVATION_ROOM'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Requested By:</span>
            <span className="font-medium text-white">{item.requestedByName || item.requestedBy}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Acknowledged By:</span>
            <span className="font-medium text-white">{item.acknowledgedByName || 'Not acknowledged'}</span>
          </div>
          <div className="pt-2 border-t border-white/[0.08] mt-2">
            <p className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-2">Reservation details</p>
            <div className="space-y-1 text-slate-300">
              <p>Guest: {item.reservationRoom?.reservation?.primaryGuest ? `${item.reservationRoom.reservation.primaryGuest.firstName} ${item.reservationRoom.reservation.primaryGuest.lastName}` : 'Unavailable'}</p>
              <p>Confirmation: <span className="font-medium text-white">{item.reservationRoom?.reservation?.confirmationNumber || 'Unavailable'}</span></p>
              <p>Room: {item.reservationRoom?.room?.number || 'Waiting for room sync'}{item.reservationRoom?.room?.roomType?.name ? ` (${item.reservationRoom.room.roomType.name})` : ''}</p>
              {item.reservationRoom?.reservation?.corporateAccount && <p>Corporate: {item.reservationRoom.reservation.corporateAccount.name} ({item.reservationRoom.reservation.corporateAccount.code})</p>}
              {item.reservationRoom && <p>Stay: {format(new Date(item.reservationRoom.checkIn), 'MMM d, yyyy')} – {format(new Date(item.reservationRoom.checkOut), 'MMM d, yyyy')}</p>}
            </div>
          </div>
          <div className="flex justify-between pt-2 mt-2 border-t border-white/[0.08]">
            <span className="text-slate-400">Reason:</span>
            <span className="font-medium text-white">{item.reason || d.reason || 'No reason provided'}</span>
          </div>
          <div className="pt-4 mt-4 border-t border-white/[0.08] flex justify-between items-center text-base">
            <span className="font-semibold text-white">Discount Amount:</span>
            <span className="font-bold text-indigo-400 tabular-nums">
              {d.discountAmount ? Number(d.discountAmount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) : d.discountPercent ? `${d.discountPercent}%` : 'Variable'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1 border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
            onClick={() => handleAction('reject')} 
            disabled={!!loading}
          >
            {loading === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reject Discount
          </Button>
          <Button 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white border-none"
            onClick={() => handleAction('approve')} 
            disabled={!!loading || item.roomStatus !== 'READY'}
          >
            {loading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve Discount
          </Button>
        </div>
      </div>
    </>
  );
}

export function CheckinBypassResolution({ item, onSuccess, onClose }: { item: any; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState<'VERIFY' | 'REJECT' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('Reviewed during night audit');

  const handleAction = async (action: 'VERIFY' | 'REJECT') => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch('/api/v1/night-audit/verify-checkin-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypassId: item.id, action, notes, propertyId: item.propertyId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `Failed to ${action.toLowerCase()} bypass`);
      }
      toast.success(`Check-in bypass ${action === 'VERIFY' ? 'verified' : 'rejected'} successfully`);
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
        <DialogTitle className="text-white">Check-In Bypass Review</DialogTitle>
        <DialogDescription className="text-slate-400">
          Conf: {item.reservation?.confirmationNumber} - {item.reservation?.primaryGuest?.firstName} {item.reservation?.primaryGuest?.lastName}
        </DialogDescription>
      </DialogHeader>
      {error && <div className="p-3 bg-rose-400/[0.04] text-rose-300 rounded-lg text-sm border border-rose-400/20">{error}</div>}
      <div className="py-4 space-y-4">
        <div className="p-4 border border-white/[0.08] rounded-xl bg-white/[0.03] space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Reason:</span>
            <span className="font-medium text-right max-w-[200px] text-white">{item.reason}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Operator:</span>
            <span className="font-medium text-white">{item.operator?.firstName} {item.operator?.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Acknowledged by:</span>
            <span className="font-medium text-white">{item.acknowledgedBy?.firstName} {item.acknowledgedBy?.lastName}</span>
          </div>
          <div className="flex justify-between pt-2 mt-2 border-t border-white/[0.08]">
            <span className="text-slate-400">Balance:</span>
            <span className="font-bold text-rose-400 tabular-nums">
              {Number(item.reservation?.folios?.[0]?.balance || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Review Notes</label>
          <input 
            type="text" 
            className="w-full border border-white/[0.1] rounded-md px-3 py-2 text-sm bg-black/20 text-white outline-none focus:border-indigo-400/50" 
            value={notes} 
            onChange={e => setNotes(e.target.value)} 
            placeholder="Add notes..." 
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20" onClick={() => handleAction('REJECT')} disabled={!!loading}>
            {loading === 'REJECT' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject
          </Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-none" onClick={() => handleAction('VERIFY')} disabled={!!loading}>
            {loading === 'VERIFY' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
        </div>
      </div>
    </>
  );
}
