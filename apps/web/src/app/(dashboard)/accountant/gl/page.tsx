import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Download, Filter, TrendingUp, TrendingDown, PlusCircle, Scale } from 'lucide-react';

const MOCK_JOURNAL_ENTRIES = [
  { id: 'JE-2024-089', date: '2024-09-10', description: 'Daily Revenue Recognition', amount: '₦4,250.00', status: 'Posted' },
  { id: 'JE-2024-090', date: '2024-09-10', description: 'Payroll Accrual', amount: '₦12,400.00', status: 'Pending' },
  { id: 'JE-2024-091', date: '2024-09-09', description: 'Supplier Payment - Linens', amount: '₦850.00', status: 'Posted' },
  { id: 'JE-2024-092', date: '2024-09-08', description: 'Monthly Rent Allocation', amount: '₦5,000.00', status: 'Posted' },
  { id: 'JE-2024-093', date: '2024-09-08', description: 'Utility Accrual', amount: '₦1,200.00', status: 'Pending' },
];

const MOCK_ACCOUNTS_SUMMARY = [
  { category: 'Assets', balance: '₦1,450,000.00', trend: 'up', percentage: '+2.4%' },
  { category: 'Liabilities', balance: '₦420,000.00', trend: 'down', percentage: '-1.2%' },
  { category: 'Equity', balance: '₦1,030,000.00', trend: 'up', percentage: '+4.1%' },
  { category: 'Revenue', balance: '₦125,500.00', trend: 'up', percentage: '+8.5%' },
  { category: 'Expenses', balance: '₦84,200.00', trend: 'down', percentage: '-0.5%' },
];

export default function GeneralLedgerPage() {
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
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Entry
          </Button>
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
                {MOCK_JOURNAL_ENTRIES.map((entry) => (
                  <TableRow key={entry.id} className="border-slate-800 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium text-indigo-400">{entry.id}</TableCell>
                    <TableCell className="text-slate-300">{entry.date}</TableCell>
                    <TableCell className="text-slate-200">{entry.description}</TableCell>
                    <TableCell className="text-right text-slate-200">{entry.amount}</TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={entry.status === 'Posted' ? 'default' : 'secondary'}
                        className={entry.status === 'Posted' 
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-0'
                          : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-0'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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
              {[
                { code: '1000', name: 'Cash & Equivalents', type: 'Asset' },
                { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
                { code: '2000', name: 'Accounts Payable', type: 'Liability' },
                { code: '4000', name: 'Room Revenue', type: 'Revenue' },
                { code: '6000', name: 'Payroll Expenses', type: 'Expense' },
              ].map((acc) => (
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
