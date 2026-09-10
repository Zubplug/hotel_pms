'use client';

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

const ACCOUNTS = [
  { id: 'CORP-001', name: 'Acme Corporation', balance: 14500.00, status: 'Active', lastPayment: '2026-08-15' },
  { id: 'CORP-002', name: 'Global Tech Industries', balance: 3200.50, status: 'Overdue', lastPayment: '2026-07-20' },
  { id: 'CORP-003', name: 'Summit Group', balance: 0.00, status: 'Active', lastPayment: '2026-09-01' },
  { id: 'CORP-004', name: 'Omega Logistics', balance: 8750.25, status: 'Active', lastPayment: '2026-08-28' },
];

const OUTSTANDING_INVOICES = [
  { id: 'INV-2026-089', account: 'Global Tech Industries', amount: 3200.50, date: '2026-07-15', dueDate: '2026-08-14', status: 'Overdue' },
  { id: 'INV-2026-102', account: 'Acme Corporation', amount: 8500.00, date: '2026-08-10', dueDate: '2026-09-09', status: 'Pending' },
  { id: 'INV-2026-105', account: 'Omega Logistics', amount: 8750.25, date: '2026-08-20', dueDate: '2026-09-19', status: 'Pending' },
  { id: 'INV-2026-110', account: 'Acme Corporation', amount: 6000.00, date: '2026-08-25', dueDate: '2026-09-24', status: 'Pending' },
];

const RECENT_PAYMENTS = [
  { id: 'PAY-8829', account: 'Summit Group', amount: 4500.00, date: '2026-09-01', method: 'Wire Transfer', matched: true },
  { id: 'PAY-8830', account: 'Omega Logistics', amount: 2000.00, date: '2026-08-28', method: 'Check', matched: true },
  { id: 'PAY-8831', account: 'Unknown', amount: 1250.00, date: '2026-09-05', method: 'ACH', matched: false },
];

export default function CityLedgerPage() {
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
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Building2 className="w-4 h-4 mr-2" />
            New Account
          </Button>
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
            <div className="text-3xl font-bold text-slate-50">$26,450.75</div>
            <p className="text-xs text-slate-400 mt-1">+12% from last month</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Overdue Balances</CardTitle>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-400">$3,200.50</div>
            <p className="text-xs text-slate-400 mt-1">1 account with overdue status</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Unmatched Payments</CardTitle>
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-400">1</div>
            <p className="text-xs text-slate-400 mt-1">Requires reconciliation</p>
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
                  {ACCOUNTS.map((account) => (
                    <TableRow key={account.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{account.id}</TableCell>
                      <TableCell className="text-slate-200">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant={account.status === 'Active' ? 'default' : 'destructive'} 
                          className={account.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-none' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border-none'}>
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{account.lastPayment}</TableCell>
                      <TableCell className="text-right text-slate-200 font-medium">
                        ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {OUTSTANDING_INVOICES.map((inv) => (
                    <TableRow key={inv.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{inv.id}</TableCell>
                      <TableCell className="text-slate-200">{inv.account}</TableCell>
                      <TableCell className="text-slate-400">{inv.date}</TableCell>
                      <TableCell className="text-slate-400">{inv.dueDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" 
                          className={inv.status === 'Pending' ? 'border-amber-500/50 text-amber-400' : 'border-rose-500/50 text-rose-400'}>
                          {inv.status === 'Pending' ? <Clock className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-200 font-medium">
                        ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {RECENT_PAYMENTS.map((payment) => (
                    <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-slate-300">{payment.id}</TableCell>
                      <TableCell className="text-slate-400">{payment.date}</TableCell>
                      <TableCell className="text-slate-400">{payment.method}</TableCell>
                      <TableCell className="text-slate-200">
                        {payment.matched ? payment.account : (
                          <span className="text-amber-400 flex items-center text-sm">
                            <AlertCircle className="w-3 h-3 mr-1" /> Unidentified
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-200 font-medium">
                        ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.matched ? (
                          <span className="inline-flex items-center text-emerald-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Matched
                          </span>
                        ) : (
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            Match Payment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
