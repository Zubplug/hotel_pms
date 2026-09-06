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
          setData(res);
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
      reportId={`CSH-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      
      {!cashiers || cashiers.length === 0 ? (
        <div className="py-20 text-center text-slate-500 italic">No records for this business date.</div>
      ) : (
        <div className="space-y-6">
          {cashiers.map((cashier: any, index: number) => {
            const isVarianceNegative = cashier.variance < 0;
            return (
              <TableSection 
                key={index} 
                title={`Cashier: ${cashier.cashierName || 'Unknown'}`}
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
                        <TableRow label="Cash Drops" value={`(${formatCurrency(cashier.cashDrops, currencyCode)})`} />
                        <tr><td colSpan={2} className="py-1"></td></tr>
                        <TableRow label="Expected Cash" value={formatCurrency(cashier.expectedCash, currencyCode)} isBold />
                        <TableRow label="Actual Cash" value={formatCurrency(cashier.actualCash, currencyCode)} isBold />
                        <TableRow 
                          label="Variance" 
                          value={formatCurrency(Math.abs(cashier.variance || 0), currencyCode) + (cashier.variance < 0 ? ' (Short)' : cashier.variance > 0 ? ' (Over)' : '')} 
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
              </TableSection>
            );
          })}
        </div>
      )}

    </A4ReportWrapper>
  );
}
