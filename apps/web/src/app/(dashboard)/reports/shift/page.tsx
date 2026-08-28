'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Loader2, Download, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';

export default function ShiftReportPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState<string>('ALL');

  // We could fetch users here for the dropdown, but for brevity we'll just allow "All Users" or "My Shift"
  // since the backend securely overrides `userId` to the session.user.id if they are a STAFF member anyway.

  const fetchShiftReport = async () => {
    if (!propertyId) return null;
    const start = startOfDay(new Date(date)).toISOString();
    const end = endOfDay(new Date(date)).toISOString();
    
    let url = `/api/v1/reports/shift?propertyId=${propertyId}&startDate=${start}&endDate=${end}`;
    if (userId !== 'ALL') {
      url += `&userId=${userId}`;
    }
    
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
    return data.data;
  };

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['shiftReport', propertyId, date, userId],
    queryFn: fetchShiftReport,
    enabled: !!propertyId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const methods = report?.summary ? Object.keys(report.summary) : ['CASH', 'POS', 'PAYMENT_GATEWAY', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ROOM_CHARGE', 'OTHER'];
  let totalGross = 0;
  let totalRefunds = 0;
  let totalNet = 0;

  if (report?.summary) {
    Object.values(report.summary).forEach((s: any) => {
      totalGross += s.payments;
      totalRefunds += s.refunds;
      totalNet += s.net;
    });
  }

  // Combine payments and refunds into a chronological transaction list
  const transactions: any[] = [];
  if (report?.items) {
    report.items.payments.forEach((p: any) => {
      transactions.push({
        id: p.id,
        type: 'PAYMENT',
        date: p.createdAt,
        method: p.method,
        amount: Number(p.amount),
        guest: p.folio?.reservation?.primaryGuest,
        reservationId: p.folio?.reservation?.id,
        staffId: p.receivedBy,
        status: p.status,
      });
    });
    report.items.refunds.forEach((r: any) => {
      transactions.push({
        id: r.id,
        type: 'REFUND',
        date: r.createdAt,
        method: r.payment?.method,
        amount: -Number(r.amount), // Negative for UI display
        guest: r.payment?.folio?.reservation?.primaryGuest,
        reservationId: r.payment?.folio?.reservation?.id,
        staffId: r.authorizedBy,
        status: r.status,
      });
    });
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shift & Cashier Report</h1>
          <p className="text-muted-foreground mt-1">
            Reconcile payments and refunds for {format(new Date(date), 'PP')}
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
            <label className="text-sm font-medium">Date</label>
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Cashier</label>
            <Select value={userId} onValueChange={(val) => setUserId(val || 'ALL')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue>
                  {userId === 'ALL' ? 'All Users' : 'My Transactions'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Users</SelectItem>
                {/* Real app would populate staff members based on role */}
                <SelectItem value={session?.user?.id || 'ME'}>My Transactions</SelectItem>
              </SelectContent>
            </Select>
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
        <>
          <div className="grid grid-cols-1 gap-6">
            {report?.cashierTotals && (
              <Card>
                <CardHeader><CardTitle>Enterprise cashier control totals</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div><p className="text-xs text-muted-foreground">Gross receipts</p><p className="text-xl font-bold">{formatCurrency(report.cashierTotals.gross)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Refunds</p><p className="text-xl font-bold text-red-600">{formatCurrency(report.cashierTotals.refunds)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Net receipts</p><p className="text-xl font-bold text-emerald-700">{formatCurrency(report.cashierTotals.net)}</p></div>
                  <div><p className="text-xs text-muted-foreground">POS shifts</p><p className="text-xl font-bold">{report.cashierTotals.posSessions}</p></div>
                  <div><p className="text-xs text-muted-foreground">POS cash</p><p className="text-xl font-bold">{formatCurrency(report.cashierTotals.posCash)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pending sync conflicts</p><p className={`text-xl font-bold ${report.cashierTotals.pendingSyncConflicts ? 'text-amber-600' : 'text-emerald-700'}`}>{report.cashierTotals.pendingSyncConflicts}</p></div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Method Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Gross Payments</TableHead>
                      <TableHead className="text-right text-red-600">Refunds</TableHead>
                      <TableHead className="text-right font-bold">Net Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {methods.map((method) => {
                      const stats = report?.summary?.[method] || { count: 0, refundCount: 0, payments: 0, refunds: 0, net: 0 };
                      if (stats.payments === 0 && stats.refunds === 0) return null;
                      return (
                        <TableRow key={method}>
                              <TableCell className="font-medium">{method.replaceAll('_', ' ')} <span className="text-xs text-muted-foreground">({stats.count} / {stats.refundCount} refunds)</span></TableCell>
                          <TableCell className="text-right">{formatCurrency(stats.payments)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(stats.refunds)}</TableCell>
                          <TableCell className={`text-right font-bold ${method === 'CASH' ? 'text-green-700 bg-green-50/50' : ''}`}>
                            {formatCurrency(stats.net)}
                            {method === 'CASH' && <span className="ml-2 text-xs uppercase text-green-700">(Till Cash)</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(totalGross)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">{formatCurrency(totalRefunds)}</TableCell>
                      <TableCell className="text-right font-bold text-lg">{formatCurrency(totalNet)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Details</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center p-6">No transactions found for this period.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Reservation</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={`${t.type}-${t.id}`}>
                          <TableCell className="whitespace-nowrap">{format(new Date(t.date), 'HH:mm:ss')}</TableCell>
                          <TableCell>
                            <Badge variant={t.type === 'PAYMENT' ? 'default' : 'destructive'} className="text-xs">
                              {t.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{t.method}</TableCell>
                          <TableCell>{t.guest?.firstName} {t.guest?.lastName}</TableCell>
                          <TableCell className="font-mono text-xs">{t.reservationId?.slice(0, 8).toUpperCase()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground" title={t.staffId}>
                            {t.staffId?.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">{t.status}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${t.amount < 0 ? 'text-red-600' : ''}`}>
                            {formatCurrency(t.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
