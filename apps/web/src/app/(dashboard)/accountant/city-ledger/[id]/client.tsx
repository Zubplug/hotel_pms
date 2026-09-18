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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function CityLedgerDetailClient({ account, openInvoices, recentEntries, totalOutstanding }: { account: any; openInvoices: any[]; recentEntries: any[]; totalOutstanding: number }) {
  const router = useRouter();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);
  const [operationId, setOperationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSkipper = account.type === 'SKIPPER';

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency || 'NGN' }).format(Number(amount));
  };
  
  const formatLedgerBalance = (amount: number | string) => {
    const num = Number(amount);
    if (Math.abs(num) < 0.01) return <span className="text-white">{formatCurrency(0)}</span>;
    return num > 0 ? (
      <span className="text-rose-500">{formatCurrency(num)} DR</span>
    ) : (
      <span className="text-emerald-400">{formatCurrency(Math.abs(num))} CR</span>
    );
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    // Some methods require a reference, but we let backend validate if needed.
    // For manual UI we'll just require it always to be safe for auditing.
    if (!paymentReference.trim()) {
      toast.error('Please enter a payment reference');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/accountant/city-ledger/${account.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount, 
          reference: paymentReference,
          method: paymentMethod,
          invoiceId: targetInvoiceId || undefined,
          idempotencyKey: operationId
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to process payment');

      toast.success('Payment received and allocated successfully');
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentReference('');
      setTargetInvoiceId(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTargetedPaymentModal = (inv: any) => {
    setTargetInvoiceId(inv.id);
    setPaymentAmount(inv.outstandingAmount.toString());
    setPaymentReference('');
    setPaymentMethod('CASH');
    setOperationId(crypto.randomUUID());
    setIsPaymentModalOpen(true);
  };

  const openBulkPaymentModal = () => {
    setTargetInvoiceId(null);
    setPaymentAmount('');
    setPaymentReference('');
    setPaymentMethod('BANK_TRANSFER');
    setOperationId(crypto.randomUUID());
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/accountant/city-ledger">
          <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
            {isSkipper ? 'Skippers & Walk-Outs' : (account.CorporateAccount?.[0]?.name || 'Corporate Account')}
          </h1>
          <p className="text-sm text-slate-400">City Ledger Account • {account.status}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 uppercase tracking-wider">Total Ledger Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight text-white">{formatLedgerBalance(account.balance)}</div>
            <p className="text-sm text-slate-400 mt-1">{Number(account.balance) < 0 ? 'Corporate credit available for future invoices' : 'Total outstanding debt'}</p>
          </CardContent>
        </Card>
        
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 uppercase tracking-wider">Open Invoices Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-500">{formatCurrency(totalOutstanding)}</div>
            <p className="text-sm text-slate-400 mt-1">{openInvoices.length} active invoices</p>
          </CardContent>
        </Card>
        
        {!isSkipper && (
          <Card className="border-emerald-500/10 bg-emerald-500/5 flex items-center justify-center p-6">
            <Button size="lg" className="w-full h-16 text-lg bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-md" onClick={openBulkPaymentModal}>
              <CreditCard className="mr-2 h-5 w-5" />
              Receive Corporate Payment
            </Button>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-100"><FileText className="h-5 w-5 text-slate-400" /> Open AR Invoices</CardTitle>
            <CardDescription className="text-slate-400">Invoices generated from guest checkouts awaiting payment.</CardDescription>
          </CardHeader>
          <CardContent>
            {openInvoices.length === 0 ? (
              <div className="text-center py-10 border border-white/5 rounded-xl border-dashed bg-white/5">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
                <p className="text-slate-400 font-medium">All invoices are settled.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {openInvoices.map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 gap-4 hover:bg-white/10 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-200">{inv.invoiceNumber}</span>
                        <Badge variant="outline" className="text-[10px] uppercase border-amber-500/20 bg-amber-500/10 text-amber-400">{inv.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-400">{inv.description}</p>
                      <p className="text-xs text-slate-500 mt-1">Issued: {format(new Date(inv.issueDate), 'MMM d, yyyy')} • Due: {format(new Date(inv.dueDate), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right sm:text-left flex flex-row sm:flex-col justify-between sm:justify-center items-end sm:items-end w-full sm:w-auto">
                      <div className="flex flex-col items-end">
                        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Outstanding</span>
                        <span className="text-lg font-bold text-rose-500">{formatCurrency(inv.outstandingAmount)}</span>
                        
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => openTargetedPaymentModal(inv)}
                          >
                            Settle Invoice
                          </Button>
                        </>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-100"><Building2 className="h-5 w-5 text-slate-400" /> Recent Ledger Activity</CardTitle>
            <CardDescription className="text-slate-400">Latest transfers and payments on this account.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                    <div>
                      <p className="font-medium text-slate-200 text-sm flex items-center gap-2">
                        {entry.type === 'TRANSFER_IN' ? 'Invoice Transfer' : 'AR Payment'}
                        {entry.type === 'PAYMENT' && <Badge variant="secondary" className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-400">PAID</Badge>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{entry.reference || entry.reason}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{format(new Date(entry.createdAt), 'MMM d, h:mm a')}</p>
                    </div>
                    <div className={`font-bold tabular-nums ${entry.type === 'TRANSFER_IN' ? 'text-slate-200' : 'text-emerald-400'}`}>
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
        <DialogContent className="sm:max-w-[425px] border-white/10 bg-slate-950 text-slate-100">
          <form onSubmit={handlePayment}>
            <DialogHeader>
              <DialogTitle className="text-slate-100">Record AR Payment</DialogTitle>
              <DialogDescription className="text-slate-400">
                {targetInvoiceId 
                  ? "Receive and allocate payment for a specific walk-out/city ledger invoice."
                  : `Record a bulk payment from ${account.CorporateAccount?.[0]?.name}. This will automatically be allocated to the oldest open invoices first.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="method" className="text-slate-300">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(val) => val && setPaymentMethod(val)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-slate-100">
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="POS">POS Terminal</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount" className="text-slate-300">Payment Amount ({account.currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference" className="text-slate-300">Payment Reference</Label>
                <Input
                  id="reference"
                  placeholder="e.g. Bank Transfer TXN-123"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Apply Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
