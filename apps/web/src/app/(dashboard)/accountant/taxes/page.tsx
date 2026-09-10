import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Landmark, FileSpreadsheet, CheckCircle2, Clock, AlertCircle, CalendarDays, ArrowRight, Download } from 'lucide-react';

const MOCK_TAX_SUMMARY = [
  { type: 'State Sales Tax', collected: '$45,230.50', rate: '6.5%', due: '2024-10-20' },
  { type: 'City Occupancy Tax', collected: '$18,450.00', rate: '4.0%', due: '2024-10-15' },
  { type: 'County Tourism Tax', collected: '$9,225.25', rate: '2.0%', due: '2024-10-20' },
  { type: 'Federal Payroll Tax', collected: '$32,100.00', rate: 'Varies', due: '2024-09-30' },
];

const MOCK_REMITTANCES = [
  { id: 'REM-0924-A', period: 'August 2024', type: 'City Occupancy Tax', amount: '$17,890.00', status: 'Pending', dueDate: '2024-09-15' },
  { id: 'REM-0924-B', period: 'August 2024', type: 'State Sales Tax', amount: '$43,100.50', status: 'Processing', dueDate: '2024-09-20' },
  { id: 'REM-0824-A', period: 'July 2024', type: 'County Tourism Tax', amount: '$8,950.25', status: 'Paid', dueDate: '2024-08-20' },
  { id: 'REM-0824-B', period: 'July 2024', type: 'State Sales Tax', amount: '$42,500.00', status: 'Paid', dueDate: '2024-08-20' },
  { id: 'REM-0824-C', period: 'Q2 2024', type: 'Corporate Income Tax', amount: '$125,000.00', status: 'Paid', dueDate: '2024-07-15' },
];

export default function TaxesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-8 space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
            Tax Management
          </h1>
          <p className="text-slate-400 mt-1">Monitor tax liabilities and manage remittance schedules.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-800 bg-white/5 hover:bg-white/10 text-slate-200">
            <Download className="w-4 h-4 mr-2" />
            Tax Report
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            New Remittance
          </Button>
        </div>
      </div>

      {/* Tax Collected Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_TAX_SUMMARY.map((tax, idx) => (
          <Card key={idx} className="border-slate-800 bg-white/5 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-16 h-16 text-emerald-400" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">
                {tax.type}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-slate-100 mt-1">
                {tax.collected}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 text-sm mt-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Effective Rate:</span>
                  <span className="text-slate-200">{tax.rate}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Next Due:</span>
                  <span className="flex items-center text-emerald-400">
                    <CalendarDays className="w-3 h-3 mr-1" />
                    {tax.due}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Remittances List */}
      <Card className="border-slate-800 bg-white/5 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              Remittance History & Pending
            </CardTitle>
            <CardDescription className="text-slate-400">
              Track upcoming tax payments and historical submissions
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-slate-800">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead className="text-slate-400">Remittance ID</TableHead>
                <TableHead className="text-slate-400">Tax Type</TableHead>
                <TableHead className="text-slate-400">Period</TableHead>
                <TableHead className="text-slate-400">Due Date</TableHead>
                <TableHead className="text-right text-slate-400">Amount</TableHead>
                <TableHead className="text-center text-slate-400">Status</TableHead>
                <TableHead className="text-right text-slate-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_REMITTANCES.map((remittance) => (
                <TableRow key={remittance.id} className="border-slate-800 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-slate-300">{remittance.id}</TableCell>
                  <TableCell className="text-slate-200">{remittance.type}</TableCell>
                  <TableCell className="text-slate-400">{remittance.period}</TableCell>
                  <TableCell className="text-slate-300">{remittance.dueDate}</TableCell>
                  <TableCell className="text-right font-medium text-slate-200">{remittance.amount}</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={`
                        ${remittance.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                        ${remittance.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                        ${remittance.status === 'Processing' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : ''}
                      `}
                    >
                      {remittance.status === 'Paid' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {remittance.status === 'Pending' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {remittance.status === 'Processing' && <Clock className="w-3 h-3 mr-1" />}
                      {remittance.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {remittance.status === 'Pending' ? (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8">
                        Pay Now
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 h-8">
                        View
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
