'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardInformationSection } from './CardInformationSection';
import { FolioSection } from './FolioSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReservationTimeline } from './ReservationTimeline';
import { GuestHistory } from './GuestHistory';
import { Calendar, User, DoorClosed, Clock, FileText, AlertCircle, KeySquare } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationDetail({ reservation }: { reservation: any }) {
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
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" /> Created on {format(new Date(reservation.createdAt), 'PPP')}
          </p>
        </div>
      </div>

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
