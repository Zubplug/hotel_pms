"use client";

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ExportRow = { name: string; type: string; balance: number; status: string; oldestOpenItem: string; lastPayment: string };

export function ExportReceivablesButton({ rows, currency }: { rows: ExportRow[]; currency: string }) {
  const exportReport = () => {
    const header = ['Account', 'Type', 'Oldest Open Item', 'Last Payment', 'Status', `Balance (${currency})`];
    const csv = [header, ...rows.map(row => [row.name, row.type, row.oldestOpenItem, row.lastPayment, row.status, row.balance.toFixed(2)])]
      .map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receivables-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <Button type="button" onClick={exportReport} variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"><Download className="mr-2 h-4 w-4" />Export report</Button>;
}
