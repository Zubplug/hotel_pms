'use client';

import { useState, type ReactNode } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCcw, ArrowDownToLine, ArrowUpFromLine, WalletCards } from 'lucide-react';

type ReportRow = {
  id: string;
  kind: string;
  sessionId: string;
  shiftReference: string;
  date: string;
  direction: 'INFLOW' | 'OUTFLOW';
  amount: number;
  currency: string;
  method: string;
  type: string;
  description: string;
  reference?: string | null;
  confirmationNumber?: string | null;
  folioNumber?: string | null;
  guest?: string | null;
  rooms: string[];
};

export default function FrontdeskReconciliationPage() {
  const { propertyId } = useProperty();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const query = useQuery({
    queryKey: ['frontdesk-reconciliation', propertyId, startDate, endDate],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: propertyId!,
        startDate: startOfDay(new Date(startDate)).toISOString(),
        endDate: endOfDay(new Date(endDate)).toISOString(),
      });
      const response = await fetch(`/api/v1/reports/frontdesk-reconciliation?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load report');
      return body.data as { rows: ReportRow[]; totals: { inflows: number; outflows: number; net: number; sessions: number } };
    },
  });

  const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  const rows = query.data?.rows || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Frontdesk Reconciliation</h1>
          <p className="mt-1 text-muted-foreground">Trace every frontdesk inflow and outflow back to its shift, guest, folio, room, and payment reference.</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <label className="space-y-1 text-sm font-medium">Start date<Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="space-y-1 text-sm font-medium">End date<Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </CardContent>
      </Card>

      {query.isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : query.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{(query.error as Error).message}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Total inflows" value={money(query.data?.totals.inflows || 0)} tone="text-emerald-600" icon={<ArrowDownToLine />} />
            <SummaryCard label="Total outflows" value={money(query.data?.totals.outflows || 0)} tone="text-rose-600" icon={<ArrowUpFromLine />} />
            <SummaryCard label="Net movement" value={money(query.data?.totals.net || 0)} tone="text-slate-900" icon={<WalletCards />} />
            <SummaryCard label="Frontdesk shifts" value={String(query.data?.totals.sessions || 0)} tone="text-indigo-600" icon={<WalletCards />} />
          </div>

          <Card>
            <CardHeader><CardTitle>Transaction detail</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[1250px] text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>{['Date', 'Direction', 'Type / description', 'Guest / room', 'Folio / reservation', 'Method', 'Shift', 'Amount'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">{format(new Date(row.date), 'dd MMM yyyy, HH:mm')}</td>
                      <td className="px-4 py-3"><Badge variant={row.direction === 'INFLOW' ? 'default' : 'destructive'}>{row.direction}</Badge></td>
                      <td className="max-w-[260px] px-4 py-3"><div className="font-medium">{row.type}</div><div className="text-muted-foreground">{row.description}</div></td>
                      <td className="px-4 py-3"><div>{row.guest || '—'}</div><div className="text-muted-foreground">{row.rooms.length ? row.rooms.join(', ') : '—'}</div></td>
                      <td className="px-4 py-3"><div>{row.folioNumber || '—'}</div><div className="text-muted-foreground">{row.confirmationNumber || '—'}</div></td>
                      <td className="px-4 py-3"><div>{row.method}</div><div className="text-muted-foreground">{row.reference || '—'}</div></td>
                      <td className="px-4 py-3 text-xs">{row.shiftReference}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${row.direction === 'INFLOW' ? 'text-emerald-600' : 'text-rose-600'}`}>{row.direction === 'INFLOW' ? '+' : '-'}{money(row.amount)}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No frontdesk transactions found for this date range.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between p-5"><div><div className="text-sm text-muted-foreground">{label}</div><div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div></div><div className="text-muted-foreground">{icon}</div></CardContent></Card>;
}
