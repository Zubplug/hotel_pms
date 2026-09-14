'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ArrowLeft, Building2, CreditCard, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function CityLedgerDetailClient({ account, openInvoices, recentEntries, totalOutstanding }: { account: any; openInvoices: any[]; recentEntries: any[]; totalOutstanding: number }) {
  const router = useRouter();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency || 'NGN' }).format(Number(amount));
  };
  
  const formatLedgerBalance = (amount: number | string) => {
    const num = Number(amount);
    if (Math.abs(num) < 0.01) return formatCurrency(0);
    return num > 0 ? `${formatCurrency(num)} DR` : `${formatCurrency(Math.abs(num))} CR`;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!paymentReference.trim()) {
      toast.error('Please enter a payment reference');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/accountant/city-ledger/${account.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reference: paymentReference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to process payment');

      toast.success('Payment received and allocated successfully');
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentReference('');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/accountant/city-ledger">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{account.CorporateAccount?.[0]?.name || 'Corporate Account'}</h1>
          <p className="text-sm text-slate-500">City Ledger Account • {account.status}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 uppercase tracking-wider">Total Ledger Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">{formatLedgerBalance(account.balance)}</div>
            <p className="text-sm text-slate-400 mt-1">{Number(account.balance) < 0 ? 'Corporate credit available for future invoices' : 'Total outstanding debt'}</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Open Invoices Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{formatCurrency(totalOutstanding)}</div>
            <p className="text-sm text-slate-500 mt-1">{openInvoices.length} active invoices</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm flex items-center justify-center p-6 bg-slate-50/50">
          <Button size="lg" className="w-full h-16 text-lg shadow-md" onClick={() => setIsPaymentModalOpen(true)}>
            <CreditCard className="mr-2 h-5 w-5" />
            Receive Corporate Payment
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-slate-500" /> Open AR Invoices</CardTitle>
            <CardDescription>Invoices generated from guest checkouts awaiting payment.</CardDescription>
          </CardHeader>
          <CardContent>
            {openInvoices.length === 0 ? (
              <div className="text-center py-10 border rounded-xl border-dashed">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
                <p className="text-slate-500 font-medium">All invoices are settled.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {openInvoices.map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-sm gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
                        <Badge variant="outline" className="text-[10px] uppercase bg-amber-50 text-amber-700 border-amber-200">{inv.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">{inv.description}</p>
                      <p className="text-xs text-slate-400 mt-1">Issued: {format(new Date(inv.issueDate), 'MMM d, yyyy')} • Due: {format(new Date(inv.dueDate), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right sm:text-left flex flex-row sm:flex-col justify-between sm:justify-center items-end sm:items-end w-full sm:w-auto">
                      <div className="flex flex-col items-end">
                        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Outstanding</span>
                        <span className="text-lg font-bold text-slate-900">{formatCurrency(inv.outstandingAmount)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-slate-500" /> Recent Ledger Activity</CardTitle>
            <CardDescription>Latest transfers and payments on this corporate account.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="flex justify-between items-center py-3 border-b last:border-0 border-slate-100">
                    <div>
                      <p className="font-medium text-slate-900 text-sm flex items-center gap-2">
                        {entry.type === 'TRANSFER_IN' ? 'Invoice Transfer' : 'Corporate Payment'}
                        {entry.type === 'PAYMENT' && <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">PAID</Badge>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{entry.reference || entry.reason}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{format(new Date(entry.createdAt), 'MMM d, h:mm a')}</p>
                    </div>
                    <div className={`font-bold tabular-nums ${entry.type === 'TRANSFER_IN' ? 'text-slate-900' : 'text-emerald-600'}`}>
                      {entry.type === 'TRANSFER_IN' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handlePayment}>
            <DialogHeader>
              <DialogTitle>Receive Corporate Payment</DialogTitle>
              <DialogDescription>
                Record a bulk payment from {account.CorporateAccount?.[0]?.name}. This will automatically be allocated to the oldest open invoices first. Excess funds will be kept on the account as unallocated credit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Payment Amount ({account.currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference">Payment Reference</Label>
                <Input
                  id="reference"
                  placeholder="e.g. Bank Transfer TXN-123"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Apply Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
