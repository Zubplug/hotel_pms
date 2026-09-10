import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Download, Filter, TrendingUp, TrendingDown, PlusCircle, Scale } from 'lucide-react';
import { NewJournalEntryModal } from '@/components/accountant/NewJournalEntryModal';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

const MOCK_ACCOUNTS_SUMMARY = [
  { category: 'Assets', balance: '₦1,450,000.00', trend: 'up', percentage: '+2.4%' },
  { category: 'Liabilities', balance: '₦420,000.00', trend: 'down', percentage: '-1.2%' },
  { category: 'Equity', balance: '₦1,030,000.00', trend: 'up', percentage: '+4.1%' },
  { category: 'Revenue', balance: '₦125,500.00', trend: 'up', percentage: '+8.5%' },
  { category: 'Expenses', balance: '₦84,200.00', trend: 'down', percentage: '-0.5%' },
];

export default async function GeneralLedgerPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  
  const recentJournals = propertyId ? await prisma.journalEntry.findMany({
    where: { propertyId },
    take: 5,
    orderBy: { entryDate: 'desc' }
  }) : [];

  const chartPreview = propertyId ? await prisma.chartOfAccount.findMany({
    where: { propertyId },
    orderBy: { code: 'asc' }
  }) : [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount).replace('$', '₦');
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-8 space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
            General Ledger
          </h1>
          <p className="text-slate-400 mt-1">Manage chart of accounts and journal entries.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-800 bg-white/5 hover:bg-white/10 text-slate-200">
            <Scale className="w-4 h-4 mr-2 text-indigo-400" />
            Trial Balance
          </Button>
          <NewJournalEntryModal accounts={chartPreview.map(a => ({ id: a.id, name: a.name, code: a.code }))} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {MOCK_ACCOUNTS_SUMMARY.map((account, idx) => (
          <Card key={idx} className="border-slate-800 bg-white/5 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">
                {account.category}
              </CardDescription>
              <CardTitle className="text-xl font-semibold text-slate-100">
                {account.balance}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-sm">
                {account.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className={account.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                  {account.percentage}
                </span>
                <span className="text-slate-500 ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Journal Entries */}
        <Card className="col-span-1 lg:col-span-2 border-slate-800 bg-white/5 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                Recent Journal Entries
              </CardTitle>
              <CardDescription className="text-slate-400">
                Latest postings across all accounts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800">
                <Filter className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="border-slate-800">
                <TableRow className="hover:bg-transparent border-slate-800">
                  <TableHead className="text-slate-400">Entry ID</TableHead>
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Description</TableHead>
                  <TableHead className="text-right text-slate-400">Amount</TableHead>
                  <TableHead className="text-right text-slate-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJournals.length > 0 ? recentJournals.map((entry) => (
                  <TableRow key={entry.id} className="border-slate-800 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium text-indigo-400">{entry.entryNumber}</TableCell>
                    <TableCell className="text-slate-300">{entry.entryDate.toISOString().split('T')[0]}</TableCell>
                    <TableCell className="text-slate-200">{entry.description}</TableCell>
                    <TableCell className="text-right text-slate-200">{formatCurrency(Number(entry.totalDebit))}</TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={entry.status === 'POSTED' ? 'default' : 'secondary'}
                        className={entry.status === 'POSTED' 
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-0'
                          : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-0'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-6">No recent journal entries found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick Actions / Chart of Accounts Preview */}
        <div className="space-y-6">
          <Card className="border-slate-800 bg-white/5 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Chart of Accounts
              </CardTitle>
              <CardDescription className="text-slate-400">
                Quick access to primary accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {chartPreview.map((acc) => (
                <div key={acc.code} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{acc.code} - {acc.name}</p>
                    <p className="text-xs text-slate-500">{acc.type}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-indigo-400">
                    View
                  </Button>
                </div>
              ))}
              {chartPreview.length === 0 && (
                <p className="text-sm text-slate-500">No accounts configured.</p>
              )}
              <Button className="w-full mt-4 bg-white/5 hover:bg-white/10 text-slate-200 border border-slate-700">
                View Full Chart
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
