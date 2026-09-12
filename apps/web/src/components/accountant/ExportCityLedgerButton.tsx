"use client";

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Row = { name: string; type: string; balance: number; currency: string; status: string };

export function ExportCityLedgerButton({ rows, currency }: { rows: Row[]; currency: string }) {
  const exportReport = () => {
    const lines = [['Account', 'Type', 'Status', `Balance (${currency})`], ...rows.map(row => [row.name, row.type, row.status, row.balance.toFixed(2)])];
    const csv = lines.map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `city-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <Button type="button" variant="outline" onClick={exportReport} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"><Download className="mr-2 h-4 w-4" />Export report</Button>;
}
