'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PlusCircle, Wallet, ArrowRightLeft, CornerDownRight, Printer } from 'lucide-react';
import { AddPaymentDialog } from './AddPaymentDialog';
import { RefundDialog } from './RefundDialog';
import { CheckOutDialog } from './CheckOutDialog';
import { usePathname } from 'next/navigation';

export function FolioSection({ reservation }: { reservation: any }) {
  const pathname = usePathname();
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
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
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: folio.currency }).format(Number(amount));
  };

  const isClosed = folio.status === 'CLOSED';

  // Compute total charges dynamically from FolioItems if we want, or use the DB totalCharges/totalPayments/balance.
  // We use the DB authoritative values.
  const totalCharges = Number(folio.balance) + Number(folio.totalPayments);

  return (
    <>
      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5" /> Folio Ledger
            </CardTitle>
            <Badge variant={isClosed ? 'secondary' : 'default'} className="uppercase">
              {folio.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {!isClosed && (
              <Button size="sm" onClick={() => setIsAddPaymentOpen(true)}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add Payment
              </Button>
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
          <div className="grid grid-cols-3 divide-x border-b bg-white">
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Charges</p>
              <p className="text-2xl font-semibold text-slate-800">{formatCurrency(totalCharges)}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
              <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(folio.totalPayments)}</p>
            </div>
            <div className="p-4 text-center bg-slate-50/50">
              <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
              <p className={`text-2xl font-bold ${Number(folio.balance) > 0 ? 'text-red-600' : Number(folio.balance) < 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {formatCurrency(folio.balance)}
              </p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
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
                {!folio.items || folio.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No transactions recorded.
                    </td>
                  </tr>
                ) : (
                  folio.items.map((item: any) => {
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
                        </td>
                        <td className="px-6 py-3 text-slate-800 font-medium max-w-[250px] truncate" title={item.description}>
                          {item.description}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {isDebit ? formatCurrency(absAmount) : '-'}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-emerald-600 font-medium">
                          {isCredit ? formatCurrency(absAmount) : '-'}
                        </td>
                        <td className="px-6 py-3 text-center flex justify-end gap-2">
                          {linkedPayment && (linkedPayment.status === 'COMPLETED' || linkedPayment.status === 'REFUNDED') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                const basePath = pathname.startsWith('/frontdesk') ? '/frontdesk' : '';
                                window.open(`${basePath}/payments/${linkedPayment.id}/receipt`, '_blank');
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
      <AddPaymentDialog 
        open={isAddPaymentOpen} 
        onOpenChange={setIsAddPaymentOpen} 
        folio={folio} 
      />
      {refundPaymentId && (
        <RefundDialog
          open={!!refundPaymentId}
          onOpenChange={(open) => !open && setRefundPaymentId(null)}
          paymentId={refundPaymentId}
          folio={folio}
        />
      )}
      <CheckOutDialog
        open={isCheckOutOpen}
        onOpenChange={setIsCheckOutOpen}
        reservation={reservation}
        folio={folio}
      />
    </>
  );
}
