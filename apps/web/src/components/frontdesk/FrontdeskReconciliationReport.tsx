'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCcw, ArrowDownToLine, ArrowUpFromLine, WalletCards, Printer, Download, CalendarDays, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { exportToCSV } from '@/lib/export-utils';

type ReportRow = {
  id: string;
  kind: string;
  sessionId?: string;
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

export function FrontdeskReconciliationReport() {
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const session = useLodgeCoreSession();

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch report data
  const query = useQuery({
    queryKey: ['frontdesk-reconciliation', propertyId, startDate, endDate],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const result = await provider.frontdesk.getReport(
        propertyId!,
        startOfDay(new Date(startDate)).toISOString(),
        endOfDay(new Date(endDate)).toISOString(),
      );
      if (result.error) throw new Error(result.error?.message || result.error);
      return (result.data || result) as { rows: ReportRow[]; totals: { inflows: number; outflows: number; net: number; sessions: number } };
    },
  });

  // Fetch property details for the print header
  const propertyQuery = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await provider.properties.list();
      return (res.data || res) as any[];
    }
  });

  const activeProperty = propertyQuery.data?.find((p: any) => p.id === propertyId);
  const staffName = session.data?.user?.name || 'Authorized Staff';

  const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  const rows = query.data?.rows || [];
  const reportId = `FD-REC-${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`;
  const methodTotals = useMemo(() => rows.reduce<Record<string, number>>((totals, row) => {
    const key = (row.method || 'OTHER').toUpperCase();
    totals[key] = (totals[key] || 0) + (row.direction === 'INFLOW' ? row.amount : -row.amount);
    return totals;
  }, {}), [rows]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!rows.length) return;
    const headers = ['Date', 'Direction', 'Type', 'Description', 'Guest', 'Rooms', 'Folio', 'Method', 'Reference', 'Shift', 'Amount'];
    const csvRows = rows.map(r => [
      format(new Date(r.date), 'dd MMM yyyy HH:mm'),
      r.direction,
      r.type,
      r.description,
      r.guest || '',
      r.rooms.join('; '),
      r.folioNumber || '',
      r.method,
      r.reference || '',
      r.shiftReference || '',
      r.amount
    ]);
    exportToCSV(`frontdesk-reconciliation-${startDate}-to-${endDate}.csv`, headers, csvRows);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-5">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Official financial record</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">{activeProperty?.name || 'Hotel Property'}</h1>
            <p className="mt-1 text-xs text-gray-600">{activeProperty?.address || 'Address Not Available'}</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-bold text-slate-900">{reportId}</p>
            <p className="mt-1">Generated {format(new Date(), 'dd MMM yyyy · HH:mm')}</p>
            <p>Prepared by {staffName}</p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-bold">Front Desk Reconciliation Report</h2>
          <p className="mt-1 text-sm text-gray-500">Reporting period: {format(new Date(startDate), 'dd MMM yyyy')} — {format(new Date(endDate), 'dd MMM yyyy')}</p>
        </div>
      </div>

      {/* Screen Header (Hidden when printing) */}
      <div className="flex flex-col gap-5 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-300/40 md:flex-row md:items-end md:justify-between print:hidden">
        <div>
          <div className="mb-3 flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.2em]">Controlled audit workspace</span></div>
          <h1 className="text-3xl font-black tracking-tight">Front Desk Reconciliation</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review every cashier movement, payment, charge, and exception across the selected business dates before filing the official report.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-300"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Report {reportId}</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Prepared by {staffName}</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length || query.isFetching}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!rows.length || query.isFetching}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => query.refetch()} disabled={query.isFetching} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Date Filters (Hidden when printing) */}
      <Card className="print:hidden border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-end justify-between gap-6 p-5">
          <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-indigo-600" />Start date</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[180px] border-slate-300" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-indigo-600" />End date</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-[180px] border-slate-300" />
          </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><FileSpreadsheet className="h-4 w-4" />{rows.length} ledger entries · {query.data?.totals.sessions || 0} shifts</div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <div className="flex justify-center p-12 print:hidden">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : query.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm print:hidden">
          <h3 className="font-semibold mb-1">Failed to load accountability data</h3>
          <p className="text-sm">{(query.error as Error).message}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4 print:grid-cols-4">
            <SummaryCard label="Total Inflows" value={money(query.data?.totals.inflows || 0)} tone="text-emerald-600" bg="bg-emerald-50/50" icon={<ArrowDownToLine className="text-emerald-500" />} />
            <SummaryCard label="Total Outflows" value={money(query.data?.totals.outflows || 0)} tone="text-rose-600" bg="bg-rose-50/50" icon={<ArrowUpFromLine className="text-rose-500" />} />
            <SummaryCard label="Net Movement" value={money(query.data?.totals.net || 0)} tone="text-slate-900" bg="bg-slate-50" icon={<WalletCards className="text-slate-500" />} />
            <SummaryCard label="Frontdesk Shifts" value={String(query.data?.totals.sessions || 0)} tone="text-indigo-600" bg="bg-indigo-50/50" icon={<WalletCards className="text-indigo-500" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] print:grid-cols-2">
            <Card className="border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-300">
              <CardHeader className="border-b border-slate-100 px-5 py-4"><CardTitle className="text-base">Movement by channel</CardTitle><CardDescription>Net recorded movement by transaction source</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 print:p-4">
                {['CASH', 'CARD', 'BANK TRANSFER', 'FOLIO'].map(method => <div key={method} className="rounded-xl bg-slate-50 p-3 print:border print:border-slate-200 print:bg-white"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{method}</p><p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{money(methodTotals[method] || 0)}</p></div>)}
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-300">
              <CardHeader className="border-b border-slate-100 px-5 py-4"><CardTitle className="text-base">Control status</CardTitle><CardDescription>Scope and filing reference</CardDescription></CardHeader>
              <CardContent className="space-y-3 p-5 text-sm print:p-4"><div className="flex justify-between gap-4"><span className="text-slate-500">Report ID</span><span className="font-mono font-semibold text-slate-900">{reportId}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Ledger lines</span><span className="font-semibold text-slate-900">{rows.length}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Prepared by</span><span className="font-semibold text-slate-900">{staffName}</span></div></CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4 print:bg-white print:px-0">
              <CardTitle className="text-lg">Transaction Detail</CardTitle>
              <CardDescription>Line-by-line ledger of all recorded activities</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 print:overflow-visible">
              <table className="w-full min-w-[1250px] print:min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-100/50 print:bg-transparent text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    {['Date', 'Direction', 'Type / Description', 'Guest / Room', 'Folio / Res', 'Method', 'Shift', 'Amount'].map((heading) => (
                      <th key={heading} className="px-6 py-4 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="hover:bg-slate-50/50 print:hover:bg-transparent transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600 print:text-black">
                        {format(new Date(row.date), 'dd MMM yyyy')}
                        <div className="text-xs text-slate-400 print:text-gray-500 mt-0.5">{format(new Date(row.date), 'HH:mm')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          row.direction === 'INFLOW'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 print:border-none print:p-0 print:bg-transparent'
                            : 'bg-rose-50 text-rose-700 border-rose-200 print:border-none print:p-0 print:bg-transparent'
                        }`}>
                          {row.direction}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-6 py-4">
                        <div className="font-medium text-slate-900 print:text-black">{row.type}</div>
                        <div className="text-slate-500 print:text-gray-600 text-xs mt-0.5 truncate" title={row.description}>{row.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 print:text-black">{row.guest || '—'}</div>
                        <div className="text-slate-500 print:text-gray-600 text-xs mt-0.5">
                          {row.rooms.length ? (
                            <span className="inline-flex items-center gap-1">
                              Room {row.rooms.join(', ')}
                            </span>
                          ) : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 print:text-black">{row.folioNumber || '—'}</div>
                        <div className="text-slate-500 print:text-gray-600 text-xs mt-0.5">{row.confirmationNumber || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 print:text-black">{row.method}</div>
                        <div className="text-slate-500 print:text-gray-600 text-xs mt-0.5 truncate" title={row.reference || ''}>{row.reference || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-mono bg-slate-100 print:bg-transparent print:font-sans px-2 py-1 rounded text-slate-600">
                          {row.shiftReference || '—'}
                        </div>
                      </td>
                      <td className={`whitespace-nowrap px-6 py-4 text-right font-bold tracking-tight ${row.direction === 'INFLOW' ? 'text-emerald-600' : 'text-rose-600'} print:text-black`}>
                        {row.direction === 'INFLOW' ? '+' : '-'}{money(row.amount)}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        No financial activities recorded for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Print Footer (Only visible when printing) */}
          <div className="hidden print:block mt-12 pt-8 border-t border-gray-300">
             <div className="flex justify-between">
                <div className="w-1/3 text-center">
                   <div className="border-b border-black w-full mb-2"></div>
                   <span className="text-xs font-medium text-gray-700">Prepared By (Signature)</span>
                </div>
                <div className="w-1/3 text-center">
                   <div className="border-b border-black w-full mb-2"></div>
                   <span className="text-xs font-medium text-gray-700">Authorized By (Signature)</span>
                </div>
             </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone, icon, bg }: { label: string; value: string; tone: string; icon: ReactNode, bg: string }) {
  return (
    <Card className={`border-slate-200 shadow-sm print:shadow-none print:border-gray-300 ${bg} print:bg-transparent`}>
      <CardContent className="flex items-center justify-between p-6 print:p-4">
        <div>
          <div className="text-sm font-medium text-slate-600 print:text-gray-600">{label}</div>
          <div className={`mt-2 text-3xl font-bold tracking-tight ${tone} print:text-black`}>{value}</div>
        </div>
        <div className="rounded-full bg-white/60 print:hidden p-3 shadow-sm border border-black/5">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
