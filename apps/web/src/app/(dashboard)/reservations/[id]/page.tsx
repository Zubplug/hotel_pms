'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, BedDouble, CalendarDays, CreditCard,
  MapPin, Phone, Mail, CheckCircle2, Clock, XCircle,
  AlertCircle, LogIn, Shield, Wifi, WifiOff, KeyRound,
  PlusCircle, ShieldOff, LogOut, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/EmptyState';
import { CheckInModal } from '@/components/reservations/CheckInModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Guest {
  firstName: string; lastName: string;
  email?: string; phone?: string;
  nationality?: string;
}

interface RoomType { name: string; defaultBedConfig: string }
interface DoorLock { id: string; lockCode: string; provider: string; status: string }
interface Room { number: string; status: string; doorLocks: DoorLock[] }
interface ReservationRoom { room?: Room | null; roomType?: RoomType | null }

interface LockOp {
  id: string; status: string; operation: string;
  requestedAt: string; errorMessage?: string;
  credentialId?: string | null;
}

interface Reservation {
  id: string;
  confirmationNumber: string;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  adults: number; children: number;
  currency: string;
  lateCheckOut: boolean;
  earlyCheckIn: boolean;
  specialRequests?: string;
  primaryGuest: Guest;
  property: { id: string; name: string; city: string };
  reservationRooms: ReservationRoom[];
  lockOperations: LockOp[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  INQUIRY:     { label: 'Inquiry',     badge: 'bg-gray-100 text-gray-700 border-gray-200',        icon: Clock },
  PENDING:     { label: 'Pending',     badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',  icon: Clock },
  CONFIRMED:   { label: 'Confirmed',   badge: 'bg-blue-100 text-blue-800 border-blue-200',         icon: CheckCircle2 },
  CHECKED_IN:  { label: 'Checked In',  badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: LogIn },
  CHECKED_OUT: { label: 'Checked Out', badge: 'bg-slate-100 text-slate-700 border-slate-200',     icon: CheckCircle2 },
  CANCELLED:   { label: 'Cancelled',   badge: 'bg-red-100 text-red-700 border-red-200',            icon: XCircle },
  NO_SHOW:     { label: 'No Show',     badge: 'bg-orange-100 text-orange-800 border-orange-200',   icon: AlertCircle },
  EXPIRED:     { label: 'Expired',     badge: 'bg-gray-100 text-gray-500 border-gray-200',         icon: Clock },
};

const OP_STATUS_META: Record<string, { color: string; label: string }> = {
  QUEUED:          { color: 'text-sky-500',     label: 'Queued' },
  DISPATCHING:     { color: 'text-sky-500',     label: 'Dispatching…' },
  DISPATCHED:      { color: 'text-blue-500',    label: 'Dispatched' },
  WAITING_FOR_CARD:{ color: 'text-amber-500',   label: 'Waiting for Card…' },
  CARD_DETECTED:   { color: 'text-amber-500',   label: 'Card Detected' },
  ENCODING:        { color: 'text-purple-500',  label: 'Encoding…' },
  VERIFYING:       { color: 'text-purple-500',  label: 'Verifying…' },
  ACTIVE:          { color: 'text-emerald-500', label: 'Active' },
  REVOKED:         { color: 'text-slate-400',   label: 'Revoked' },
  FAILED:          { color: 'text-red-500',     label: 'Failed' },
  EXPIRED:         { color: 'text-gray-400',    label: 'Expired' },
};

const IN_PROGRESS_STATUSES = ['QUEUED', 'DISPATCHING', 'DISPATCHED', 'WAITING_FOR_CARD', 'CARD_DETECTED', 'ENCODING', 'VERIFYING'];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function nightCount(ci: string, co: string) {
  return Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reservation', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/reservations/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `HTTP ${res.status}`);
      }
      const body = await res.json();
      return body.data as Reservation;
    },
    enabled: !!id,
    retry: false,
    // Auto-refresh while any operation is in progress
    refetchInterval: (query) => {
      const ops = query.state.data?.lockOperations ?? [];
      return ops.some((op: LockOp) => IN_PROGRESS_STATUSES.includes(op.status)) ? 2000 : false;
    },
  });

  const additionalKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/reservations/${id}/additional-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error?.message || 'Failed'); }
      return res.json();
    },
    onSuccess: () => { setActionError(null); refetch(); },
    onError: (e: Error) => setActionError(e.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/reservations/${id}/check-out`, { method: 'POST' });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error?.message || 'Failed'); }
      return res.json();
    },
    onSuccess: () => { setActionError(null); queryClient.invalidateQueries({ queryKey: ['reservation', id] }); },
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) return <LoadingState message="Loading reservation…" />;
  if (error) return (
    <div className="text-center py-20">
      <div className="text-red-500 font-medium mb-2">Error: {error.message}</div>
      <Link href="/reservations" className="text-primary hover:underline">Back to list</Link>
    </div>
  );
  if (!data) return (
    <div className="text-center py-20 text-muted-foreground">
      Reservation not found. <Link href="/reservations" className="text-primary hover:underline">Back to list</Link>
    </div>
  );

  const reservation = data;
  const sm = STATUS_META[reservation.status] ?? STATUS_META.PENDING;
  const StatusIcon = sm.icon;
  const nights = nightCount(reservation.checkIn, reservation.checkOut);
  const firstRoom = reservation.reservationRooms[0];
  const guestName = `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}`;
  const roomNumber = firstRoom?.room?.number ?? '—';

  const hasActiveCredential = reservation.lockOperations.some(op => op.status === 'ACTIVE');
  const hasInProgressOp = reservation.lockOperations.some(op => IN_PROGRESS_STATUSES.includes(op.status));
  const canCheckIn = ['CONFIRMED', 'PENDING'].includes(reservation.status) && !hasActiveCredential && !hasInProgressOp;
  const isCheckedIn = reservation.status === 'CHECKED_IN';

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-300">

        {/* Back */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 -mt-0.5">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{guestName}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sm.badge}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {sm.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              #{reservation.confirmationNumber} · {reservation.property.name}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Check In */}
            {canCheckIn && (
              <Button
                size="lg"
                className="shrink-0 h-11 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                onClick={() => setShowCheckIn(true)}
                id="btn-check-in"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Check In & Encode Key Card
              </Button>
            )}

            {/* In progress indicator */}
            {hasInProgressOp && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Encoding key card…
              </div>
            )}

            {/* Active key badge + actions */}
            {hasActiveCredential && isCheckedIn && (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                  <KeyRound className="h-4 w-4" />
                  Key Card Active
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => additionalKeyMutation.mutate()}
                  disabled={additionalKeyMutation.isPending || hasInProgressOp}
                  id="btn-issue-additional-key"
                >
                  {additionalKeyMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <PlusCircle className="h-3.5 w-3.5" />}
                  Issue Additional Key
                </Button>
              </>
            )}

            {/* Check Out */}
            {isCheckedIn && !hasInProgressOp && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  if (confirm('Check out this guest? Active key cards will be queued for deactivation.')) {
                    checkOutMutation.mutate();
                  }
                }}
                disabled={checkOutMutation.isPending}
                id="btn-check-out"
              >
                {checkOutMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <LogOut className="h-3.5 w-3.5" />}
                Check Out
              </Button>
            )}
          </div>
        </div>

        {/* Action error */}
        {actionError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        {/* Booking summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Check-In',  value: formatDate(reservation.checkIn),  icon: CalendarDays },
            { label: 'Check-Out', value: formatDate(reservation.checkOut), icon: CalendarDays },
            { label: 'Duration',  value: `${nights} night${nights !== 1 ? 's' : ''}`, icon: Clock },
            { label: 'Guests',    value: `${reservation.adults} adult${reservation.adults !== 1 ? 's' : ''}${reservation.children > 0 ? ` · ${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}` : ''}`, icon: User },
          ].map((item) => (
            <Card key={item.label} className="border-muted/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-sm font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column ────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Guest info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Guest Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-semibold">{guestName}</p>
                {reservation.primaryGuest.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <a href={`mailto:${reservation.primaryGuest.email}`} className="hover:text-foreground transition-colors">
                      {reservation.primaryGuest.email}
                    </a>
                  </div>
                )}
                {reservation.primaryGuest.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a href={`tel:${reservation.primaryGuest.phone}`} className="hover:text-foreground transition-colors">
                      {reservation.primaryGuest.phone}
                    </a>
                  </div>
                )}
                {reservation.primaryGuest.nationality && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {reservation.primaryGuest.nationality}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rooms */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-muted-foreground" /> Assigned Rooms
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reservation.reservationRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No room assigned</p>
                ) : (
                  <div className="space-y-3">
                    {reservation.reservationRooms.map((rr, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/30 border">
                        <div>
                          <p className="font-semibold text-sm">Room {rr.room?.number ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{rr.roomType?.name ?? '—'} · {rr.roomType?.defaultBedConfig ?? '—'}</p>
                        </div>
                        {rr.room?.doorLocks && rr.room.doorLocks.length > 0 && (
                          <div className="text-right">
                            <p className="text-xs font-medium text-muted-foreground">Door Lock</p>
                            <div className="flex items-center gap-1.5 justify-end mt-0.5">
                              {rr.room.doorLocks[0].status === 'ONLINE'
                                ? <Wifi className="h-3 w-3 text-emerald-500" />
                                : <WifiOff className="h-3 w-3 text-red-400" />}
                              <span className="text-xs font-mono text-muted-foreground">
                                {rr.room.doorLocks[0].lockCode}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Special requests */}
            {reservation.specialRequests && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Special Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{reservation.specialRequests}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right column ───────────────────────────────── */}
          <div className="space-y-5">

            {/* Active Keys Panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" /> Key Card History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reservation.lockOperations.length === 0 ? (
                  <div className="text-center py-4">
                    <KeyRound className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No key cards issued yet</p>
                    {canCheckIn && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowCheckIn(true)}
                        id="btn-issue-card-empty"
                      >
                        Issue Key Card
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reservation.lockOperations.map((op) => {
                      const meta = OP_STATUS_META[op.status] ?? { color: 'text-muted-foreground', label: op.status };
                      const isActive = op.status === 'ACTIVE';
                      const isRevoked = op.status === 'REVOKED';
                      return (
                        <div
                          key={op.id}
                          className={`p-3 rounded-lg border space-y-1.5 transition-colors ${isActive ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : isRevoked ? 'bg-muted/10 opacity-60' : 'bg-muted/20'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {isActive
                                ? <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
                                : isRevoked
                                  ? <ShieldOff className="h-3.5 w-3.5 text-slate-400" />
                                  : <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-xs font-medium capitalize">
                                {op.operation === 'ENCODE_CARD' ? 'Key Card' : op.operation.replace(/_/g, ' ').toLowerCase()}
                              </span>
                            </div>
                            <span className={`text-xs font-semibold ${meta.color}`}>
                              {IN_PROGRESS_STATUSES.includes(op.status) && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                              {meta.label}
                            </span>
                          </div>
                          {op.credentialId && (
                            <p className="text-xs text-muted-foreground font-mono">
                              ID: {op.credentialId.slice(0, 8)}…
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">{formatDateTime(op.requestedAt)}</p>
                          {op.errorMessage && (
                            <p className="text-xs text-red-500">{op.errorMessage}</p>
                          )}
                        </div>
                      );
                    })}

                    {/* Additional key shortcut */}
                    {isCheckedIn && hasActiveCredential && !hasInProgressOp && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1 gap-1.5"
                        onClick={() => additionalKeyMutation.mutate()}
                        disabled={additionalKeyMutation.isPending}
                        id="btn-additional-key-card"
                      >
                        {additionalKeyMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <PlusCircle className="h-3.5 w-3.5" />}
                        Issue Additional Key
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Booking details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  { label: 'Source',   value: reservation.source.replace('_', ' ') },
                  { label: 'Currency', value: reservation.currency },
                  { label: 'Late CO',  value: reservation.lateCheckOut ? 'Yes' : 'No' },
                  { label: 'Early CI', value: reservation.earlyCheckIn ? 'Yes' : 'No' },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium">{r.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Check-In Modal */}
      {showCheckIn && (
        <CheckInModal
          reservationId={reservation.id}
          guestName={guestName}
          roomNumber={roomNumber}
          onClose={() => setShowCheckIn(false)}
          onSuccess={() => {
            setShowCheckIn(false);
            refetch();
          }}
        />
      )}
    </>
  );
}
