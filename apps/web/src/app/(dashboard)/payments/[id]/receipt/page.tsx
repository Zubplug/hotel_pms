'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Building2, User, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReceiptPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/payments/${id}/receipt`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch receipt');
      return json.data;
    }
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Skeleton className="w-full max-w-2xl h-[600px] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Receipt Not Found</h2>
        <p className="text-muted-foreground">{error.message}</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const { property, guest, reservation, folio, payment, receiptId } = data;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Non-printable action bar */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Printable Receipt Container */}
      <Card className="overflow-hidden border-none shadow-lg print:shadow-none print:bg-transparent bg-card">
        <CardContent className="p-0">
          <div className="print-receipt bg-white text-slate-900 font-sans">
            {/* Header */}
            <div className="p-8 sm:p-12 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PAYMENT RECEIPT</h1>
                  <div className="mt-2 text-sm text-slate-500 font-medium">
                    Receipt No: <span className="text-slate-900">{receiptId}</span>
                  </div>
                  <div className="text-sm text-slate-500 font-medium mt-1">
                    Date: <span className="text-slate-900">{format(new Date(payment.date), 'dd MMM yyyy, HH:mm')}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="flex items-center sm:justify-end gap-2 text-primary font-bold text-xl mb-2">
                    <Building2 className="w-5 h-5" />
                    {property.name || 'LodgeCore'}
                  </div>
                  <div className="text-sm text-slate-500">
                    {property.address && <p>{property.address}</p>}
                    {(property.city || property.country) && <p>{[property.city, property.country].filter(Boolean).join(', ')}</p>}
                    {property.phone && <p>{property.phone}</p>}
                    {property.email && <p>{property.email}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Entities Info */}
            <div className="p-8 sm:p-12 grid grid-cols-1 sm:grid-cols-2 gap-8 border-b border-slate-200 bg-slate-50/50">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <User className="w-4 h-4 text-slate-400" />
                  Billed To
                </div>
                <div className="text-sm">
                  <p className="font-medium text-slate-900 text-lg">{guest?.name || 'Walk-in Guest'}</p>
                  {guest?.email && <p className="text-slate-500 mt-1">{guest.email}</p>}
                </div>
              </div>

              {reservation && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Reservation Details
                  </div>
                  <div className="text-sm grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className="text-slate-500">Confirmation</div>
                    <div className="font-medium text-slate-900 text-right">{reservation.confirmationNumber}</div>
                    <div className="text-slate-500">Room</div>
                    <div className="font-medium text-slate-900 text-right">{reservation.roomNumber}</div>
                    <div className="text-slate-500">Check In</div>
                    <div className="font-medium text-slate-900 text-right">{format(new Date(reservation.checkIn), 'dd MMM yyyy')}</div>
                    <div className="text-slate-500">Check Out</div>
                    <div className="font-medium text-slate-900 text-right">{format(new Date(reservation.checkOut), 'dd MMM yyyy')}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Details */}
            <div className="p-8 sm:p-12">
              <h3 className="text-sm font-semibold text-slate-900 mb-6 uppercase tracking-wider">Transaction Details</h3>
              
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-6 mb-6">
                  <div className="text-center sm:text-left w-full">
                    <div className="text-sm text-slate-500 font-medium mb-1">Amount Received</div>
                    <div className="text-4xl font-bold text-slate-900 tracking-tight">
                      {payment.currency} {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-center sm:text-right w-full">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mb-2 px-3 py-1">
                      {payment.status}
                    </Badge>
                    <div className="text-sm font-medium text-slate-900">{payment.method.replace(/_/g, ' ')}</div>
                    {payment.providerTransactionId && (
                      <div className="text-xs text-slate-500 mt-1 font-mono">Ref: {payment.providerTransactionId}</div>
                    )}
                  </div>
                </div>

                {/* Folio Summary */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 mb-4 uppercase tracking-wider">Account Summary</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Charges</span>
                      <span className="text-slate-900 font-medium">{payment.currency} {folio.totalCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Payments (Including this receipt)</span>
                      <span className="text-slate-900 font-medium">{payment.currency} {folio.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="font-semibold text-slate-900">Remaining Balance Due</span>
                      <span className="font-bold text-slate-900 text-base">{payment.currency} {folio.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-900 text-slate-400 text-center p-8 text-sm">
              <p className="text-white font-medium text-lg mb-2">Thank you for choosing {property.name}!</p>
              <p>For any questions regarding this receipt, please contact the front desk.</p>
              <div className="mt-6 text-xs text-slate-600 font-mono">
                System Generated • Cashier: {payment.cashierId.slice(0,8)} • Folio: {folio.id.slice(0,8)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Global CSS for printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-receipt, .print-receipt * {
            visibility: visible;
          }
          .print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          .print-receipt .bg-slate-900 {
            background-color: white !important;
            color: black !important;
            border-top: 2px dashed #ccc;
          }
          .print-receipt .bg-slate-900 * {
            color: black !important;
          }
        }
      `}} />
    </div>
  );
}
