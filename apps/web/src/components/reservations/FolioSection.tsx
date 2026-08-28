'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PlusCircle, Wallet, ArrowRightLeft, CornerDownRight, Printer, Receipt, TrendingUp } from 'lucide-react';
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

  const totalCharges = Number(folio.totalCharges || 0);
  const totalPayments = Number(folio.totalPayments || 0);
  const outstandingBalance = Math.max(0, Number(folio.balance || 0));
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

  const findLinkedPayment = (item: any) => item.type === 'PAYMENT'
    ? folio.payments.find((payment: any) =>
      Math.abs(Number(payment.amount)) === Math.abs(Number(item.amount)) &&
      Math.abs(new Date(payment.createdAt).getTime() - new Date(item.createdAt).getTime()) < 5000,
    )
    : null;

  const printFolio = async () => {
    const transactions = ledgerItems.map((entry: any) => ({
      date: new Date(entry.createdAt || 0).toISOString(),
      description: entry.description || transactionLabel(entry.type),
      reference: entry.reference || null,
      debitAmount: Number(entry.amount || 0) > 0 ? Number(entry.amount) : 0,
      creditAmount: Number(entry.amount || 0) < 0 ? Math.abs(Number(entry.amount)) : 0,
      runningBalance: 0,
    }));
    const guestName = reservation.primaryGuest
      ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}`
      : 'Guest';
    const roomNumber = formatRoomNumber(reservation.reservationRooms?.[0]?.room?.number) || 'N/A';

    if (isFrontDesk && HardwareBridge.isAvailable()) {
      const result = await HardwareBridge.printGuestFolio({
        folioId: folio.id,
        guestName,
        version: Number(folio.version || 1),
        details: {
          guestName,
          roomNumber,
          folioNumber: folio.id.substring(0, 8).toUpperCase(),
          arrivalDate: reservation.checkIn,
          departureDate: reservation.checkOut,
          transactions,
          totalCharges,
          totalPayments,
          balanceDue: Number(folio.balance || 0),
          currency: folio.currency || 'NGN',
          propertyName: reservation.property?.name || '',
          printedAt: new Date().toISOString(),
        },
      });
      if (!result?.error) return;
    }
    window.print();
  };

  const renderItemActions = (item: any) => {
    const linkedPayment = findLinkedPayment(item);
    if (!linkedPayment) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          onClick={printFolio}
        >
          <Printer className="mr-1 h-3 w-3" /> Print folio
        </Button>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {(linkedPayment.status === 'COMPLETED' || linkedPayment.status === 'REFUNDED') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            onClick={async () => {
              if (isFrontDesk) {
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
                  window.open(`/frontdesk/payments/${linkedPayment.id}/receipt`, '_blank');
                }
              } else {
                window.open(`/payments/${linkedPayment.id}/receipt`, '_blank');
              }
            }}
          >
            <Printer className="mr-1 h-3 w-3" /> Reprint receipt
          </Button>
        )}
        {linkedPayment.status === 'COMPLETED' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            onClick={() => setRefundPaymentId(linkedPayment.id)}
          >
            <CornerDownRight className="mr-1 h-3 w-3" /> Refund payment
          </Button>
        )}
      </div>
    );
  };

  const transactionLabel = (type: string) => type.replaceAll('_', ' ');

  return (
    <>
      <Card className="mt-6 overflow-hidden rounded-2xl border-slate-200 bg-white shadow-lg shadow-slate-200/50">
        <CardHeader className="flex flex-col gap-5 border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-5 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
          <div className="border-b bg-slate-50 p-4 sm:p-6">
            <div className={`rounded-2xl p-5 text-white shadow-sm ${outstandingBalance > 0 ? 'bg-gradient-to-br from-rose-600 to-red-700' : 'bg-gradient-to-br from-emerald-600 to-teal-700'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">{outstandingBalance > 0 ? 'Amount due' : 'Folio settled'}</p>
                  <p className="mt-1 text-3xl font-black tracking-tight tabular-nums sm:text-4xl">{formatCurrency(outstandingBalance)}</p>
                </div>
                <Badge className="border-white/25 bg-white/15 px-3 py-1 text-white" variant="outline">
                  {outstandingBalance > 0 ? 'Payment required' : 'No balance due'}
                </Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-500"><TrendingUp className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-wider">Charges</p></div>
                <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{formatCurrency(totalCharges)}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 text-emerald-700"><Wallet className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-wider">Payments</p></div>
                <p className="mt-2 text-xl font-bold tabular-nums text-emerald-700">{formatCurrency(totalPayments)}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-center gap-2 text-blue-700"><CornerDownRight className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-wider">Credit available</p></div>
                <p className="mt-2 text-xl font-bold tabular-nums text-blue-700">{formatCurrency(availableCredit)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-bold text-slate-900">Transaction history</h3><p className="text-xs text-slate-500">{ledgerItems.length} posted transaction{ledgerItems.length === 1 ? '' : 's'}</p></div>
              <span className="text-xs font-medium text-slate-500">All amounts in {folio.currency || 'NGN'}</span>
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="w-full min-w-[820px] table-fixed text-left text-sm">
              <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-36 px-4 py-3">Date</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="w-44 px-4 py-3 text-right">Amount</th>
                  <th className="w-40 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ledgerItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No transactions recorded.
                    </td>
                  </tr>
                ) : (
                  ledgerItems.map((item: any) => {
                    const isDebit = item.amount > 0;
                    const absAmount = Math.abs(item.amount);

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-blue-50/40">
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                          {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                        </td>
                        <td className="min-w-0 px-4 py-4">
                          <div className="flex min-w-0 items-center gap-2">
                          <Badge variant={item.type === 'CHARGE' ? 'outline' : item.type === 'PAYMENT' ? 'default' : 'secondary'} className="shrink-0 whitespace-nowrap text-[10px]">
                            {transactionLabel(item.type)}
                          </Badge>
                          <p className="min-w-0 flex-1 break-words font-medium leading-5 text-slate-800" title={item.description}>{item.description}</p>
                          {item.creditStatus && <Badge variant="secondary" className="shrink-0 text-[10px]">{item.creditStatus}</Badge>}
                          </div>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums ${isDebit ? 'text-slate-900' : 'text-emerald-700'}`}>
                          <span className="mr-1 text-xs font-medium text-slate-400">{isDebit ? '+' : '−'}</span>{formatCurrency(absAmount)}
                        </td>
                        <td className="w-40 px-4 py-4"><div className="flex justify-end">{renderItemActions(item)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
            <div className="space-y-3 md:hidden">
              {ledgerItems.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No transactions recorded.</div> : ledgerItems.map((item: any) => {
                const isDebit = item.amount > 0;
                const absAmount = Math.abs(item.amount);
                return <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Badge variant={item.type === 'CHARGE' ? 'outline' : item.type === 'PAYMENT' ? 'default' : 'secondary'} className="text-[10px]">{item.type}</Badge><p className="mt-2 font-semibold text-slate-900">{item.description}</p><p className="mt-1 text-xs text-slate-500">{format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a')}</p></div><p className={`shrink-0 text-lg font-black tabular-nums ${isDebit ? 'text-slate-900' : 'text-emerald-700'}`}>{isDebit ? '+' : '−'}{formatCurrency(absAmount)}</p></div>
                  <div className="mt-3 border-t pt-3">{renderItemActions(item)}</div>
                </div>;
              })}
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
