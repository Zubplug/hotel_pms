'use client';

import React from 'react';
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
  onDownloadPdf,
}: A4ReportWrapperProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const auditorName = session?.user?.name || session?.user?.email || 'System';

  const handlePrint = () => {
    const screenEl = document.querySelector('.na-screen-layer') as HTMLElement | null;
    const printEl  = document.querySelector('.na-print-layer')  as HTMLElement | null;

    const show = () => {
      if (screenEl) screenEl.style.display = 'none';
      if (printEl)  printEl.style.display  = 'block';
    };
    const restore = () => {
      if (screenEl) screenEl.style.removeProperty('display');
      if (printEl)  printEl.style.display  = 'none';
    };

    show();
    window.onafterprint = restore;
    window.print();
    // Fallback restore (Safari doesn't always fire onafterprint)
    setTimeout(restore, 1000);
  };

  const formattedDate = new Date(businessDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const generatedAt = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // ─── Shared report sections (rendered in both screen + print layers) ───────

  const ReportHeader = () => (
    <div className="border-b-[3px] border-slate-900 pb-5 mb-6 flex justify-between items-start gap-4">
      {/* Left: Property Info */}
      <div className="flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase mb-2 leading-none">
          {propertyName}
        </h1>
        {(propertyAddress || propertyEmail || propertyPhone) && (
          <div className="text-[10px] font-medium text-slate-600 space-y-1.5">
            {propertyAddress && (
              <div className="max-w-[250px] leading-snug">{propertyAddress}</div>
            )}
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
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded shadow-sm border border-slate-200 text-right">
          {title}
        </h2>
        <div className="mt-3 text-right">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            Business Date
          </div>
          <div className="text-lg font-bold text-indigo-700 whitespace-nowrap">
            {formattedDate}
          </div>
        </div>
      </div>
    </div>
  );

  const ReportMeta = () => (
    <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-600 uppercase tracking-wider bg-slate-50 border border-slate-200 p-3 rounded mb-8 shadow-sm">
      <div><strong className="text-slate-400 mr-1">Generated:</strong> {generatedAt}</div>
      <div><strong className="text-slate-400 mr-1">By:</strong> {auditorName}</div>
      <div>
        <strong className="text-slate-400 mr-1">Status:</strong>
        <span className={status === 'CLOSED' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
          {status}
        </span>
      </div>
      <div><strong className="text-slate-400 mr-1">Ref:</strong> {reportId}</div>
    </div>
  );

  const ReportFooter = () => (
    <div className="w-full border-t-2 border-slate-300 mt-6 print:mt-0 pt-2 flex justify-between items-end text-[8px] text-slate-500 bg-white">
      <div className="max-w-[75%] leading-relaxed">
        * This report represents transactions recorded against the specified business date. 
        Variances may occur if transactions are backdated after generation.
      </div>
      <div className="text-right font-semibold text-slate-600 pb-0.5">
        LodgeCore PMS &copy; {new Date().getFullYear()}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Print CSS ──────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 15mm 10mm 12mm 10mm; /* top right bottom left */
        }

        @media print {
          /*
           * Belt-and-braces: reset every ancestor that could constrain height.
           * The NightAuditLayout root has h-screen overflow-hidden which caps
           * the entire render to one viewport height — this overrides it.
           */
          html, body,
          body > *,
          #__next,
          #__next > *,
          main {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          html, body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Hide the screen preview layer */
          .na-screen-layer {
            display: none !important;
          }

          /* Show the flat print layer */
          .na-print-layer {
            display: block !important;
            width: 100%;
            box-sizing: border-box;
            font-family: ui-sans-serif, system-ui, sans-serif;
            font-size: 11px;
            line-height: 1.6;
            color: #0f172a;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Tables: thead repeats on every page, rows never split */
          .na-print-layer table {
            page-break-inside: auto;
            width: 100%;
          }

          /* thead repeats at the top of every page the table spans */
          .na-print-layer thead {
            display: table-header-group;
          }

          /*
           * tfoot must NOT use table-footer-group — that causes the browser
           * to repeat the totals row at the bottom of EVERY page the table
           * spans, producing duplicate footer rows. Let it render once only,
           * at the natural end of the table.
           */
          .na-print-layer tfoot:not(.print-layout-tfoot) {
            display: table-row-group;
          }

          .na-print-layer tr:not(.print-layout-row) {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* The layout table MUST break, otherwise Chrome pushes the entire report to page 2 */
          .print-layout-table,
          .print-layout-row {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          /* Header blocks never split across pages */
          .na-print-header {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* The invisible spacer repeats on every page to reserve 25mm of space */
          .print-layout-tfoot-spacer {
            display: table-footer-group !important;
          }

          /* The actual footer is fixed at the absolute bottom of the printable area */
          .na-print-footer-fixed {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: white;
            z-index: 50;
            padding-top: 2mm;
          }
        }
      `}</style>


      {/* ── Screen layer (hidden when printing) ────────────────────────────── */}
      <div className="na-screen-layer relative min-h-screen overflow-x-auto py-10" >
        {/* Dark background */}
        <div
          className="fixed inset-0 pointer-events-none -z-10"
          style={{ background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' }}
        />

        {/* Action bar */}
        <div className="mx-auto mb-8 flex w-[210mm] items-center justify-between">
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

        {/* A4 paper preview */}
        <div className="mx-auto w-[210mm] overflow-visible rounded-xl bg-white shadow-[0_30px_100px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/20">
          <div className="relative p-10 font-sans text-[11px] leading-relaxed text-slate-900">
            {/* Dot-grid watermark (screen only) */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.02]"
              style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            />
            <ReportHeader />
            <ReportMeta />
            <div>{children}</div>
            <ReportFooter />
          </div>
        </div>
      </div>

      {/* ── Print layer (hidden on screen, shown when printing) ─────────────
           This is a completely flat div — no overflow, no shadow, no border-
           radius, no fixed heights. The browser print engine sees it as a
           plain flowing document and paginates across as many A4 pages as
           the content requires.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="na-print-layer" style={{ display: 'none' }}>
        <div className="na-print-header">
          <ReportHeader />
        </div>
        <ReportMeta />
        
        <table className="w-full print-layout-table">
          <tbody>
            <tr className="print-layout-row">
              <td className="p-0 align-top">
                {children}
              </td>
            </tr>
          </tbody>
          {/* This tfoot is INVISIBLE. It exists solely to reserve 15mm of space at the bottom of every page so the fixed footer doesn't overlap the table content. */}
          <tfoot className="print-layout-tfoot-spacer">
            <tr>
              <td className="p-0 border-none">
                <div style={{ height: '15mm' }}></div>
              </td>
            </tr>
          </tfoot>
        </table>

        {/* The ACTUAL footer is fixed to the bottom of the page */}
        <div className="na-print-footer-fixed">
          <ReportFooter />
        </div>
      </div>
    </>
  );
}
