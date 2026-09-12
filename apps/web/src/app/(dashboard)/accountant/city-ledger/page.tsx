

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Search, 
  Receipt, 
  ArrowRightLeft, 
  TrendingUp, 
  AlertCircle,
  FileText,
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { NewCityLedgerInvoiceModal } from '@/components/accountant/NewCityLedgerInvoiceModal';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

export default async function CityLedgerPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  const accounts = propertyId ? await prisma.cityLedgerAccount.findMany({
    where: { propertyId },
    orderBy: { name: 'asc' }
  }) : [];

  const entries = propertyId ? await prisma.cityLedgerEntry.findMany({
    where: { propertyId },
    include: { account: { select: { name: true } } },
    take: 100,
    orderBy: { createdAt: 'desc' }
  }) : [];

  const invoices = entries.filter(entry => entry.type === 'TRANSFER_IN');
  const payments = entries.filter(entry => entry.type === 'PAYMENT');
  const totalOutstanding = accounts.reduce((total, account) => total + Math.max(0, Number(account.balance)), 0);
  const accountsWithBalance = accounts.filter(account => Number(account.balance) > 0).length;
  const unmatchedPayments = payments.filter(payment => payment.status !== 'SETTLED').length;
  const lastPaymentByAccount = new Map<string, Date>();
  for (const payment of payments) {
    if (!lastPaymentByAccount.has(payment.accountId)) lastPaymentByAccount.set(payment.accountId, payment.createdAt);
  }

  const formatCurrency = (amount: number) => {
    return '₦' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };
  const formatDate = (date: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(date);

  return (
    <div className="p-6 space-y-6 bg-slate-950 text-slate-50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">City Ledger</h1>
          <p className="text-slate-400 mt-1">Manage corporate accounts, direct billing, and payment matching.</p>
        </div>
        <div className="flex space-x-3">
          <Button className="bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10">
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <NewCityLedgerInvoiceModal accounts={accounts.map(a => ({ id: a.id, name: a.name }))} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-emerald-500/20 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Outstanding</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-50">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-slate-400 mt-1">{accountsWithBalance} account{accountsWithBalance === 1 ? '' : 's'} with an outstanding balance</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Overdue Balances</CardTitle>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-400">Not tracked</div>
            <p className="text-xs text-slate-400 mt-1">Due dates are not stored on city ledger entries</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Unmatched Payments</CardTitle>
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-400">{unmatchedPayments}</div>
            <p className="text-xs text-slate-400 mt-1">Payment entries awaiting settlement</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 mb-4">
          <TabsTrigger value="accounts" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Corporate Accounts
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Outstanding Invoices
          </TabsTrigger>
          <TabsTrigger value="matching" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white relative">
            Payment Matching
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500"></span>
          </TabsTrigger>
        </TabsList>

        {/* Corporate Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg text-slate-100">Billing Accounts</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    type="text" 
                    placeholder="Search accounts..." 
                    className="pl-9 bg-slate-950 border-white/10 text-slate-200 focus:border-emerald-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Account ID</TableHead>
                    <TableHead className="text-slate-400">Company Name</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Last Payment</TableHead>
                    <TableHead className="text-right text-slate-400">Current Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length > 0 ? accounts.map((account) => (
                    <TableRow key={account.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{account.id.substring(0,8)}</TableCell>
                      <TableCell className="text-slate-200">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant={account.status === 'ACTIVE' ? 'default' : 'destructive'} 
                          className={account.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-none' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border-none'}>
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{lastPaymentByAccount.get(account.id) ? formatDate(lastPaymentByAccount.get(account.id)!) : 'No payments'}</TableCell>
                      <TableCell className="text-right text-slate-200 font-medium">
                        {formatCurrency(Number(account.balance))}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-6">No city ledger accounts found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-100">Outstanding Invoices</CardTitle>
              <CardDescription className="text-slate-400">Review pending and overdue corporate billings.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Invoice ID</TableHead>
                    <TableHead className="text-slate-400">Account</TableHead>
                    <TableHead className="text-slate-400">Issue Date</TableHead>
                    <TableHead className="text-slate-400">Due Date</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-right text-slate-400">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length > 0 ? invoices.map((inv) => (
                    <TableRow key={inv.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{inv.id.substring(0,8)}</TableCell>
                      <TableCell className="text-slate-200">{inv.account.name}</TableCell>
                      <TableCell className="text-slate-400">{formatDate(inv.createdAt)}</TableCell>
                      <TableCell className="text-slate-400">—</TableCell>
                      <TableCell>
                        <Badge variant="outline" 
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {inv.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-200 font-medium">
                        {formatCurrency(Number(inv.amount))}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-6">No outstanding invoices found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Matching Tab */}
        <TabsContent value="matching" className="space-y-4">
          <Card className="bg-slate-900/50 border-indigo-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-100 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-indigo-400" />
                Unallocated Payments
              </CardTitle>
              <CardDescription className="text-slate-400">Match incoming bank payments to city ledger accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Ref ID</TableHead>
                    <TableHead className="text-slate-400">Received Date</TableHead>
                    <TableHead className="text-slate-400">Method</TableHead>
                    <TableHead className="text-slate-400">Detected Account</TableHead>
                    <TableHead className="text-slate-400">Amount</TableHead>
                    <TableHead className="text-right text-slate-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length > 0 ? payments.map((payment) => (
                    <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{payment.id.substring(0,8)}</TableCell>
                      <TableCell className="text-slate-400">{formatDate(payment.createdAt)}</TableCell>
                      <TableCell className="text-slate-400">{payment.reference || '—'}</TableCell>
                      <TableCell className="text-slate-200">{payment.account.name}</TableCell>
                      <TableCell className="text-slate-200 font-medium">
                        {formatCurrency(Number(payment.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center text-emerald-400 text-sm">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Matched
                        </span>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-6">No payments found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
