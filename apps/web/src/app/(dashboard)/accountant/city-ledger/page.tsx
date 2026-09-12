import React from 'react';
import { AlertCircle, ArrowRightLeft, Building2, CheckCircle2, FileText, Receipt, TrendingUp } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecordCityLedgerPaymentModal } from '@/components/accountant/RecordCityLedgerPaymentModal';
import { ExportCityLedgerButton } from '@/components/accountant/ExportCityLedgerButton';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(date);
const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export default async function CityLedgerPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fcity-ledger');
  const propertyId = session.user.propertyId;
  if (!propertyId) return <div className="p-8 text-slate-300">No property is assigned to this user.</div>;

  const [property, accounts, invoices, payments] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.cityLedgerAccount.findMany({ where: { propertyId }, orderBy: { name: 'asc' } }),
    prisma.cityLedgerInvoice.findMany({
      where: { propertyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
      include: { account: { select: { name: true, currency: true } } },
      orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }]
    }),
    prisma.cityLedgerEntry.findMany({
      where: { propertyId, type: 'PAYMENT' },
      include: { account: { select: { name: true, currency: true } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const currency = property?.baseCurrency || accounts[0]?.currency || 'NGN';
  const totalOutstanding = accounts.reduce((total, account) => total + Math.max(0, Number(account.balance)), 0);
  const accountsWithBalance = accounts.filter(account => Number(account.balance) > 0);
  const overdueInvoices = invoices.filter(invoice => invoice.dueDate.getTime() < Date.now());
  const overdueAmount = overdueInvoices.reduce((total, invoice) => total + Number(invoice.outstandingAmount), 0);
  const unmatchedPayments = payments.filter(payment => payment.status !== 'SETTLED');
  const lastPaymentByAccount = new Map<string, Date>();
  for (const payment of payments) if (!lastPaymentByAccount.has(payment.accountId)) lastPaymentByAccount.set(payment.accountId, payment.createdAt);
  const exportRows = accountsWithBalance.map(account => ({ name: account.name, type: account.type, balance: Number(account.balance), currency: account.currency, status: account.status }));

  return (
    <div className="min-h-screen space-y-6 bg-slate-950 p-6 text-slate-50 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-emerald-400"><Building2 className="h-8 w-8" />City Ledger</h1><p className="mt-1 text-sm text-slate-400">Production corporate billing, receivables, invoice aging, and payment reconciliation for {property?.name || 'this property'}.</p></div>
        <div className="flex flex-wrap gap-2"><ExportCityLedgerButton rows={exportRows} currency={currency} /></div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-white/5"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-slate-300">Total outstanding</CardTitle><TrendingUp className="h-4 w-4 text-emerald-400" /></CardHeader><CardContent><div className="text-3xl font-bold">{formatCurrency(totalOutstanding, currency)}</div><p className="mt-1 text-xs text-slate-400">{accountsWithBalance.length} account{accountsWithBalance.length === 1 ? '' : 's'} with a balance</p></CardContent></Card>
        <Card className="border-white/10 bg-white/5"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-slate-300">Overdue invoices</CardTitle><AlertCircle className="h-4 w-4 text-rose-400" /></CardHeader><CardContent><div className="text-3xl font-bold text-rose-400">{formatCurrency(overdueAmount, currency)}</div><p className="mt-1 text-xs text-slate-400">{overdueInvoices.length} open invoice{overdueInvoices.length === 1 ? '' : 's'} past due</p></CardContent></Card>
        <Card className="border-white/10 bg-white/5"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-slate-300">Unmatched payments</CardTitle><ArrowRightLeft className="h-4 w-4 text-indigo-400" /></CardHeader><CardContent><div className="text-3xl font-bold text-indigo-400">{unmatchedPayments.length}</div><p className="mt-1 text-xs text-slate-400">Payments requiring reconciliation</p></CardContent></Card>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="mb-4 border border-white/10 bg-white/5 p-1"><TabsTrigger value="accounts" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Billing accounts</TabsTrigger><TabsTrigger value="invoices" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Open invoices ({invoices.length})</TabsTrigger><TabsTrigger value="payments" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Payment history</TabsTrigger></TabsList>

        <TabsContent value="accounts"><Card className="border-white/10 bg-slate-900/50"><CardHeader><CardTitle className="text-lg text-slate-100">Billing accounts</CardTitle><CardDescription className="text-slate-400">Record a payment against an account or issue a new invoice from the page header.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-slate-400">Account</TableHead><TableHead className="text-slate-400">Type</TableHead><TableHead className="text-slate-400">Status</TableHead><TableHead className="text-slate-400">Last payment</TableHead><TableHead className="text-right text-slate-400">Balance</TableHead><TableHead className="text-right text-slate-400">Action</TableHead></TableRow></TableHeader><TableBody>{accounts.length ? accounts.map(account => <TableRow key={account.id} className="border-white/10 hover:bg-white/5"><TableCell><div className="font-medium text-slate-200">{account.name}</div><div className="font-mono text-xs text-slate-500">{account.id.slice(0, 8)}</div></TableCell><TableCell className="text-slate-300">{account.type}</TableCell><TableCell><Badge variant={account.status === 'ACTIVE' ? 'default' : 'destructive'} className={account.status === 'ACTIVE' ? 'border-none bg-emerald-500/20 text-emerald-300' : ''}>{account.status}</Badge></TableCell><TableCell className="text-slate-400">{lastPaymentByAccount.has(account.id) ? formatDate(lastPaymentByAccount.get(account.id)!) : 'No payments'}</TableCell><TableCell className="text-right font-medium text-slate-200">{formatCurrency(Number(account.balance), account.currency || currency)}</TableCell><TableCell className="text-right">{Number(account.balance) > 0 && account.status === 'ACTIVE' ? <RecordCityLedgerPaymentModal accountId={account.id} accountName={account.name} balance={Number(account.balance)} currency={account.currency || currency} /> : <span className="text-xs text-slate-500">No action</span>}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500">No city-ledger accounts found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card></TabsContent>

        <TabsContent value="invoices"><Card className="border-white/10 bg-slate-900/50"><CardHeader><CardTitle className="text-lg text-slate-100">Open invoices</CardTitle><CardDescription className="text-slate-400">Invoices remain open until payments are applied and the outstanding amount reaches zero.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-slate-400">Invoice number</TableHead><TableHead className="text-slate-400">Account</TableHead><TableHead className="text-slate-400">Issue date</TableHead><TableHead className="text-slate-400">Due date</TableHead><TableHead className="text-slate-400">Status</TableHead><TableHead className="text-right text-slate-400">Outstanding</TableHead></TableRow></TableHeader><TableBody>{invoices.length ? invoices.map(invoice => { const overdue = invoice.dueDate.getTime() < Date.now(); return <TableRow key={invoice.id} className="border-white/10 hover:bg-white/5"><TableCell><div className="font-medium text-slate-200">{invoice.invoiceNumber}</div><div className="text-xs text-slate-500">{invoice.description}</div></TableCell><TableCell className="text-slate-200">{invoice.account.name}</TableCell><TableCell className="text-slate-400">{formatDate(invoice.issueDate)}</TableCell><TableCell className={overdue ? 'text-rose-400' : 'text-slate-400'}>{formatDate(invoice.dueDate)}</TableCell><TableCell><Badge variant="outline" className={overdue ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}>{overdue ? 'OVERDUE' : invoice.status}</Badge></TableCell><TableCell className="text-right font-medium text-slate-200">{formatCurrency(Number(invoice.outstandingAmount), invoice.currency || currency)}</TableCell></TableRow>; }) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500">No open invoices.</TableCell></TableRow>}</TableBody></Table></CardContent></Card></TabsContent>

        <TabsContent value="payments"><Card className="border-indigo-500/20 bg-slate-900/50"><CardHeader><CardTitle className="flex items-center text-lg text-slate-100"><Receipt className="mr-2 h-5 w-5 text-indigo-400" />Payment history</CardTitle><CardDescription className="text-slate-400">Payments recorded against city-ledger accounts, with their reconciliation state.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent"><TableHead className="text-slate-400">Reference</TableHead><TableHead className="text-slate-400">Received date</TableHead><TableHead className="text-slate-400">Account</TableHead><TableHead className="text-right text-slate-400">Amount</TableHead><TableHead className="text-right text-slate-400">Status</TableHead></TableRow></TableHeader><TableBody>{payments.length ? payments.map(payment => <TableRow key={payment.id} className="border-white/10 hover:bg-white/5"><TableCell className="font-medium text-slate-300">{payment.reference || payment.id.slice(0, 8)}</TableCell><TableCell className="text-slate-400">{formatDate(payment.createdAt)}</TableCell><TableCell className="text-slate-200">{payment.account.name}</TableCell><TableCell className="text-right font-medium text-slate-200">{formatCurrency(Number(payment.amount), payment.currency || currency)}</TableCell><TableCell className="text-right"><span className={`inline-flex items-center gap-1 text-sm ${payment.status === 'SETTLED' ? 'text-emerald-400' : 'text-amber-400'}`}>{payment.status === 'SETTLED' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{payment.status}</span></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-500">No city-ledger payments found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
