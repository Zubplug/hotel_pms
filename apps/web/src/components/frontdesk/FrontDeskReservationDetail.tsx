'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FrontDeskCheckInDialog } from './FrontDeskCheckInDialog';
import { FrontDeskEditReservationDialog } from './FrontDeskEditReservationDialog';
import { FrontDeskReassignRoomDialog } from './FrontDeskReassignRoomDialog';
import { FrontDeskCancelReservationDialog } from './FrontDeskCancelReservationDialog';
import { NoShowActions } from '../reservations/NoShowActions';
import { FrontDeskAddPaymentDialog } from './FrontDeskAddPaymentDialog';
import { FrontDeskExtendStayDialog } from './FrontDeskExtendStayDialog';
import { FrontDeskQuickCheckoutDialog } from './FrontDeskQuickCheckoutDialog';
import { FrontDeskReceiptDialog } from './FrontDeskReceiptDialog';
import { FrontDeskDiscountModal } from './FrontDeskDiscountModal';
import { FrontDeskComplimentaryModal } from './FrontDeskComplimentaryModal';
import { FolioSection } from '../reservations/FolioSection';
import { FrontDeskCardInformationSection } from './FrontDeskCardInformationSection';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { toast } from 'sonner';
import { formatRoomNumber } from '@/lib/format-room';
import { LogIn, User, MapPin, CalendarClock, CreditCard, Receipt, LogOut, ChevronDown, Edit3, XCircle, Loader2, Percent } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function FrontDeskReservationDetail({ reservation }: { reservation: any }) {
  const queryClient = useQueryClient();
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isExtendStayOpen, setIsExtendStayOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isQuickCheckoutOpen, setIsQuickCheckoutOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isComplimentaryOpen, setIsComplimentaryOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;
  const folio = reservation.folio || reservation.folios?.[0];

  const balance = folio?.balance || 0;
  const isPaid = balance <= 0;
  const canCheckIn = reservation.status === 'CONFIRMED' && room;
  const canCheckOut = reservation.status === 'CHECKED_IN';
  const canAddPayment = ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status) && !!folio;
  const canExtendStay = reservation.status === 'CHECKED_IN';
  const canReassignRoom = ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status);
  const canEditReservation = reservation.status === 'CONFIRMED';
  const canCancelReservation = reservation.status === 'CONFIRMED';
  const canManageReservation = canEditReservation || canReassignRoom || canCancelReservation;
  
  const latestPayment = folio?.payments?.filter((p: any) => p.status === 'COMPLETED' || p.status === 'REFUNDED').sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // On desktop: fire directly to the thermal printer.
  // On web: open the A4 FrontDeskReceiptDialog.
  const handlePrintReceipt = async () => {
    if (!latestPayment) return;
    if (HardwareBridge.isAvailable()) {
      setIsPrinting(true);
      try {
        const res = await HardwareBridge.printPaymentReceipt({
          receiptNumber: latestPayment.reference || latestPayment.id.substring(0, 8).toUpperCase(),
          guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Guest',
          roomNumber: formatRoomNumber(room?.number) || 'N/A',
          folioNumber: folio?.id?.substring(0, 8).toUpperCase() || '',
          amountPaid: Math.abs(Number(latestPayment.amount)),
          paymentMethod: latestPayment.method || 'CASH',
          paymentReference: latestPayment.reference || latestPayment.providerTransactionId,
          previousBalance: Number(folio?.balance || 0) + Math.abs(Number(latestPayment.amount)),
          remainingBalance: Number(folio?.balance || 0),
          cashierName: latestPayment.receivedByName || 'Front Desk',
          currency: folio?.currency || 'NGN',
          propertyName: reservation.property?.name || 'LodgeCore',
          propertyAddress: reservation.property?.address,
          printedAt: new Date().toISOString(),
        });
        if (res?.success) {
          toast.success('Receipt printed successfully');
        } else {
          toast.error(`Printer error: ${res?.error || 'Unknown error'}`);
        }
      } catch (e: any) {
        toast.error(`Printer error: ${e?.message || String(e)}`);
      } finally {
        setIsPrinting(false);
      }
    } else {
      // Web fallback — show A4 receipt dialog
      setIsReceiptOpen(true);
    }
  };

  const formatCurrency = (amount: number, currency?: string | null) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN', maximumFractionDigits: 0 }).format(amount);
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

              {/* Rate & Discount display */}
              {(() => {
                let finalRate = Number(resRoom?.rateAmount || 0);
                if (resRoom?.discountType === 'FIXED_AMOUNT') {
                  finalRate -= Number(resRoom?.discountAmount || 0);
                } else if (resRoom?.discountType === 'PERCENTAGE') {
                  finalRate -= finalRate * (Number(resRoom?.discountPercent || 0) / 100);
                } else if (resRoom?.discountType === 'COMPLIMENTARY') {
                  const compAmount = Number(resRoom?.discountAmount || 0);
                  if (compAmount > 0) {
                    finalRate -= compAmount;
                  } else {
                    finalRate = 0;
                  }
                } else if (resRoom?.discountAmount > 0 && !resRoom?.discountPercent) {
                  finalRate -= Number(resRoom?.discountAmount || 0);
                } else if (resRoom?.discountPercent > 0) {
                  finalRate -= finalRate * (Number(resRoom?.discountPercent || 0) / 100);
                }
                finalRate = Math.max(0, finalRate);

                return (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nightly Rate</p>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-lg">{formatCurrency(finalRate)}</p>
                        {Number(resRoom?.rateAmount || 0) > finalRate && (
                          <span className="text-sm text-slate-400 line-through">
                            {formatCurrency(Number(resRoom?.rateAmount || 0))}
                          </span>
                        )}
                        {resRoom?.discountAmount > 0 && resRoom?.discountType !== 'PERCENTAGE' && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            -{formatCurrency(Number(resRoom?.discountAmount || 0))} discount
                          </Badge>
                        )}
                        {resRoom?.discountPercent > 0 && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            -{resRoom?.discountPercent}% discount
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

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
              <Button onClick={() => setIsQuickCheckoutOpen(true)} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-sm">
                <LogOut className="w-5 h-5 mr-2" /> Check Out
              </Button>
            )}
            <div className="grid grid-cols-2 gap-3">
              {canAddPayment && (
                <Button variant="outline" className="h-12 rounded-xl font-semibold border-slate-200" onClick={() => setIsAddPaymentOpen(true)}>
                  <CreditCard className="w-4 h-4 mr-2" /> Add Payment
                </Button>
              )}
              {canExtendStay && (
                <Button variant="outline" className="h-12 rounded-xl font-semibold border-slate-200" onClick={() => setIsExtendStayOpen(true)}>
                  <CalendarClock className="w-4 h-4 mr-2" /> Extend Stay
                </Button>
              )}
              {latestPayment && (
                <Button
                  variant="outline"
                  disabled={isPrinting}
                  className={`${canAddPayment || canExtendStay ? 'col-span-2' : ''} h-12 rounded-xl font-semibold border-slate-200`}
                  onClick={handlePrintReceipt}
                >
                  {isPrinting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Printing...</>
                    : <><Receipt className="w-4 h-4 mr-2" /> Print Receipt</>}
                </Button>
              )}

              {canManageReservation && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="col-span-2 h-12 rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-sm shadow-sm transition-colors w-full">
                    Manage Reservation <ChevronDown className="w-4 h-4 ml-2" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-xl">
                    {canEditReservation && <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsEditDialogOpen(true)}>
                      <Edit3 className="w-4 h-4 mr-2 text-slate-500" /> Edit Details
                    </DropdownMenuItem>}
                    {canReassignRoom && <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsReassignDialogOpen(true)}>
                      <MapPin className="w-4 h-4 mr-2 text-slate-500" /> Reassign Room
                    </DropdownMenuItem>}
                    {canCancelReservation && <>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem className="rounded-lg p-3 cursor-pointer text-red-600 font-semibold focus:text-red-700 focus:bg-red-50" onClick={() => setIsCancelDialogOpen(true)}>
                        <XCircle className="w-4 h-4 mr-2" /> Cancel Reservation
                      </DropdownMenuItem>
                    </>}
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
            <div className="p-8 flex-1 bg-slate-50 space-y-8">
              {(reservation.status === 'CONFIRMED' || reservation.status === 'NO_SHOW') && (
                <NoShowActions
                  reservation={reservation}
                  onUpdated={() => queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })}
                />
              )}
              <FolioSection reservation={reservation} />
              <FrontDeskCardInformationSection reservation={reservation} />
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

      {isAddPaymentOpen && folio && (
        <FrontDeskAddPaymentDialog folio={folio} open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen} />
      )}
      {isExtendStayOpen && (
        <FrontDeskExtendStayDialog reservation={reservation} open={isExtendStayOpen} onOpenChange={setIsExtendStayOpen} />
      )}
      {isReceiptOpen && latestPayment && (
        <FrontDeskReceiptDialog
          paymentId={latestPayment.id}
          open={isReceiptOpen}
          onOpenChange={setIsReceiptOpen}
          localData={{
            receiptId: latestPayment.reference || `RCPT-${latestPayment.id.substring(0, 8).toUpperCase()}`,
            property: reservation.property || { name: 'LodgeCore' },
            guest: guest ? { name: `${guest.firstName} ${guest.lastName}`, email: guest.email } : null,
            reservation: {
              confirmationNumber: reservation.confirmationNumber,
              roomNumber: formatRoomNumber(room?.number) || 'Unassigned',
              checkIn: reservation.checkIn,
              checkOut: reservation.checkOut,
            },
            folio: {
              id: folio.id,
              totalCharges: Number(folio.totalCharges || 0),
              totalPayments: Number(folio.totalPayments || 0),
              balance: Number(folio.balance || 0),
            },
            payment: {
              ...latestPayment,
              date: latestPayment.createdAt,
              amount: Number(latestPayment.amount),
              providerTransactionId: latestPayment.providerTransactionId || latestPayment.reference,
            },
          }}
        />
      )}
      {isQuickCheckoutOpen && (
        <FrontDeskQuickCheckoutDialog
          open={isQuickCheckoutOpen}
          onOpenChange={setIsQuickCheckoutOpen}
          propertyId={reservation.propertyId}
          initialReservation={reservation}
        />
      )}
      
      {isDiscountOpen && resRoom && (
        <FrontDeskDiscountModal
          isOpen={isDiscountOpen}
          targetType="RESERVATION_ROOM"
          targetId={resRoom.id}
          targetTotal={Number(resRoom.rateAmount || 0)}
          onClose={() => setIsDiscountOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
            setIsDiscountOpen(false);
          }}
        />
      )}
      
      {isComplimentaryOpen && resRoom && (
        <FrontDeskComplimentaryModal
          isOpen={isComplimentaryOpen}
          targetType="RESERVATION_ROOM"
          targetId={resRoom.id}
          targetTotal={Number(resRoom.rateAmount || 0)}
          onClose={() => setIsComplimentaryOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
            setIsComplimentaryOpen(false);
          }}
        />
      )}
    </div>
  );
}
