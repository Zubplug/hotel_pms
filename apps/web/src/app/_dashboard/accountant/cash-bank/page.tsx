

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Landmark,
  Wallet,
  Coins,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  History,
  MoreHorizontal
} from 'lucide-react';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';
import { RecordCashDropModal } from '@/components/accountant/RecordCashDropModal';
import { BankReconForm } from '@/components/accountant/BankReconForm';

export default async function CashBankPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  const posSessions = propertyId ? await prisma.posSession.findMany({
    where: { outlet: { propertyId } },
    include: { outlet: true, primaryOperator: true },
    take: 10,
    orderBy: { businessDate: 'desc' }
  }) : [];

  const bankDeposits = propertyId ? await prisma.bankDeposit.findMany({
    where: { propertyId },
    take: 10,
    orderBy: { depositDate: 'desc' }
  }) : [];

  const cashExpenses = propertyId ? await prisma.cashExpense.findMany({
    where: { propertyId },
    take: 10,
    orderBy: { amount: 'desc' } // or createdAt, assuming amount for now
  }) : [];

  const totalCashOnHand = posSessions.reduce((acc, curr) => acc + (Number(curr.version || 0)), 0); // Using version just as mock fallback, normally opening/closing balance
  const totalBankBalance = 245600.80; // Hardcoded mock for operating balance unless we query CashAccount

  const formatCurrency = (amount: number) => {
    return '₦' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 text-slate-50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">Cash & Bank</h1>
          <p className="text-slate-400 mt-1">Manage cash drawers, petty cash funds, and bank reconciliations.</p>
        </div>
        <div className="flex space-x-3">
          <Button className="bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10">
            <History className="w-4 h-4 mr-2" />
            Audit Logs
          </Button>
          <BankReconForm />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-emerald-500/20 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Cash on Hand</CardTitle>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-50">₦1,850.00</div>
            <p className="text-xs text-slate-400 mt-1">Across 3 active drawers & petty cash</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Bank Balance (Operating)</CardTitle>
            <Landmark className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-400">₦245,600.80</div>
            <p className="text-xs text-slate-400 mt-1">Last synced: 2 hours ago</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Reconciliation Status</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">1 Pending</div>
            <p className="text-xs text-slate-400 mt-1">September operating account</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Tabs defaultValue="drawers" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 mb-4">
          <TabsTrigger value="drawers" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-2" /> Cash Drawers
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Landmark className="w-4 h-4 mr-2" /> Bank Reconciliation
          </TabsTrigger>
          <TabsTrigger value="petty-cash" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Coins className="w-4 h-4 mr-2" /> Petty Cash
          </TabsTrigger>
        </TabsList>

        {/* Cash Drawers Tab */}
        <TabsContent value="drawers" className="space-y-4">
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg text-slate-100">Shift Cash Drawers</CardTitle>
                  <CardDescription className="text-slate-400">Monitor active cash floats and end-of-shift drops.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <RecordCashDropModal posSessions={posSessions} />
                  <Button size="sm" className="bg-white/10 hover:bg-white/20 text-slate-100">
                    Drop History
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Drawer ID</TableHead>
                    <TableHead className="text-slate-400">Location</TableHead>
                    <TableHead className="text-slate-400">Assignee</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Opened At</TableHead>
                    <TableHead className="text-right text-slate-400">Current Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posSessions.length > 0 ? posSessions.map((drawer) => (
                    <TableRow key={drawer.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{drawer.id.substring(0,8)}</TableCell>
                      <TableCell className="text-slate-200">{drawer.outlet?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-slate-400">{drawer.primaryOperator?.firstName || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" 
                          className={drawer.status === 'OPEN' ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-500/50 text-slate-400'}>
                          {drawer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{drawer.businessDate.toISOString().split('T')[0]}</TableCell>
                      <TableCell className="text-right text-slate-200 font-medium">
                        {formatCurrency(0)}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-6">No cash drawers found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-4">
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-100">Bank Reconciliation</CardTitle>
              <CardDescription className="text-slate-400">Match PMS transactions with bank statements.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Rec ID</TableHead>
                    <TableHead className="text-slate-400">Account</TableHead>
                    <TableHead className="text-slate-400">Period</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Date Reconciled</TableHead>
                    <TableHead className="text-right text-slate-400">Difference</TableHead>
                    <TableHead className="text-right text-slate-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankDeposits.length > 0 ? bankDeposits.map((rec) => (
                    <TableRow key={rec.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{rec.id.substring(0,8)}</TableCell>
                      <TableCell className="text-slate-200">{rec.bankName || 'Unknown Bank'}</TableCell>
                      <TableCell className="text-slate-400">{rec.depositReference}</TableCell>
                      <TableCell>
                        <Badge variant="outline" 
                          className={rec.status === 'RECONCILED' ? 'border-emerald-500/50 text-emerald-400' : 'border-amber-500/50 text-amber-400'}>
                          {rec.status === 'RECONCILED' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1 animate-spin-slow" />}
                          {rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{rec.depositDate ? rec.depositDate.toISOString().split('T')[0] : '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(rec.difference) === 0 ? (
                          <span className="text-emerald-400">₦0.00</span>
                        ) : (
                          <span className="text-rose-400">{formatCurrency(Number(rec.difference || 0))}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500 py-6">No bank deposits found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Petty Cash Tab */}
        <TabsContent value="petty-cash" className="space-y-4">
          <Card className="bg-slate-900/50 border-indigo-500/20">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg text-slate-100">Petty Cash Log</CardTitle>
                  <CardDescription className="text-slate-400">Track small expenses and fund replenishments.</CardDescription>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="w-4 h-4 mr-1" /> New Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 rounded-lg bg-slate-950 border border-white/10 flex justify-between items-center">
                <span className="text-slate-400">Current Fund Balance:</span>
                <span className="text-2xl font-bold text-emerald-400">₦500.00</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400">Requestor / Dept</TableHead>
                    <TableHead className="text-slate-400">Description</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-right text-slate-400">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashExpenses.length > 0 ? cashExpenses.map((log) => (
                    <TableRow key={log.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">N/A</TableCell>
                      <TableCell className="text-slate-200">{log.payee}</TableCell>
                      <TableCell className="text-slate-400">{log.description}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-rose-400 text-sm">
                          <ArrowUpRight className="w-4 h-4 mr-1" /> Expense
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className="text-slate-200">
                          -{formatCurrency(Number(log.amount))}
                        </span>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-6">No petty cash logs found.</TableCell>
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
