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
import { Calendar, User, DoorClosed, CreditCard, Clock, Settings, FileText, LogIn } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationDetail({ reservation }: { reservation: any }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);

  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;

  const isEditable = reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && reservation.status !== 'CANCELLED';
  const isCancellable = reservation.status === 'CONFIRMED';

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="space-y-6">
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
          <Button variant="outline" onClick={() => setIsReassignDialogOpen(true)} disabled={!isEditable}>
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

        {/* Financial Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Billing Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nightly Rate</p>
              <p className="text-lg">{resRoom?.rateAmount ? formatCurrency(resRoom.rateAmount, 'NGN') : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <p className="text-2xl font-bold">{(reservation.ratePlanSnapshot as any)?.total ? formatCurrency((reservation.ratePlanSnapshot as any).total, 'NGN') : 'N/A'}</p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
              <Badge variant="outline" className="mt-1 uppercase">{reservation.paymentStatus}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
