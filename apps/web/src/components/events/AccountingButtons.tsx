'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type InvoiceExportRow = { event: string; status: string; total: number; paid: number; currency: string };

export function ExportReportButton({ invoices }: { invoices: InvoiceExportRow[] }) {
  const handleExport = () => {
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [['Event', 'Status', 'Total', 'Paid', 'Currency'], ...invoices.map(row => [row.event, row.status, row.total, row.paid, row.currency])].map(row => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-accounting-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Event accounting report exported.');
  };
  
  return (
    <Button variant="outline" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" /> Export Report
    </Button>
  );
}

export function ViewInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();

  return (
    <Button variant="ghost" size="sm" onClick={() => router.push(`/fnb/events/accounting/${invoiceId}`)}>
      <FileText className="h-4 w-4" />
    </Button>
  );
}
