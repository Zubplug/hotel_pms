import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Download, Filter, Scale } from 'lucide-react';
import { NewJournalEntryModal } from '@/components/accountant/NewJournalEntryModal';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

export default async function GeneralLedgerPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  const property = propertyId
    ? await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } })
    : null;
  const businessDate = property?.businessDate || new Date();

  const [recentJournals, chartPreview, postedLines] = propertyId
    ? await Promise.all([
        prisma.journalEntry.findMany({
          where: { propertyId, status: 'POSTED', entryDate: { lte: businessDate } },
          take: 5,
          orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.chartOfAccount.findMany({
          where: { propertyId },
          orderBy: { code: 'asc' },
        }),
        prisma.journalEntryLine.findMany({
          where: { entry: { propertyId, status: 'POSTED', entryDate: { lte: businessDate } } },
          select: {
            debit: true,
            credit: true,
            account: { select: { type: true, normalBalance: true } },
          },
        }),
      ])
    : [[], [], []];

  const categoryOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
  const categoryBalances = new Map(categoryOrder.map((category) => [category, 0]));
  for (const line of postedLines as any[]) {
    const category = String(line.account.type).toUpperCase();
    if (!categoryBalances.has(category)) continue;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    const normalBalance = String(line.account.normalBalance || '').toUpperCase();
    const balance = normalBalance === 'CREDIT' ? credit - debit : debit - credit;
    categoryBalances.set(category, (categoryBalances.get(category) || 0) + balance);
  }

  const accountSummary = categoryOrder.map((category) => ({
    category: ({ ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses' } as Record<string, string>)[category],
    balance: categoryBalances.get(category) || 0,
  }));

  const formatCurrency = (amount: number) => {
    return '₦' + new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
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
        {accountSummary.map((account) => (
          <Card key={account.category} className="border-slate-800 bg-white/5 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">
                {account.category}
              </CardDescription>
              <CardTitle className="text-xl font-semibold text-slate-100">
                {formatCurrency(account.balance)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500">Posted balance through {businessDate.toISOString().slice(0, 10)}</div>
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
