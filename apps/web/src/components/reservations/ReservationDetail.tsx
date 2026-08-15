'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditReservationDialog } from './EditReservationDialog';
import { RoomReassignmentDialog } from './RoomReassignmentDialog';
import { CancelReservationDialog } from './CancelReservationDialog';
import { CheckInDialog } from './CheckInDialog';
import { ExtendStayDialog } from './ExtendStayDialog';
import { ExtendKeyCardDialog } from './ExtendKeyCardDialog';
import { CardInformationSection } from './CardInformationSection';
import { FolioSection } from './FolioSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReservationTimeline } from './ReservationTimeline';
import { GuestHistory } from './GuestHistory';
import { Calendar, User, DoorClosed, Clock, Settings, FileText, LogIn, CalendarClock, AlertCircle, KeySquare } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationDetail({ reservation }: { reservation: any }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isExtendStayDialogOpen, setIsExtendStayDialogOpen] = useState(false);
  const [isExtendKeyCardDialogOpen, setIsExtendKeyCardDialogOpen] = useState(false);

  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;

  const isEditable = reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && reservation.status !== 'CANCELLED';
  const isCancellable = reservation.status === 'CONFIRMED';
  const canExtendStay = reservation.status === 'CHECKED_IN';

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

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
          <Button variant="outline" className="shrink-0 bg-white dark:bg-transparent" onClick={() => setIsExtendKeyCardDialogOpen(true)}>
            Extend Key Card
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-card p-6 rounded-lg border shadow-sm">
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
        <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
          {reservation.status === 'CONFIRMED' && room && (
            <Button onClick={() => setIsCheckInDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <LogIn className="w-4 h-4 mr-2" /> Check In Guest
            </Button>
          )}
          {canExtendStay && (
            <Button onClick={() => setIsExtendStayDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CalendarClock className="w-4 h-4 mr-2" /> Extend Stay
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsReassignDialogOpen(true)} disabled={!isEditable && reservation.status !== 'CHECKED_IN'}>
            Reassign Room
          </Button>
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} disabled={!isEditable}>
            <Settings className="w-4 h-4 mr-2" /> Edit Details
          </Button>
          <Button variant="destructive" onClick={() => setIsCancelDialogOpen(true)} disabled={!isCancellable}>
            Cancel Reservation
          </Button>
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
          <FolioSection reservation={reservation} />
        </TabsContent>

        <TabsContent value="keycards">
          <CardInformationSection reservation={reservation} />
        </TabsContent>

        <TabsContent value="history">
          <GuestHistory guest={guest} />
        </TabsContent>

        <TabsContent value="timeline">
          <ReservationTimeline auditLogs={reservation.auditLogs || []} />
        </TabsContent>
      </Tabs>

      <EditReservationDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        reservation={reservation} 
      />
      <RoomReassignmentDialog 
        open={isReassignDialogOpen} 
        onOpenChange={setIsReassignDialogOpen} 
        reservation={reservation} 
      />
      <CancelReservationDialog 
        open={isCancelDialogOpen} 
        onOpenChange={setIsCancelDialogOpen} 
        reservation={reservation} 
      />
      <CheckInDialog
        open={isCheckInDialogOpen}
        onOpenChange={setIsCheckInDialogOpen}
        reservation={reservation}
      />
      <ExtendStayDialog
        open={isExtendStayDialogOpen}
        onOpenChange={setIsExtendStayDialogOpen}
        reservation={reservation}
      />
      <ExtendKeyCardDialog
        open={isExtendKeyCardDialogOpen}
        onOpenChange={setIsExtendKeyCardDialogOpen}
        reservation={reservation}
      />
    </div>
  );
}
