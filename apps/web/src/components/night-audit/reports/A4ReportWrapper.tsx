'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface A4ReportWrapperProps {
  title: string;
  propertyName: string;
  propertyEmail?: string;
  propertyPhone?: string;
  propertyAddress?: string;
  businessDate: string;
  reportId: string;
  status?: string;
  children: React.ReactNode;
  onDownloadPdf?: () => void;
}

export function A4ReportWrapper({
  title,
  propertyName,
  propertyEmail,
  propertyPhone,
  propertyAddress,
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
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0 overflow-x-auto">
      
      {/* Floating Action Bar (Hidden in Print) */}
      <div className="w-[210mm] mx-auto mb-6 flex items-center justify-between print:hidden">
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
      <div className="w-[210mm] mx-auto bg-white shadow-xl rounded-sm print:shadow-none print:rounded-none">
        
        {/* Report Content Wrapper */}
        <div className="p-8 md:p-10 text-slate-900 font-sans text-[11px] leading-relaxed">
          
          {/* Header */}
          <div className="border-b-[3px] border-slate-900 pb-5 mb-6 flex justify-between items-start gap-4">
            
            {/* Left: Property Info (Letterhead style) */}
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase mb-2 leading-none">{propertyName}</h1>
              {(propertyAddress || propertyEmail || propertyPhone) && (
                <div className="text-[10px] font-medium text-slate-600 space-y-1.5">
                  {propertyAddress && <div className="max-w-[250px] leading-snug">{propertyAddress}</div>}
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    {propertyPhone && (
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold uppercase">Tel:</span> {propertyPhone}
                      </span>
                    )}
                    {propertyPhone && propertyEmail && <span className="text-slate-300">|</span>}
                    {propertyEmail && (
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold uppercase">Email:</span> {propertyEmail}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Report Info */}
            <div className="text-right flex flex-col items-end shrink-0 max-w-[250px]">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded shadow-sm border border-slate-200 text-right">{title}</h2>
              <div className="mt-3 text-right">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Business Date</div>
                <div className="text-lg font-bold text-indigo-700 whitespace-nowrap">
                  {new Date(businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          {/* Audit Metadata */}
          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-600 uppercase tracking-wider bg-slate-50 border border-slate-200 p-3 rounded mb-8 shadow-sm">
            <div><strong className="text-slate-400 mr-1">Generated:</strong> {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            <div><strong className="text-slate-400 mr-1">By:</strong> {auditorName}</div>
            <div><strong className="text-slate-400 mr-1">Status:</strong> <span className={status === 'CLOSED' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{status}</span></div>
            <div><strong className="text-slate-400 mr-1">Ref:</strong> {reportId}</div>
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
