'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, Download, Printer, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function ReceivablesReportPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  
  const [filter, setFilter] = useState('ALL'); // ALL, IN_HOUSE, CHECKED_OUT, OVERDUE
  const [minBalance, setMinBalance] = useState('1'); // Exclude exact 0

  const fetchReceivables = async () => {
    if (!propertyId) return null;
    const res = await fetch(`/api/v1/reports/receivables?propertyId=${propertyId}&minBalance=${minBalance}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
    return data.data.receivables;
  };

  const { data: receivables, isLoading, error } = useQuery({
    queryKey: ['receivables', propertyId, minBalance],
    queryFn: fetchReceivables,
    enabled: !!propertyId,
  });

  const formatCurrency = (amount: number, currency = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  let filteredReceivables = receivables || [];
  if (filter === 'IN_HOUSE') {
    filteredReceivables = filteredReceivables.filter((r: any) => r.reservation?.status === 'CHECKED_IN');
  } else if (filter === 'CHECKED_OUT') {
    filteredReceivables = filteredReceivables.filter((r: any) => r.reservation?.status === 'CHECKED_OUT');
  } else if (filter === 'OVERDUE') {
    filteredReceivables = filteredReceivables.filter((r: any) => r.aging.status === 'OVERDUE');
  }

  const totalOutstanding = filteredReceivables.reduce((sum: number, r: any) => sum + r.financials.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aged Receivables</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage outstanding guest balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Printer className="w-4 h-4 mr-2" /> Print</Button>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Filter</label>
            <Select value={filter} onValueChange={(val) => setFilter(val || 'ALL')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Receivables</SelectItem>
                <SelectItem value="IN_HOUSE">In-House</SelectItem>
                <SelectItem value="CHECKED_OUT">Checked-Out</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Min Balance (NGN)</label>
            <Select value={minBalance} onValueChange={(val) => setMinBalance(val || '1')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1"> &gt; 0</SelectItem>
                <SelectItem value="10000">&gt; 10,000</SelectItem>
                <SelectItem value="50000">&gt; 50,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-sm font-medium text-muted-foreground">Total Displayed Outstanding</span>
            <span className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 text-red-800 rounded-lg border border-red-200">
          Error loading report: {(error as Error).message}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Folios with Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReceivables.length === 0 ? (
              <p className="text-muted-foreground text-center p-6">No outstanding balances found matching your filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-In/Out</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceivables.map((r: any) => (
                    <TableRow key={r.folioId}>
                      <TableCell className="font-medium">
                        {r.guest?.name || 'Unknown Guest'}
                        {r.guest?.phone && <span className="block text-xs text-muted-foreground">{r.guest.phone}</span>}
                      </TableCell>
                      <TableCell>
                        {r.reservation?.confirmationNumber || '-'}
                        {r.reservation?.status && (
                          <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                            {r.reservation.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{r.reservation?.room || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={r.aging.status === 'OVERDUE' ? 'destructive' : r.aging.status === 'CHECKED_OUT' ? 'secondary' : 'default'}
                        >
                          {r.aging.status}
                          {r.aging.daysOutstanding > 0 && ` (${r.aging.daysOutstanding}d)`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.reservation ? (
                          <>
                            {format(new Date(r.reservation.checkIn), 'MMM d')} - {format(new Date(r.reservation.checkOut), 'MMM d')}
                          </>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {formatCurrency(r.financials.balance, r.financials.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.reservation?.id && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => router.push(`/reservations/${r.reservation.id}`)}
                            className="h-8 hover:bg-primary/10 hover:text-primary"
                          >
                            View Folio <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
