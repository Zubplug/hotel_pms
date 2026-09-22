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
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          /* Real margins so content on pages 2+ isn't flush to the paper edge */
          margin: 15mm 12mm;
        }

        @media print {
          html,
          body {
            width: 210mm;
            min-width: 210mm;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }

          /* Hide screen chrome */
          .night-audit-screen-only {
            display: none !important;
          }

          .night-audit-print-root {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* The sheet must NEVER clip — this was the primary cutoff bug */
          .night-audit-a4-sheet {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .night-audit-a4-content {
            box-sizing: border-box;
            width: 100%;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important; /* @page margin handles spacing */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Header & footer: never split across a page break */
          .night-audit-report-header,
          .night-audit-report-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Tables: repeat header on every page, rows don't split */
          .night-audit-a4-content table {
            page-break-inside: auto;
          }

          .night-audit-a4-content thead {
            display: table-header-group;
          }

          .night-audit-a4-content tfoot {
            display: table-footer-group;
          }

          .night-audit-a4-content tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="night-audit-print-root relative min-h-screen overflow-x-auto py-10 print:overflow-visible print:bg-white print:py-0">
      {/* Dark premium background (hidden during print) */}
      <div className="fixed inset-0 pointer-events-none -z-10 print:hidden" style={{ background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' }} />
      {/* Floating Action Bar (Hidden in Print) */}
      <div className="mx-auto mb-8 flex w-[210mm] items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadPdf}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-6 py-2.5 text-sm font-bold text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all hover:bg-indigo-400/20"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
        </div>
      </div>

      {/* A4 Paper Container — overflow must NOT be hidden; content must flow freely to page 2+ */}
      <div className="night-audit-a4-sheet mx-auto w-[210mm] overflow-visible rounded-xl bg-white shadow-[0_30px_100px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/20 print:rounded-none print:shadow-none print:ring-0">
        
        {/* Report Content Wrapper */}
        <div className="night-audit-a4-content relative p-10 font-sans text-[11px] leading-relaxed text-slate-900">
          
          {/* Subtle print watermark pattern (visible only on screen to look like paper) */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] print:hidden" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          {/* Header */}
          <div className="night-audit-report-header border-b-[3px] border-slate-900 pb-5 mb-6 flex justify-between items-start gap-4">
            
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
          <div>
            {children}
          </div>

          {/* Footer */}
          <div className="night-audit-report-footer border-t border-slate-200 mt-12 pt-4 flex justify-between items-center text-[9px] text-slate-400">
            <p>
              * This report represents transactions recorded against the specified business date. 
              Variances may occur if transactions are backdated after generation.
            </p>
            <p>LodgeCore PMS &copy; {new Date().getFullYear()}</p>
          </div>

        </div>
      </div>
      </div>
    </>
  );
}
