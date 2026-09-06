'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function ManagersFlashReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/managers-flash?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  const { occupancy = {}, revenue = {}, performance = {}, financial = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';

  const TableSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-300 pb-1 mb-3">{title}</h2>
      <table className="w-full text-xs">
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );

  const TableRow = ({ label, value, isBold = false, isTotal = false }: { label: string, value: React.ReactNode, isBold?: boolean, isTotal?: boolean }) => (
    <tr className={`${isTotal ? 'border-t-2 border-slate-800 font-bold' : isBold ? 'font-semibold' : ''} ${isTotal ? 'bg-slate-50' : ''}`}>
      <td className={`py-1.5 px-2 ${isTotal ? 'py-2' : ''}`}>{label}</td>
      <td className={`py-1.5 px-2 text-right ${isTotal ? 'py-2' : ''}`}>{value}</td>
    </tr>
  );

  return (
    <A4ReportWrapper
      title="Daily Manager's Flash Report"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`MGR-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      
      {(!occupancy.available && !revenue.gross) ? (
        <div className="py-20 text-center text-slate-500 italic">No records for this business date.</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-12">
          
          <div>
            <TableSection title="Occupancy & Rooms">
              <TableRow label="Rooms Available" value={occupancy.available || 0} />
              <TableRow label="Rooms Occupied" value={occupancy.occupied || 0} />
              <TableRow label="Occupancy %" value={`${occupancy.percentage || 0}%`} isBold />
              <tr><td colSpan={2} className="py-2"></td></tr>
              <TableRow label="Arrivals" value={occupancy.arrivals || 0} />
              <TableRow label="Departures" value={occupancy.departures || 0} />
              <TableRow label="No-Shows" value={occupancy.noShows || 0} />
              <TableRow label="Walk-Ins" value={occupancy.walkIns || 0} />
            </TableSection>

            <TableSection title="Performance">
              <TableRow label="ADR (Average Daily Rate)" value={formatCurrency(performance.adr, currencyCode)} />
              <TableRow label="RevPAR (Rev per Available Room)" value={formatCurrency(performance.revpar, currencyCode)} />
              <TableRow label="Occupancy %" value={`${occupancy.percentage || 0}%`} />
            </TableSection>
          </div>

          <div>
            <TableSection title="Revenue (Gross)">
              <TableRow label="Room Revenue" value={formatCurrency(revenue.room, currencyCode)} />
              <TableRow label="F&B Revenue" value={formatCurrency(revenue.fb, currencyCode)} />
              <TableRow label="Other Revenue" value={formatCurrency(revenue.other, currencyCode)} />
              <TableRow label="Gross Revenue" value={formatCurrency(revenue.gross, currencyCode)} isTotal />
              <tr><td colSpan={2} className="py-2"></td></tr>
              <TableRow label="Discounts" value={`(${formatCurrency(revenue.discounts, currencyCode)})`} />
              <TableRow label="Net Revenue" value={formatCurrency(revenue.net, currencyCode)} isBold />
              <TableRow label="Taxes" value={formatCurrency(revenue.taxes, currencyCode)} />
              <TableRow label="Total Revenue (incl. Tax)" value={formatCurrency(revenue.total, currencyCode)} isTotal />
            </TableSection>

            <TableSection title="Financial & Payments">
              <TableRow label="Cash Payments" value={formatCurrency(financial.cash, currencyCode)} />
              <TableRow label="Card Payments" value={formatCurrency(financial.card, currencyCode)} />
              <TableRow label="Bank Transfers" value={formatCurrency(financial.transfer, currencyCode)} />
              <TableRow label="Other Payments" value={formatCurrency(financial.other, currencyCode)} />
              <tr><td colSpan={2} className="py-1"></td></tr>
              <TableRow label="Deposits Received" value={formatCurrency(financial.deposits, currencyCode)} />
              <TableRow label="Refunds" value={`(${formatCurrency(financial.refunds, currencyCode)})`} />
              <TableRow label="Adjustments/Voids" value={`(${formatCurrency(financial.adjustments, currencyCode)})`} />
              <tr><td colSpan={2} className="py-1"></td></tr>
              <TableRow label="Total Outstanding Balances" value={formatCurrency(financial.outstanding, currencyCode)} isBold />
            </TableSection>
          </div>
          
        </div>
      )}

    </A4ReportWrapper>
  );
}
