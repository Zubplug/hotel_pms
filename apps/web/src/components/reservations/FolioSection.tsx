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
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold sm:text-xl">Folio Ledger</CardTitle>
              <p className="mt-0.5 text-xs text-slate-300">Charges, payments and credits for this stay</p>
            </div>
            <Badge className="border-white/20 bg-white/10 text-white uppercase" variant="outline">
              {folio.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 [&_button]:border-white/20 [&_button]:text-white [&_button]:hover:bg-white/10">
            {!isClosed && (
              <>
                <Button size="sm" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => setIsAddPaymentOpen(true)}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Add Payment
                </Button>
                {isFrontDesk && (
                  <Button size="sm" variant="outline" onClick={() => setIsAddDepositOpen(true)}>
                    <Wallet className="w-4 h-4 mr-2" /> Add Deposit/Credit
                  </Button>
                )}
              </>
            )}
            {reservation.status === 'CHECKED_IN' && !isClosed && (
              <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setIsCheckOutOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Check Out
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 gap-3 border-b bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total charges</p><TrendingUp className="h-4 w-4 text-slate-400" /></div>
              <p className="whitespace-nowrap text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{formatCurrency(totalCharges)}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total payments</p><Wallet className="h-4 w-4 text-emerald-600" /></div>
              <p className="whitespace-nowrap text-xl font-bold tabular-nums text-emerald-700 sm:text-2xl">{formatCurrency(folio.totalPayments)}</p>
            </div>
            <div className={`rounded-xl border p-4 shadow-sm ${outstandingBalance > 0 ? 'border-rose-100 bg-rose-50/70' : 'border-slate-200 bg-white'}`}>
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding</p><TrendingDown className="h-4 w-4 text-slate-400" /></div>
              <p className={`whitespace-nowrap text-xl font-bold tabular-nums sm:text-2xl ${outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatCurrency(outstandingBalance)}
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Available credit</p><CornerDownRight className="h-4 w-4 text-blue-600" /></div>
              <p className="whitespace-nowrap text-xl font-bold tabular-nums text-blue-700 sm:text-2xl">{formatCurrency(availableCredit)}</p>
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
                        <td className="flex justify-end gap-2 px-6 py-4 text-center">
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
