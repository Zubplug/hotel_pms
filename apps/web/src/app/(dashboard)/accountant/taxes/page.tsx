import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Landmark, FileSpreadsheet, CheckCircle2, Clock, AlertCircle, CalendarDays, ArrowRight, Download } from 'lucide-react';
import { RecordRemittanceModal } from '@/components/accountant/RecordRemittanceModal';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

export default async function TaxesPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) {
    return <div className="p-8 text-slate-400">Property ID not found</div>;
  }

  const remittances = await prisma.taxRemittance.findMany({
    where: { propertyId },
    include: { tax: true },
    orderBy: { periodStart: 'desc' },
  });

  // Generate summary
  const summaryMap = remittances.reduce((acc, rem) => {
    const type = rem.taxType || 'Other';
    if (!acc[type]) {
      acc[type] = {
        type,
        collected: 0,
        rate: rem.tax?.rate ? `${Number(rem.tax.rate).toFixed(1)}%` : 'Varies',
        due: rem.remittanceDate ? rem.remittanceDate.toISOString().split('T')[0] : 'N/A'
      };
    }
    acc[type].collected += Number(rem.collectedAmount || 0);
    return acc;
  }, {} as Record<string, { type: string, collected: number, rate: string, due: string }>);

  const taxSummary = Object.values(summaryMap).map(s => ({
    ...s,
    collected: `₦${s.collected.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }));

  // If no summary data, show a default empty state or fallback to empty array
  // The UI will handle empty array by rendering no cards, but let's see.
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
          <RecordRemittanceModal />
        </div>
      </div>

      {/* Tax Collected Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {taxSummary.length === 0 && (
          <div className="col-span-full text-slate-400 p-4 border border-slate-800 rounded-lg">No tax data found.</div>
        )}
        {taxSummary.map((tax, idx) => (
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
              {remittances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-6">No data</TableCell>
                </TableRow>
              )}
              {remittances.map((remittance) => {
                const amountFormatted = `₦${Number(remittance.collectedAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const dueDateFormatted = remittance.remittanceDate ? remittance.remittanceDate.toISOString().split('T')[0] : 'N/A';
                const periodStartFormatted = remittance.periodStart ? remittance.periodStart.toISOString().split('T')[0] : 'N/A';
                
                let displayStatus = 'Pending';
                if (remittance.status === 'REMITTED') displayStatus = 'Paid';
                if (remittance.status === 'SUBMITTED' || remittance.status === 'APPROVED') displayStatus = 'Processing';

                return (
                  <TableRow key={remittance.id} className="border-slate-800 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium text-slate-300">{remittance.remittanceRef || remittance.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-slate-200">{remittance.taxType ?? 'N/A'}</TableCell>
                    <TableCell className="text-slate-400">{periodStartFormatted}</TableCell>
                    <TableCell className="text-slate-300">{dueDateFormatted}</TableCell>
                    <TableCell className="text-right font-medium text-slate-200">{amountFormatted}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={`
                          ₦{displayStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                          ₦{displayStatus === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                          ₦{displayStatus === 'Processing' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : ''}
                        `}
                      >
                        {displayStatus === 'Paid' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {displayStatus === 'Pending' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {displayStatus === 'Processing' && <Clock className="w-3 h-3 mr-1" />}
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {displayStatus === 'Pending' ? (
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
