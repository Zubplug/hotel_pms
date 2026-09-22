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

  const handlePrint = () => window.print();

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
    <div className="border-t border-slate-200 mt-12 pt-4 flex justify-between items-center text-[9px] text-slate-400">
      <p>
        * This report represents transactions recorded against the specified business date.{' '}
        Variances may occur if transactions are backdated after generation.
      </p>
      <p>LodgeCore PMS &copy; {new Date().getFullYear()}</p>
    </div>
  );

  return (
    <>
      {/* ── Print CSS ──────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
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
            width: 210mm;
            box-sizing: border-box;
            padding: 10mm;
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

          .na-print-layer thead {
            display: table-header-group;
          }

          .na-print-layer tfoot {
            display: table-footer-group;
          }

          .na-print-layer tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Header/footer blocks never split across pages */
          .na-print-header,
          .na-print-footer {
            break-inside: avoid;
            page-break-inside: avoid;
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
        <div>{children}</div>
        <div className="na-print-footer">
          <ReportFooter />
        </div>
      </div>
    </>
  );
}
