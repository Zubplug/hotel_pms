'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface A4ReportWrapperProps {
  title: string;
  propertyName: string;
  businessDate: string;
  reportId: string;
  status?: string;
  children: React.ReactNode;
  onDownloadPdf?: () => void;
}

export function A4ReportWrapper({
  title,
  propertyName,
  businessDate,
  reportId,
  status = 'Closed',
  children,
  onDownloadPdf
}: A4ReportWrapperProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const auditorName = session?.user?.name || session?.user?.email || 'System';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      
      {/* Floating Action Bar (Hidden in Print) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => router.back()} className="bg-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onDownloadPdf} className="bg-white">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
          <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Report
          </Button>
        </div>
      </div>

      {/* A4 Paper Container */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-xl rounded-sm overflow-hidden print:shadow-none print:rounded-none">
        
        {/* Report Content Wrapper */}
        <div className="p-10 text-slate-900 font-sans text-[11px] leading-relaxed">
          
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">{propertyName}</h1>
                <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest">{title}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">Business Date</div>
                <div className="text-lg font-bold text-indigo-700">
                  {new Date(businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Audit Metadata */}
            <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider bg-slate-50 p-2 rounded">
              <div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
              <div><strong>By:</strong> {auditorName}</div>
              <div><strong>Status:</strong> {status}</div>
              <div><strong>Ref:</strong> {reportId}</div>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-[500px]">
            {children}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 mt-12 pt-4 flex justify-between items-center text-[9px] text-slate-400">
            <p>
              * This report represents transactions recorded against the specified business date. 
              Variances may occur if transactions are backdated after generation.
            </p>
            <p>LodgeCore PMS &copy; {new Date().getFullYear()}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
