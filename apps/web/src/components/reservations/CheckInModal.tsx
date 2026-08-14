'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, CreditCard, Cpu, Wifi, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Status stage definitions ────────────────────────────────────────────────

const STAGES = [
  { key: 'QUEUED',           label: 'Preparing command',       icon: Cpu,        color: 'text-blue-500' },
  { key: 'DISPATCHED',       label: 'Sending to encoder',      icon: Wifi,       color: 'text-blue-500' },
  { key: 'WAITING_FOR_CARD', label: 'Waiting — place card on encoder', icon: CreditCard, color: 'text-amber-500' },
  { key: 'CARD_DETECTED',    label: 'Card detected',           icon: CreditCard, color: 'text-amber-500' },
  { key: 'ENCODING',         label: 'Writing room access…',    icon: Cpu,        color: 'text-purple-500' },
  { key: 'VERIFYING',        label: 'Verifying card data',     icon: ShieldCheck, color: 'text-purple-500' },
  { key: 'ACTIVE',           label: 'Card ready ✓',            icon: CheckCircle2, color: 'text-emerald-500' },
] as const;

type StageKey = typeof STAGES[number]['key'];

const STAGE_ORDER: StageKey[] = STAGES.map((s) => s.key);
const TERMINAL_SUCCESS: StageKey = 'ACTIVE';
const TERMINAL_FAIL = ['FAILED', 'EXPIRED', 'CANCELLED'];

interface Props {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckInModal({ reservationId, guestName, roomNumber, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'polling' | 'success' | 'error'>('idle');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // ── Polling loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'polling' || !operationId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/hardware/operations/${operationId}`);
        if (!res.ok) throw new Error('Failed to get operation status');
        const body = await res.json();
        const status: string = body.data?.status ?? '';

        setCurrentStatus(status);

        if (status === TERMINAL_SUCCESS) {
          setPhase('success');
          onSuccess?.();
          return;
        }
        if (TERMINAL_FAIL.includes(status)) {
          setErrorMsg(body.data?.errorMessage ?? 'Hardware encoding failed');
          setPhase('error');
          return;
        }
        // Keep polling
        pollRef.current = setTimeout(poll, 1500);
      } catch (e: any) {
        setErrorMsg(e.message ?? 'Network error while polling');
        setPhase('error');
      }
    };

    pollRef.current = setTimeout(poll, 1500);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [phase, operationId, onSuccess]);

  // ── Start check-in ───────────────────────────────────────────────────────
  async function startCheckIn() {
    setPhase('loading');
    setErrorMsg('');
    setCurrentStatus('QUEUED');

    try {
      const res = await fetch(`/api/v1/reservations/${reservationId}/check-in`, {
        method: 'POST',
      });
      const body = await res.json();

      if (!res.ok) {
        setErrorMsg(body.error?.message ?? 'Failed to initiate check-in');
        setPhase('error');
        return;
      }

      setOperationId(body.data.operationId);
      setCurrentStatus(body.data.operationStatus ?? 'QUEUED');
      setPhase('polling');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Network error');
      setPhase('error');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const currentStageIndex = STAGE_ORDER.indexOf(currentStatus as StageKey);

  function getStageState(stageKey: StageKey) {
    const idx = STAGE_ORDER.indexOf(stageKey);
    if (phase === 'success' || idx < currentStageIndex) return 'done';
    if (idx === currentStageIndex && phase !== 'idle') return 'active';
    return 'pending';
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={phase === 'idle' || phase === 'success' || phase === 'error' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-background rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Guest Check-In</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {guestName} · Room <span className="font-medium text-foreground">{roomNumber}</span>
              </p>
            </div>
            {(phase === 'idle' || phase === 'success' || phase === 'error') && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                aria-label="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Idle state */}
          {phase === 'idle' && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Before you continue</p>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-1">
                  <li>Make sure the key card encoder is powered on</li>
                  <li>Have a blank RFID card ready to place on the encoder</li>
                  <li>The card will be valid until check-out date</li>
                </ul>
              </div>

              <Button className="w-full h-11" onClick={startCheckIn} id="btn-start-checkin">
                <CreditCard className="mr-2 h-4 w-4" />
                Start Check-In &amp; Encode Key Card
              </Button>
            </div>
          )}

          {/* Loading / Polling — stages */}
          {(phase === 'loading' || phase === 'polling') && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Encoding Progress
              </p>
              {STAGES.map((stage) => {
                const state = getStageState(stage.key);
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.key}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300',
                      state === 'active' ? 'bg-primary/8 border border-primary/20' : '',
                      state === 'done' ? 'opacity-60' : '',
                      state === 'pending' ? 'opacity-30' : '',
                    ].join(' ')}
                  >
                    {state === 'done' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    {state === 'active' && (
                      <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                    )}
                    {state === 'pending' && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                    )}
                    <span className={['text-sm', state === 'active' ? 'font-medium' : ''].join(' ')}>
                      {stage.label}
                    </span>
                    {state === 'active' && stage.key === 'WAITING_FOR_CARD' && (
                      <span className="ml-auto flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}

              <p className="text-xs text-muted-foreground text-center pt-2">
                <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
                Do not close this window until encoding is complete
              </p>
            </div>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="space-y-4 text-center py-2">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Check-in Complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Key card for Room <span className="font-medium text-foreground">{roomNumber}</span> is ready.
                  <br />
                  Hand the card to <span className="font-medium text-foreground">{guestName}</span>.
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ RFID card successfully encoded and credential activated
                </p>
              </div>
              <Button className="w-full" onClick={onClose} id="btn-checkin-done">
                Done
              </Button>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="space-y-4 text-center py-2">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Encoding Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={() => { setPhase('idle'); setErrorMsg(''); }} id="btn-checkin-retry">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
