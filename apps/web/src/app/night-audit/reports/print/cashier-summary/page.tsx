/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/static-components */
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function CashierSummaryReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/cashier-summary?propertyId=${propertyId}&businessDate=${businessDate}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch report');
          return res.json();
        })
        .then(res => {
          setData(res.data || res);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setError("Missing propertyId or businessDate");
      setLoading(false);
    }
  }, [propertyId, businessDate]);

  const formatCurrency = (amount: number = 0, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  if (error || !data) {
    return <div className="flex h-screen items-center justify-center text-rose-500 font-medium">{error || 'Failed to load data'}</div>;
  }

  const { cashiers = [] } = data;
  const currencyCode = data.propertyCurrency || 'NGN';
  const totals = data.totals || {};
  const controls = data.controls || {};

  const TableSection = ({ title, children, status, shift }: { title: string, children: React.ReactNode, status?: string, shift?: string }) => (
    <div className="mb-8 border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">{title}</h2>
        <div className="flex gap-4 text-xs font-semibold text-slate-600">
          {shift && <span>Shift: {shift}</span>}
          {status && <span>Status: {status}</span>}
        </div>
      </div>
      <div className="px-4 py-3">
        <table className="w-full text-xs">
          <tbody>
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );

  const TableRow = ({ label, value, isBold = false, isTotal = false, isNegative = false }: { label: string, value: React.ReactNode, isBold?: boolean, isTotal?: boolean, isNegative?: boolean }) => (
    <tr className={`${isTotal ? 'border-t-2 border-slate-800 font-bold' : isBold ? 'font-semibold' : ''} ${isTotal ? 'bg-slate-50' : ''}`}>
      <td className={`py-1.5 px-2 ${isTotal ? 'py-2' : ''}`}>{label}</td>
      <td className={`py-1.5 px-2 text-right ${isTotal ? 'py-2' : ''} ${isNegative ? 'text-red-600' : ''}`}>{value}</td>
    </tr>
  );

  return (
    <A4ReportWrapper
      title="Cashier Shift Summary"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`CSH-${(businessDate || 'REPORT').replaceAll('-', '')}`}
      status={data.auditStatus || 'CLOSED'}
    >
      
      <div className="mb-5 grid grid-cols-4 gap-2 text-xs">
        {[['Sessions', controls.sessionCount || 0], ['Payments', controls.paymentCount || totals.paymentCount || 0], ['Exceptions', controls.exceptionCount || 0], ['Approved', `${controls.approvedCount || 0} / ${controls.sessionCount || 0}`]].map(([label, value]) => <div key={String(label)} className="border border-slate-200 p-2"><div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-900">{value}</div></div>)}
      </div>
      {!cashiers || cashiers.length === 0 ? (
        <div className="py-20 text-center text-slate-500 italic">No records for this business date.</div>
      ) : (
        <div className="space-y-6">
          {cashiers.map((cashier: any, index: number) => {
            const isVarianceNegative = cashier.variance < 0;
            return (
              <TableSection 
                key={index} 
                title={`${cashier.outletName ? `POS · ${cashier.outletName} · ` : 'Cashier: '}${cashier.cashierName || 'Unknown'}`}
                shift={cashier.shiftReference}
                status={cashier.status}
              >
                <div className="grid grid-cols-2 gap-x-12">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 mb-2 border-b pb-1">Transactions</h3>
                    <table className="w-full text-xs">
                      <tbody>
                        <TableRow label="Cash Sales" value={formatCurrency(cashier.cashSales, currencyCode)} />
                        <TableRow label="Card Sales" value={formatCurrency(cashier.cardSales, currencyCode)} />
                        <TableRow label="Bank Transfer" value={formatCurrency(cashier.bankTransfer, currencyCode)} />
                        <TableRow label="POS Payment" value={formatCurrency(cashier.posPayment, currencyCode)} />
                        <TableRow label="Other Methods" value={formatCurrency(cashier.other, currencyCode)} />
                        <tr><td colSpan={2} className="py-1"></td></tr>
                        <TableRow label="Cash Refunds" value={`(${formatCurrency(cashier.cashRefunds, currencyCode)})`} />
                        <TableRow label="Paid Outs" value={`(${formatCurrency(cashier.paidOuts, currencyCode)})`} />
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-500 mb-2 border-b pb-1">Cash Summary</h3>
                    <table className="w-full text-xs">
                      <tbody>
                        <TableRow label="Opening Float" value={formatCurrency(cashier.openingFloat, currencyCode)} />
                        <TableRow label="Cash In" value={formatCurrency(cashier.cashIn, currencyCode)} />
                        <TableRow label="Cash Drops" value={`(${formatCurrency(cashier.cashDrops, currencyCode)})`} />
                        <tr><td colSpan={2} className="py-1"></td></tr>
                        <TableRow label="Expected Cash" value={formatCurrency(cashier.expectedCash, currencyCode)} isBold />
                        <TableRow label="Actual Cash" value={formatCurrency(cashier.actualCash, currencyCode)} isBold />
                        <TableRow 
                          label="Variance" 
                          value={formatCurrency(cashier.variance || 0, currencyCode) + (cashier.variance < 0 ? ' (Short)' : cashier.variance > 0 ? ' (Over)' : '')}
                          isTotal 
                          isNegative={isVarianceNegative}
                        />
                        <tr><td colSpan={2} className="py-1"></td></tr>
                        <tr>
                          <td className="py-1.5 px-2">Approval Status</td>
                          <td className="py-1.5 px-2 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cashier.supervisorApproval === 'APPROVED' ? 'bg-green-100 text-green-700' :
                              cashier.supervisorApproval === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {cashier.supervisorApproval || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-200 pt-2 text-[10px] text-slate-500">{cashier.sessionType || 'CASHIER'} · {cashier.paymentCount || 0} payments · Control: {cashier.controlStatus || cashier.status || '—'} · Exceptions: {cashier.exceptionCount || 0}</div>
                {cashier.exceptions?.length > 0 && <div className="mt-2 text-[10px] text-rose-700">{cashier.exceptions.map((exception: any, exceptionIndex: number) => <div key={`${exception.reason}-${exceptionIndex}`}>{exception.severity} · {exception.status} · {exception.reason} · {formatCurrency(exception.amount || 0, currencyCode)}</div>)}</div>}
              </TableSection>
            );
          })}
        </div>
      )}

      {cashiers.length > 0 && <div className="mt-8 border-t-2 border-slate-800 pt-3"><h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-900">Property cashier totals</h2><table className="w-full text-xs"><tbody><TableRow label="Cash / card" value={`${formatCurrency(totals.cashSales, currencyCode)} / ${formatCurrency(totals.cardSales, currencyCode)}`} /><TableRow label="Bank transfer / POS" value={`${formatCurrency(totals.bankTransfer, currencyCode)} / ${formatCurrency(totals.posPayment, currencyCode)}`} /><TableRow label="Other methods" value={formatCurrency(totals.other, currencyCode)} /><TableRow label="Expected / actual cash" value={`${formatCurrency(totals.expectedCash, currencyCode)} / ${formatCurrency(totals.actualCash, currencyCode)}`} isBold /><TableRow label="Cash variance" value={formatCurrency(totals.variance || 0, currencyCode) + (totals.variance < 0 ? ' (Short)' : totals.variance > 0 ? ' (Over)' : '')} isTotal isNegative={totals.variance < 0} /></tbody></table></div>}

    </A4ReportWrapper>
  );
}
