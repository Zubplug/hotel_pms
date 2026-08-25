'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PlusCircle, Wallet, ArrowRightLeft, CornerDownRight, Printer } from 'lucide-react';
import { AddPaymentDialog } from './AddPaymentDialog';
import { RefundDialog } from './RefundDialog';
import { FrontDeskAddPaymentDialog } from '../frontdesk/FrontDeskAddPaymentDialog';
import { FrontDeskRefundDialog } from '../frontdesk/FrontDeskRefundDialog';
import { FrontDeskQuickCheckoutDialog } from '../frontdesk/FrontDeskQuickCheckoutDialog';
import { usePathname } from 'next/navigation';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

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
      <Card className="mt-6 overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b bg-slate-50 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-bold sm:text-xl">
              <Wallet className="w-5 h-5" /> Folio Ledger
            </CardTitle>
            <Badge variant={isClosed ? 'secondary' : 'default'} className="uppercase">
              {folio.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && (
              <>
                <Button size="sm" onClick={() => setIsAddPaymentOpen(true)}>
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
          <div className="grid grid-cols-1 divide-y border-b bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            <div className="min-w-0 p-4 text-center sm:p-5">
              <p className="text-sm text-muted-foreground mb-1">Total Charges</p>
              <p className="whitespace-nowrap text-xl font-semibold tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(totalCharges)}</p>
            </div>
            <div className="min-w-0 p-4 text-center sm:p-5">
              <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
              <p className="whitespace-nowrap text-xl font-semibold tabular-nums text-emerald-600 sm:text-2xl">{formatCurrency(folio.totalPayments)}</p>
            </div>
            <div className="min-w-0 bg-slate-50/50 p-4 text-center sm:p-5">
              <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
              <p className={`whitespace-nowrap text-xl font-bold tabular-nums sm:text-2xl ${Number(folio.balance) > 0 ? 'text-red-600' : Number(folio.balance) < 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {formatCurrency(folio.balance)}
              </p>
            </div>
            <div className="min-w-0 bg-blue-50/40 p-4 text-center sm:p-5">
              <p className="text-sm text-muted-foreground mb-1">Available Credit</p>
              <p className="whitespace-nowrap text-xl font-bold tabular-nums text-blue-700 sm:text-2xl">{formatCurrency(folio.availableCredit || 0)}</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50/50 border-b text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Debit (Charge)</th>
                  <th className="px-6 py-3 text-right">Credit (Payment)</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                          {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={item.type === 'CHARGE' ? 'outline' : item.type === 'PAYMENT' ? 'default' : 'secondary'} className="text-[10px]">
                            {item.type}
                          </Badge>
                          {item.creditStatus && <Badge variant="secondary" className="ml-1 text-[10px]">{item.creditStatus}</Badge>}
                        </td>
                        <td className="px-6 py-3 text-slate-800 font-medium max-w-[250px] truncate" title={item.description}>
                          {item.description}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-right tabular-nums">
                          {isDebit ? formatCurrency(absAmount) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-right font-medium tabular-nums text-emerald-600">
                          {isCredit ? formatCurrency(absAmount) : '-'}
                        </td>
                        <td className="px-6 py-3 text-center flex justify-end gap-2">
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
                                      roomNumber: reservation.reservationRooms?.[0]?.room?.number || 'N/A',
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
