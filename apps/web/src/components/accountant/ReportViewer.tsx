'use client';

import React from 'react';
import { Download, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';

export interface ReportColumn {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  format?: 'money' | 'date' | 'text' | 'number';
}

export interface ReportData {
  id: string; // Deterministic ID e.g., TB-STR-20260920-000184
  title: string;
  property: string;
  businessDate: Date;
  generatedAt: Date;
  generatedBy: string;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
  filtersHash?: string;
}

export function ReportViewer({ data, currency = 'NGN' }: { data: ReportData, currency?: string }) {
  const money = (val: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(val);

  const formatCell = (val: unknown, formatType?: string) => {
    if (val === null || val === undefined) return '-';
    if (formatType === 'money') return money(Number(val));
    if (formatType === 'date') return format(new Date(val), 'MMM dd, yyyy HH:mm');
    if (formatType === 'number') return Number(val).toLocaleString();
    return String(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = data.columns.map(column => column.header);
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const rows = data.rows.map(row => data.columns.map(column => escape(row[column.key])).join(','));
    const csv = `\ufeff${[headers.map(escape).join(','), ...rows].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${data.id.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white text-slate-900 shadow-xl rounded-lg overflow-hidden flex flex-col w-full max-w-6xl mx-auto border border-slate-200">

      {/* Export & Actions Toolbar (Not visible when printing) */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center print:hidden">
        <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Report Engine
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm text-slate-700">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-600 border border-cyan-700 rounded hover:bg-cyan-700 shadow-sm text-white">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Canvas (This is what gets printed) */}
      <div className="p-8 bg-white print:p-0 print:w-full">
        {/* Report Header */}
        <header className="border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">{data.title}</h1>
              <p className="text-lg font-medium text-slate-700">{data.property}</p>
            </div>
            <div className="text-right text-sm">
              <p><strong>Business Date:</strong> {format(data.businessDate, 'MMMM dd, yyyy')}</p>
              <p><strong>Report ID:</strong> <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{data.id}</span></p>
            </div>
          </div>
        </header>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                {data.columns.map(col => (
                  <th key={col.key} className={`py-2 px-3 font-semibold text-slate-800 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {data.columns.map(col => (
                    <td key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : ''}`}>
                      {formatCell(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={data.columns.length} className="py-8 text-center text-slate-500 italic">No records found for this period.</td>
                </tr>
              )}
            </tbody>
            {/* Report Summary/Totals */}
            {data.summary && (
              <tfoot className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                <tr>
                  {data.columns.map((col, i) => (
                    <td key={col.key} className={`py-3 px-3 ${col.align === 'right' ? 'text-right font-mono text-slate-900' : ''}`}>
                      {i === 0 ? 'TOTALS' : (data.summary?.[col.key] !== undefined ? formatCell(data.summary[col.key], col.format) : '')}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Report Footer / Audit Trace */}
        <footer className="mt-12 pt-4 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
          <div>
            <p>Generated by: <strong>{data.generatedBy}</strong> at {format(data.generatedAt, 'yyyy-MM-dd HH:mm:ss')}</p>
            {data.filtersHash && <p>Filter Hash: <span className="font-mono">{data.filtersHash}</span></p>}
          </div>
          <div className="text-right">
            <p>End of Report</p>
            <p>LodgeCore Financial Systems</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
