'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Clock3, Loader2, RotateCcw } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function NoShowActions({ reservation, onUpdated }: { reservation: any; onUpdated?: () => void }) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const { provider } = useLodgeCoreProvider();

  async function request(path: string, body: Record<string, unknown>) {
    setBusy(true); setMessage(null);
    try {
      const result = path === 'late-arrival'
        ? await provider.reservations.markLateArrival(reservation.id, String(body.notes || ''))
        : path === 'no-show'
          ? await provider.reservations.assessNoShow(reservation.id)
          : await provider.reservations.reinstate(reservation.id, String(body.reason || ''));
      if (!result?.success) throw new Error(result?.error?.message || result?.error || 'Request failed');
      return result.data;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed'); return null; }
    finally { setBusy(false); }
  }

  if (reservation.status === 'CONFIRMED') return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3"><div className="flex items-center gap-2 font-semibold text-amber-900"><Clock3 className="h-4 w-4" /> Arrival management</div>{!expanded ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setExpanded(true)}>Record late arrival</Button><Button size="sm" variant="destructive" disabled={busy} onClick={async () => { const data = await request('no-show', {}); if (data) { setAssessment(data.assessment); onUpdated?.(); } }}>Assess no-show</Button></div> : <div className="space-y-2"><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Expected arrival time or guest notes" /><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={async () => { const data = await request('late-arrival', { notes }); if (data) { setExpanded(false); onUpdated?.(); } }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save late arrival</Button><Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Cancel</Button></div></div>}{message && <p className="text-sm text-red-700">{message}</p>}{assessment && <AssessmentCard assessment={assessment} />}</div>;

  if (reservation.status === 'NO_SHOW') return <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3"><div className="flex items-center gap-2 font-semibold text-red-900"><AlertCircle className="h-4 w-4" /> No-show assessed</div><p className="text-sm text-red-800">Refund eligible: {reservation.currency} {Number(reservation.noShowRefundableAmount || 0).toFixed(2)}. Submit a <strong>No-show refund</strong> request from the folio.</p><Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason for reinstatement" /><Button size="sm" variant="outline" disabled={busy} onClick={async () => { const data = await request('reinstate', { reason }); if (data) onUpdated?.(); }}><RotateCcw className="mr-2 h-4 w-4" />Reinstate reservation</Button>{message && <p className="text-sm text-red-700">{message}</p>}</div>;
  return null;
}

function AssessmentCard({ assessment }: { assessment: any }) { return <div className="rounded-md bg-white p-3 text-sm"><p>Total nights: {assessment.totalNights}</p><p>No-show charge: {Number(assessment.noShowCharge).toFixed(2)}</p><p className="font-semibold">Maximum refundable: {Number(assessment.refundableAmount).toFixed(2)}</p></div>; }
