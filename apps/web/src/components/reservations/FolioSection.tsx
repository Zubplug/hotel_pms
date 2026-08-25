'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PlusCircle, Wallet, ArrowRightLeft, CornerDownRight, Printer, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { AddPaymentDialog } from './AddPaymentDialog';
import { RefundDialog } from './RefundDialog';
import { FrontDeskAddPaymentDialog } from '../frontdesk/FrontDeskAddPaymentDialog';
import { FrontDeskRefundDialog } from '../frontdesk/FrontDeskRefundDialog';
import { FrontDeskQuickCheckoutDialog } from '../frontdesk/FrontDeskQuickCheckoutDialog';
import { usePathname } from 'next/navigation';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';

export function FolioSection({ reservation }: { reservation: any }) {
  const pathname = usePathname();
  const isFrontDesk = pathname.startsWith('/frontdesk');
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);

  // For MVP, we assume 1 folio per reservation
  const folio = reservation.folios?.[0];

  if (!folio) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          No folio initialized for this reservation yet.
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: folio.currency || 'NGN' }).format(Number(amount));
  };

  const isClosed = folio.status === 'CLOSED';

  // Compute total charges dynamically from FolioItems if we want, or use the DB totalCharges/totalPayments/balance.
  // We use the DB authoritative values.
  const totalCharges = Number(folio.balance) + Number(folio.totalPayments);
  const outstandingBalance = Number(folio.balance);
  const availableCredit = Number(folio.availableCredit || 0);
  const ledgerItems = [
    ...(folio.items || []),
    ...(folio.credits || []).map((credit: any) => ({
      id: 'credit-' + credit.id,
      amount: Number(credit.amount || 0) * -1,
      type: credit.type || 'ADVANCE_DEPOSIT',
      description: credit.description || (credit.type === 'CREDIT_ADJUSTMENT' ? 'Folio credit' : 'Advance deposit') + (credit.method ? ' (' + credit.method + ')' : '') + (credit.reference ? ' — ' + credit.reference : ''),
      createdAt: credit.createdAt,
      creditStatus: credit.status,
      creditRemainingAmount: credit.remainingAmount,
    })),
  ].sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  return (
    <>
      <Card className="mt-6 overflow-hidden rounded-2xl border-slate-200 bg-white shadow-lg shadow-slate-200/50">
        <CardHeader className="flex flex-col gap-5 border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-5 py-5 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold sm:text-xl">Folio Ledger</CardTitle>
              <p className="mt-0.5 truncate text-xs text-slate-300">Charges, payments and credits for this stay</p>
            </div>
            <Badge className="shrink-0 border-white/20 bg-white/10 text-white uppercase" variant="outline">
              {folio.status}
            </Badge>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {!isClosed && (
              <>
                <Button
                  size="sm"
                  className="whitespace-nowrap bg-white text-slate-900 hover:bg-slate-100 shrink-0"
                  onClick={() => setIsAddPaymentOpen(true)}
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> Add Payment
                </Button>
                {isFrontDesk && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    onClick={() => setIsAddDepositOpen(true)}
                  >
                    <Wallet className="w-4 h-4 mr-2" /> Add Deposit/Credit
                  </Button>
                )}
              </>
            )}
            {reservation.status === 'CHECKED_IN' && !isClosed && (
              <Button
                size="sm"
                variant="outline"
                className="whitespace-nowrap shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setIsCheckOutOpen(true)}
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Check Out
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Summary Banner */}
          <div className="grid grid-cols-2 gap-3 border-b bg-slate-50/70 p-4 lg:grid-cols-4">
            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Total Charges</p>
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </div>
              <p className="w-full break-all font-bold leading-tight tabular-nums text-slate-900" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1.25rem)' }}>{formatCurrency(totalCharges)}</p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 shadow-sm sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-emerald-700 sm:text-xs">Total Payments</p>
                <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              </div>
              <p className="w-full break-all font-bold leading-tight tabular-nums text-emerald-700" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1.25rem)' }}>{formatCurrency(folio.totalPayments)}</p>
            </div>
            <div className={`min-w-0 overflow-hidden rounded-xl border p-3 shadow-sm sm:p-4 ${outstandingBalance > 0 ? 'border-rose-100 bg-rose-50/70' : 'border-slate-200 bg-white'}`}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Outstanding</p>
                <TrendingDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </div>
              <p className={`w-full break-all font-bold leading-tight tabular-nums ${outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-900'}`} style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1.25rem)' }}>
                {formatCurrency(outstandingBalance)}
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70 p-3 shadow-sm sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-blue-700 sm:text-xs">Available Credit</p>
                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              </div>
              <p className="w-full break-all font-bold leading-tight tabular-nums text-blue-700" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1.25rem)' }}>{formatCurrency(availableCredit)}</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="p-4 sm:p-6">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Debit (Charge)</th>
                  <th className="px-6 py-3 text-right">Credit (Payment)</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ledgerItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No transactions recorded.
                    </td>
                  </tr>
                ) : (
                  ledgerItems.map((item: any) => {
                    const isDebit = item.amount > 0;
                    const isCredit = item.amount < 0;
                    const absAmount = Math.abs(item.amount);

                    // Find if this folio item has a matching payment for refund button mapping
                    // (Assuming 1 payment per payment FolioItem - heuristic for UI display)
                    const linkedPayment = item.type === 'PAYMENT' 
                      ? folio.payments.find((p: any) => Math.abs(p.amount) === absAmount && new Date(p.createdAt).getTime() - new Date(item.createdAt).getTime() < 5000)
                      : null;

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-blue-50/40">
                        <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                          {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={item.type === 'CHARGE' ? 'outline' : item.type === 'PAYMENT' ? 'default' : 'secondary'} className="text-[10px]">
                            {item.type}
                          </Badge>
                          {item.creditStatus && <Badge variant="secondary" className="ml-1 text-[10px]">{item.creditStatus}</Badge>}
                        </td>
                        <td className="max-w-[300px] truncate px-6 py-4 font-medium text-slate-800" title={item.description}>
                          {item.description}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums">
                          {isDebit ? formatCurrency(absAmount) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right font-medium tabular-nums text-emerald-600">
                          {isCredit ? formatCurrency(absAmount) : '-'}
                        </td>
                        <td className="min-w-[190px] px-6 py-4 text-center">
                          <div className="flex flex-wrap justify-end gap-2">
                          {linkedPayment && (linkedPayment.status === 'COMPLETED' || linkedPayment.status === 'REFUNDED') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={async () => {
                                if (isFrontDesk) {
                                  // Use native ESC/POS printing on desktop
                                  try {
                                    await HardwareBridge.printPaymentReceipt({
                                      receiptNumber: linkedPayment.reference || linkedPayment.id.substring(0, 8).toUpperCase(),
                                      guestName: reservation.primaryGuest ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}` : 'Guest',
                                      roomNumber: formatRoomNumber(reservation.reservationRooms?.[0]?.room?.number) || 'N/A',
                                      folioNumber: folio.id.substring(0, 8).toUpperCase(),
                                      amountPaid: Math.abs(Number(linkedPayment.amount)),
                                      paymentMethod: linkedPayment.method || 'CASH',
                                      paymentReference: linkedPayment.reference,
                                      previousBalance: 0,
                                      remainingBalance: Number(folio.balance),
                                      cashierName: 'Staff',
                                      currency: folio.currency || 'NGN',
                                      propertyName: '',
                                      printedAt: new Date().toISOString(),
                                    });
                                  } catch {
                                    // Fallback to browser print if native fails
                                    window.open(`/frontdesk/payments/${linkedPayment.id}/receipt`, '_blank');
                                  }
                                } else {
                                  window.open(`/payments/${linkedPayment.id}/receipt`, '_blank');
                                }
                              }}
                            >
                              <Printer className="w-3 h-3 mr-1" /> Receipt
                            </Button>
                          )}
                          {linkedPayment && linkedPayment.status === 'COMPLETED' && !isClosed && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => setRefundPaymentId(linkedPayment.id)}
                            >
                              <CornerDownRight className="w-3 h-3 mr-1" /> Refund
                            </Button>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {pathname.startsWith('/frontdesk') ? (
        <FrontDeskAddPaymentDialog 
          open={isAddPaymentOpen} 
          onOpenChange={setIsAddPaymentOpen} 
          folio={folio} 
          onPaymentSuccess={() => window.location.reload()}
        />
      ) : (
        <AddPaymentDialog 
          open={isAddPaymentOpen} 
          onOpenChange={setIsAddPaymentOpen} 
          folio={folio} 
        />
      )}
      {isFrontDesk && (
        <FrontDeskAddPaymentDialog
          open={isAddDepositOpen}
          onOpenChange={setIsAddDepositOpen}
          folio={folio}
          mode="deposit"
          onPaymentSuccess={() => window.location.reload()}
        />
      )}
      
      {refundPaymentId && (
        pathname.startsWith('/frontdesk') ? (
          <FrontDeskRefundDialog
            open={!!refundPaymentId}
            onOpenChange={(open) => !open && setRefundPaymentId(null)}
            paymentId={refundPaymentId}
            folio={folio}
            reservation={reservation}
          />
        ) : (
          <RefundDialog
            open={!!refundPaymentId}
            onOpenChange={(open) => !open && setRefundPaymentId(null)}
            paymentId={refundPaymentId}
            folio={folio}
            reservation={reservation}
          />
        )
      )}
      <FrontDeskQuickCheckoutDialog
        open={isCheckOutOpen}
        onOpenChange={setIsCheckOutOpen}
        propertyId={reservation.propertyId}
        initialReservation={reservation}
      />
    </>
  );
}
