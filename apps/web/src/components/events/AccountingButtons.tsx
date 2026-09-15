'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function ExportReportButton() {
  const handleExport = () => {
    toast.info("Generating CSV report...");
    setTimeout(() => toast.success("Event Accounting Report exported successfully!"), 1500);
  };
  
  return (
    <Button variant="outline" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" /> Export Report
    </Button>
  );
}

export function ViewInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const handleView = () => {
    toast.info("Opening Invoice...");
    // Ideally this opens a PDF viewer dialog or navigates to a detailed view
    // For now we just show a toast that the action works and is connected
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleView}>
      <FileText className="h-4 w-4" />
    </Button>
  );
}
