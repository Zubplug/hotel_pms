'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FrontDeskCheckInDialog } from './FrontDeskCheckInDialog';
import { FrontDeskEditReservationDialog } from './FrontDeskEditReservationDialog';
import { FrontDeskReassignRoomDialog } from './FrontDeskReassignRoomDialog';
import { FrontDeskCancelReservationDialog } from './FrontDeskCancelReservationDialog';
import { FolioSection } from '../reservations/FolioSection';
import { LogIn, User, MapPin, CalendarClock, CreditCard, Receipt, LogOut, ChevronDown, Edit3, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function FrontDeskReservationDetail({ reservation }: { reservation: any }) {
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;
  const folio = reservation.folio;

  const balance = folio?.balance || 0;
  const isPaid = balance <= 0;
  const canCheckIn = reservation.status === 'CONFIRMED' && room;
  const canCheckOut = reservation.status === 'CHECKED_IN';

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CHECKED_IN': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CHECKED_OUT': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'CONFIRMED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Banner / Status */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Folio #{reservation.id.slice(0, 8).toUpperCase()}</h2>
          <p className="text-slate-500 font-medium">Created on {format(new Date(reservation.createdAt), 'PPP')}</p>
        </div>
        <Badge variant="outline" className={`px-4 py-1.5 rounded-full font-bold text-sm shadow-sm ${getStatusColor(reservation.status)}`}>
          {reservation.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANE - Context & Operations */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Guest Profile Card */}
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xl uppercase">
                {guest?.firstName?.[0]}{guest?.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{guest?.firstName} {guest?.lastName}</h3>
                <p className="text-slate-500 text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Guest
                </p>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact</p>
                <p className="font-medium text-slate-700">{guest?.phone || 'No phone provided'}</p>
                <p className="text-sm text-slate-500">{guest?.email || 'No email'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Stay Info Card */}
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white">
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Room Assignment</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <span className="text-xl font-bold text-slate-900">Room {room?.number || 'Unassigned'}</span>
                  {room && <span className="text-sm text-slate-500 font-medium">({room.roomType?.name})</span>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-In</p>
                  <p className="font-bold text-slate-800">{resRoom?.checkIn ? format(new Date(resRoom.checkIn), 'MMM d, yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-Out</p>
                  <p className="font-bold text-slate-800">{resRoom?.checkOut ? format(new Date(resRoom.checkOut), 'MMM d, yyyy') : 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Quick Actions</p>
            {canCheckIn && (
              <Button onClick={() => setIsCheckInDialogOpen(true)} className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-sm">
                <LogIn className="w-5 h-5 mr-2" /> Check In
              </Button>
            )}
            {canCheckOut && (
              <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-sm">
                <LogOut className="w-5 h-5 mr-2" /> Check Out
              </Button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 rounded-xl font-semibold border-slate-200">
                <CreditCard className="w-4 h-4 mr-2" /> Add Payment
              </Button>
              <Button variant="outline" className="h-12 rounded-xl font-semibold border-slate-200">
                <CalendarClock className="w-4 h-4 mr-2" /> Extend Stay
              </Button>
              <Button variant="outline" className="col-span-2 h-12 rounded-xl font-semibold border-slate-200">
                <Receipt className="w-4 h-4 mr-2" /> Print Receipt
              </Button>

              {reservation.status === 'CONFIRMED' && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="col-span-2 h-12 rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-sm shadow-sm transition-colors w-full">
                    Manage Reservation <ChevronDown className="w-4 h-4 ml-2" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-xl">
                    <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsEditDialogOpen(true)}>
                      <Edit3 className="w-4 h-4 mr-2 text-slate-500" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsReassignDialogOpen(true)}>
                      <MapPin className="w-4 h-4 mr-2 text-slate-500" /> Reassign Room
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem className="rounded-lg p-3 cursor-pointer text-red-600 font-semibold focus:text-red-700 focus:bg-red-50" onClick={() => setIsCancelDialogOpen(true)}>
                      <XCircle className="w-4 h-4 mr-2" /> Cancel Reservation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
        </div>

        {/* RIGHT PANE - Financial POS Style */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            
            {/* POS Total Header */}
            <div className={`p-8 border-b flex justify-between items-center ${isPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPaid ? 'Fully Settled' : 'Outstanding Balance'}
                </p>
                <div className={`text-4xl font-black tracking-tight mt-1 ${isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(balance)}
                </div>
              </div>
            </div>

            {/* Existing Folio Component embedded nicely */}
            <div className="p-8 flex-1 bg-slate-50">
              <FolioSection reservation={reservation} />
            </div>

          </div>
        </div>

      </div>

      {isCheckInDialogOpen && (
        <FrontDeskCheckInDialog
          reservationId={reservation.id}
          propertyId={reservation.propertyId}
          open={isCheckInDialogOpen}
          onOpenChange={setIsCheckInDialogOpen}
        />
      )}
      
      {isEditDialogOpen && (
        <FrontDeskEditReservationDialog
          reservation={reservation}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}

      {isReassignDialogOpen && (
        <FrontDeskReassignRoomDialog
          reservation={reservation}
          open={isReassignDialogOpen}
          onOpenChange={setIsReassignDialogOpen}
        />
      )}

      {isCancelDialogOpen && (
        <FrontDeskCancelReservationDialog
          reservation={reservation}
          open={isCancelDialogOpen}
          onOpenChange={setIsCancelDialogOpen}
        />
      )}
    </div>
  );
}
