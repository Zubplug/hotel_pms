import { Metadata } from 'next';
import prisma from '@hotel-pms/db';
import { Trash2, Plus, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Waste Log | LodgeCore F&B',
};

const money = (value: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default async function WasteLogPage() {
  const property = await prisma.property.findFirst({ where: { isActive: true } });
  if (!property) return <div>No active property found.</div>;
  const currency = property.baseCurrency || 'NGN';

  const wasteEntries = await prisma.kitchenWasteEntry.findMany({
    where: { propertyId: property.id },
    orderBy: { id: 'desc' },
    include: {
      stockItem: true,
    }
  });

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
      <PageHeader 
        title="Waste & Spoilage Log" 
        description="Review logged kitchen waste, spoilage, and production losses affecting inventory valuation."
        actions={
          <Link href="/fnb/inventory/waste/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors border border-emerald-700/50">
              <Plus className="mr-2 h-4 w-4" /> Log Waste
            </Button>
          </Link>
        }
      />

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Trash2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" /> Recent Entries
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto relative">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 font-semibold text-slate-600 dark:text-slate-300 h-11">Stock Item</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Quantity</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Unit Cost</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Financial Impact</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-center">Reason</TableHead>
                <TableHead className="pr-6 font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wasteEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3">
                      <Trash2 className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">No waste entries logged.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                wasteEntries.map(entry => {
                  const statusBg = entry.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                                   entry.status === 'REJECTED' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                                   entry.status === 'SUBMITTED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                   'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

                  return (
                    <TableRow key={entry.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-100 dark:border-slate-800/50">
                      <TableCell className="pl-6 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{entry.stockItem?.name || 'Unknown Item'}</span>
                          {entry.notes && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[250px]">
                              {entry.notes}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {Number(entry.quantity)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider">{entry.unitOfMeasure}</div>
                      </TableCell>
                      
                      <TableCell className="text-right py-3">
                        <div className="font-medium text-slate-500 dark:text-slate-400">
                          {money(Number(entry.unitCost), currency)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right py-3">
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {money(Number(entry.totalValue), currency)}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-center py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {entry.reason.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      
                      <TableCell className="pr-6 text-right py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-bold uppercase tracking-wider ${statusBg}`}>
                          {entry.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
