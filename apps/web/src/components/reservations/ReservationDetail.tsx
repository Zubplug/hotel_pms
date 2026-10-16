'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardInformationSection } from './CardInformationSection';
import { FolioSection } from './FolioSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReservationTimeline } from './ReservationTimeline';
import { GuestHistory } from './GuestHistory';
import { Calendar, User, DoorClosed, Clock, FileText, AlertCircle, KeySquare, XCircle, ShieldAlert, Loader2, Ban } from 'lucide-react';
import { CancelReservationDialog } from './CancelReservationDialog';

const GM_ROLES = new Set([
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
  'MANAGER',
  'CEO',
  'DIRECTOR',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationDetail({ reservation }: { reservation: any }) {
  const { data: session } = useSession();
  const userRole = String((session?.user as any)?.role || '').toUpperCase();
  const isGM = GM_ROLES.has(userRole) || !!(session?.user as any)?.isSuperAdmin;

  // Cancel discount dialog state
  const [showCancelDiscount, setShowCancelDiscount] = useState(false);
  const [cancelDiscountLoading, setCancelDiscountLoading] = useState(false);
  const [cancelDiscountError, setCancelDiscountError] = useState<string | null>(null);
  const [cancelDiscountDone, setCancelDiscountDone] = useState(false);

  // Cancel reservation dialog state
  const [showCancelReservation, setShowCancelReservation] = useState(false);

  // Detect whether an active approved discount exists on this reservation.
  // A discount can be on: (a) a ReservationRoom row (discountType set), or
  // (b) a DISCOUNT-type FolioItem in one of the folios.
  const hasRoomDiscount = (reservation.reservationRooms || []).some(
    (r: any) => r.discountType,
  );
  const hasFolioDiscount = (reservation.folios || []).some((f: any) =>
    (f.items || []).some((i: any) => i.type === 'DISCOUNT' && !i.voidedAt),
  );
  const hasActiveDiscount = hasRoomDiscount || hasFolioDiscount;
  const isCorporate = !!reservation.corporateAccountId;
  // Button is for NON-corporate reservations only — corporate accounts have a
  // separate city-ledger billing flow; regular reservations bill directly.
  const showCancelDiscountBtn = isGM && !isCorporate && hasActiveDiscount && !cancelDiscountDone;

  // Cancel reservation: visible to any logged-in user who can see this page,
  // but only when the reservation is not already checked-in, checked-out, or cancelled.
  const nonCancellableStatuses = ['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
  const canCancelReservation = !nonCancellableStatuses.includes(reservation.status);

  const handleCancelDiscount = async () => {
    setCancelDiscountLoading(true);
    setCancelDiscountError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/discount`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        setCancelDiscountError(json?.error || json?.message || 'Failed to cancel discount.');
      } else {
        setCancelDiscountDone(true);
        setShowCancelDiscount(false);
        // Reload the page so the folio ledger reflects the reversal.
        window.location.reload();
      }
    } catch {
      setCancelDiscountError('An unexpected error occurred. Please try again.');
    } finally {
      setCancelDiscountLoading(false);
    }
  };
  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;

  // Determine if key card needs extension
  const activeCredential = reservation.lockCredentials?.[0];
  let keyNeedsExtension = false;
  
  if (reservation.status === 'CHECKED_IN' && activeCredential?.validUntil && resRoom?.checkOut) {
    const cardValidUntil = new Date(activeCredential.validUntil);
    const reservationCheckOut = new Date(resRoom.checkOut);
    
    // Normalize to date for comparison
    const cardDateStr = format(cardValidUntil, 'yyyy-MM-dd');
    const resDateStr = format(reservationCheckOut, 'yyyy-MM-dd');
    
    if (cardDateStr < resDateStr) {
      keyNeedsExtension = true;
    }
  }

  return (
    <div className="space-y-6">
      {keyNeedsExtension && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 sm:mt-0 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-400">Key card requires extension</p>
              <p className="text-sm text-amber-800 dark:text-amber-500">
                The physical key expires on {format(new Date(activeCredential.validUntil), 'PPP')}, but the reservation expires on {format(new Date(resRoom.checkOut), 'PPP')}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-card to-muted/20 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Reservation #{reservation.id.slice(0, 8).toUpperCase()}</h1>
            <Badge variant={reservation.status === 'CONFIRMED' ? 'default' : reservation.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
              {reservation.status}
            </Badge>
            {isCorporate && (
              <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-500 dark:text-blue-300">
                Corporate
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" /> Created on {format(new Date(reservation.createdAt), 'PPP')}
          </p>
        </div>

        {/* GM-only: Cancel approved discount */}
        {showCancelDiscountBtn && (
          <div className="shrink-0">
            <Button
              id="cancel-approved-discount-btn"
              variant="outline"
              size="sm"
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/60 dark:text-rose-400 dark:hover:bg-rose-900/20"
              onClick={() => { setCancelDiscountError(null); setShowCancelDiscount(true); }}
            >
              <XCircle className="w-4 h-4" />
              Cancel Approved Discount
            </Button>
          </div>
        )}

        {/* Cancel reservation */}
        {canCancelReservation && (
          <div className="shrink-0">
            <Button
              id="cancel-reservation-btn"
              variant="outline"
              size="sm"
              className="gap-2 border-red-400 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-500/60 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => setShowCancelReservation(true)}
            >
              <Ban className="w-4 h-4" />
              Cancel Reservation
            </Button>
          </div>
        )}
      </div>

      {/* Cancel-discount confirmation dialog */}
      {showCancelDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-800/50 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cancel Approved Discount</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  This will permanently revoke the approved discount on this reservation and restore the original room rate. The folio will be updated immediately.
                </p>
                <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                  ⚠ This action is irreversible. A new discount request must be submitted and approved if a discount is still required.
                </p>
                {cancelDiscountError && (
                  <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{cancelDiscountError}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={cancelDiscountLoading}
                onClick={() => { setShowCancelDiscount(false); setCancelDiscountError(null); }}
              >
                Keep Discount
              </Button>
              <Button
                id="confirm-cancel-discount-btn"
                size="sm"
                disabled={cancelDiscountLoading}
                className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => void handleCancelDiscount()}
              >
                {cancelDiscountLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Cancelling…</>
                ) : (
                  <><XCircle className="h-4 w-4" /> Yes, Cancel Discount</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel reservation dialog */}
      <CancelReservationDialog
        open={showCancelReservation}
        onOpenChange={setShowCancelReservation}
        reservation={reservation}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keycards" className="flex items-center gap-1.5">
            <KeySquare className="w-3.5 h-3.5" /> Key Cards
            {reservation.lockCredentials?.some((c: any) => c.status === 'ACTIVE') && (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Guest History</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Guest Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Guest Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-lg font-semibold">{guest?.firstName} {guest?.lastName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{guest?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p>{guest?.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Document ID</p>
              <p>{guest?.documentNumber || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Stay Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Stay Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Check-in</p>
                <p className="font-medium">{resRoom?.checkIn ? format(new Date(resRoom.checkIn), 'PPP') : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Check-out</p>
                <p className="font-medium">{resRoom?.checkOut ? format(new Date(resRoom.checkOut), 'PPP') : 'N/A'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DoorClosed className="w-4 h-4" /> Room
                </p>
                <p className="font-medium">{room?.number || 'Unassigned'} ({room?.roomType?.name})</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Occupants</p>
                <p className="font-medium">{resRoom?.adults} Adults, {resRoom?.children} Children</p>
              </div>
            </div>
            {reservation.specialRequests && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Special Requests
                </p>
                <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{reservation.specialRequests}</p>
              </div>
            )}
          </CardContent>
        </Card>

          </div>
          <FolioSection reservation={reservation} readOnly />
        </TabsContent>

        <TabsContent value="keycards">
          <CardInformationSection reservation={reservation} readOnly />
        </TabsContent>

        <TabsContent value="history">
          <GuestHistory guest={guest} readOnly />
        </TabsContent>

        <TabsContent value="timeline">
          <ReservationTimeline auditLogs={reservation.auditLogs || []} />
        </TabsContent>
      </Tabs>

    </div>
  );
}
