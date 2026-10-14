/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/static-components */
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

const n = (value: unknown) => Number(value || 0);

export default function ManagersFlashReportPage() {
  const params = useSearchParams();
  const propertyId = params.get('propertyId');
  const businessDate = params.get('businessDate');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId || !businessDate) {
      setError('Missing propertyId or businessDate');
      return;
    }
    fetch(`/api/v1/night-audit/reports/managers-flash?propertyId=${encodeURIComponent(propertyId)}&businessDate=${encodeURIComponent(businessDate)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || body?.message || 'Failed to fetch report');
        return body.data || body;
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load report'));
  }, [propertyId, businessDate]);

  const currency = (amount: unknown, code = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency: code }).format(n(amount));
  const dateTime = (value: unknown) => value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value))) : '—';

  if (error) return <div className="flex h-screen items-center justify-center text-rose-600 font-medium">{error}</div>;
  if (!data) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  const occupancy = data.occupancy || {};
  const performance = data.performance || {};
  const revenue = data.revenue || {};
  const concessions = data.concessions || {};
  const cityLedger = data.cityLedger || {};
  const financial = data.financial || {};
  const controls = data.controls || {};
  const labour = data.labour || {};
  const audit = data.audit || {};
  const departments = revenue.departmentBreakdown || [];
  const otherDetails = revenue.otherDetails || [];
  const sessions = controls.sessions || [];
  const housekeeping = controls.housekeeping || [];
  const serviceRequests = controls.serviceRequests || [];
  const arrivals = data.movements?.arrivals || [];
  const departures = data.movements?.departures || [];
  const currencyCode = data.propertyCurrency || 'NGN';
  const totalDepartmentGross = departments.reduce((sum: number, row: any) => sum + n(row.gross), 0);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-800">{title}</h2>
      {children}
    </section>
  );
  const Metric = ({ label, value, emphasis = false }: { label: string; value: React.ReactNode; emphasis?: boolean }) => (
    <div className={`border border-slate-200 p-2 ${emphasis ? 'bg-slate-50' : ''}`}><div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>
  );
  const Row = ({ label, value, total = false }: { label: string; value: React.ReactNode; total?: boolean }) => (
    <tr className={total ? 'border-t-2 border-slate-800 bg-slate-50 font-bold' : 'border-b border-slate-100'}><td className="px-2 py-1.5">{label}</td><td className="px-2 py-1.5 text-right">{value}</td></tr>
  );
  const Empty = () => <div className="py-3 text-center text-xs italic text-slate-500">No records</div>;

  return (
    <A4ReportWrapper title="Daily Manager's Flash Report" propertyName={data.propertyName || 'Hotel'} propertyEmail={data.propertyEmail} propertyPhone={data.propertyPhone} propertyAddress={data.propertyAddress} businessDate={businessDate || ''} reportId={`MGR-${businessDate || 'REPORT'}`} status={audit.status || 'NOT_RUN'}>
      <div className="mb-5 flex items-start justify-between border-b border-slate-300 pb-3 text-[10px] text-slate-600">
        <div><div className="font-semibold text-slate-900">Night audit: {audit.status || 'NOT_RUN'}</div><div>Close package: {audit.closePackageStatus || 'NOT_FINALIZED'} · Reconciliation: {audit.reconciliationStatus || '—'}</div></div>
        <div className="text-right"><div>Run: {audit.runReference || '—'}</div><div>Completed: {dateTime(audit.completedAt)}</div></div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2">
        <Metric label="Occupancy" value={`${n(occupancy.percentage).toFixed(1)}%`} emphasis />
        <Metric label="ADR" value={currency(performance.adr, currencyCode)} emphasis />
        <Metric label="RevPAR" value={currency(performance.revpar, currencyCode)} emphasis />
        <Metric label="Net revenue" value={currency(revenue.net, currencyCode)} emphasis />
        <Metric label="In-house guests" value={occupancy.inHouseGuests || 0} />
        <Metric label="Arrivals / departures" value={`${occupancy.arrivals || 0} / ${occupancy.departures || 0}`} />
        <Metric label="Open exceptions" value={(controls.unresolvedTransactionExceptions || 0) + (controls.openReconciliationExceptions || 0)} />
        <Metric label="Cash variance" value={currency(financial.cashVariance, currencyCode)} />
      </div>

      <div className="grid grid-cols-2 gap-x-10">
        <div>
          <Section title="Occupancy, inventory & movements">
            <table className="w-full text-xs"><tbody>
              <Row label="Total active rooms" value={occupancy.totalRooms || 0} /><Row label="Sellable rooms" value={occupancy.available || 0} /><Row label="Occupied rooms" value={occupancy.occupied || 0} /><Row label="Out of order / service" value={`${occupancy.outOfOrder || 0} / ${occupancy.outOfService || 0}`} /><Row label="Blocked rooms" value={occupancy.blocked || 0} /><Row label="Inventory source variance" value={occupancy.inventoryVariance || 0} total />
              <Row label="In-house guests" value={occupancy.inHouseGuests || 0} /><Row label="Checked-in arrivals" value={occupancy.checkedInArrivals || 0} /><Row label="Completed departures" value={occupancy.completedDepartures || 0} /><Row label="No-shows / cancellations" value={`${occupancy.noShows || 0} / ${occupancy.cancellations || 0}`} /><Row label="Walk-ins" value={occupancy.walkIns || 0} />
            </tbody></table>
          </Section>
          <Section title="Revenue by department">
            {departments.length ? <table className="w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Department</th><th className="px-2 py-1 text-right">Gross</th><th className="px-2 py-1 text-right">Net</th><th className="px-2 py-1 text-right">Count</th></tr></thead><tbody>{departments.map((row: any) => <tr key={row.department} className="border-b border-slate-100"><td className="px-2 py-1">{row.department}</td><td className="px-2 py-1 text-right">{currency(row.gross, currencyCode)}</td><td className="px-2 py-1 text-right">{currency(row.net, currencyCode)}</td><td className="px-2 py-1 text-right">{row.transactionCount || 0}</td></tr>)}<tr className="border-t-2 border-slate-800 font-bold"><td className="px-2 py-1">Department total</td><td className="px-2 py-1 text-right">{currency(totalDepartmentGross, currencyCode)}</td><td className="px-2 py-1 text-right">{currency(departments.reduce((sum: number, row: any) => sum + n(row.net), 0), currencyCode)}</td><td /></tr></tbody></table> : <Empty />}
          </Section>
        </div>

        <div>
          <Section title="Revenue & financial summary">
            <table className="w-full text-xs"><tbody><Row label="Room revenue" value={currency(revenue.room, currencyCode)} /><Row label="F&B revenue" value={currency(revenue.fb, currencyCode)} /><Row label="Service charge" value={currency(revenue.serviceCharge, currencyCode)} /><Row label="Other revenue (excluding service charge)" value={currency(revenue.other, currencyCode)} /><Row label="Gross revenue" value={currency(revenue.gross, currencyCode)} total /><Row label="Discounts / refunds" value={`${currency(revenue.discounts, currencyCode)} / ${currency(revenue.refunds, currencyCode)}`} /><Row label="Adjustments" value={currency(revenue.adjustments, currencyCode)} /><Row label="Net revenue" value={currency(revenue.net, currencyCode)} /><Row label="Taxes" value={currency(revenue.taxes, currencyCode)} /><Row label="Total incl. tax" value={currency(revenue.total, currencyCode)} total /><Row label="Ledger vs close gross variance" value={currency(revenue.derivedReconciliation?.grossVariance, currencyCode)} /><Row label="Ledger vs close net variance" value={currency(revenue.derivedReconciliation?.netVariance, currencyCode)} /></tbody></table>
          </Section>
          <Section title="Other revenue detail">
            {otherDetails.length ? <table className="w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Source</th><th className="px-2 py-1 text-right">Gross</th><th className="px-2 py-1 text-right">Net</th><th className="px-2 py-1 text-right">Count</th></tr></thead><tbody>{otherDetails.map((row: any) => <tr key={row.department} className="border-b border-slate-100"><td className="px-2 py-1">{row.department}</td><td className="px-2 py-1 text-right">{currency(row.gross, currencyCode)}</td><td className="px-2 py-1 text-right">{currency(row.net, currencyCode)}</td><td className="px-2 py-1 text-right">{row.transactionCount || 0}</td></tr>)}</tbody></table> : <div className="py-3 text-xs italic text-slate-500">No other revenue recorded. Service charge is reported separately.</div>}
          </Section>
          <Section title="City ledger & corporate credit">
            <table className="w-full text-xs"><tbody><Row label="Credit sales posted" value={currency(cityLedger.creditSales, currencyCode)} /><Row label="Settlements received" value={currency(cityLedger.settlements, currencyCode)} /><Row label="Closing amount due" value={currency(cityLedger.closingBalance, currencyCode)} /><Row label="Corporate advance credits" value={currency(cityLedger.corporateAdvanceCredits, currencyCode)} /><Row label="Named-account credit balances" value={currency(cityLedger.creditBalance - cityLedger.unappliedCredit, currencyCode)} /><Row label="Unapplied credits requiring allocation" value={currency(cityLedger.unappliedCredit, currencyCode)} /><Row label="Excluded unlinked city-ledger folios" value={cityLedger.orphanedFolioCount || 0} /><Row label="Corporate accounts / over limit" value={`${cityLedger.accountCount || 0} / ${cityLedger.overLimitCount || 0}`} total /></tbody></table>
            {cityLedger.accounts?.length ? <table className="mt-2 w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Account</th><th className="px-2 py-1 text-right">Folio due</th><th className="px-2 py-1 text-right">Advance credit</th><th className="px-2 py-1 text-right">Limit</th><th className="px-2 py-1">Control</th></tr></thead><tbody>{cityLedger.accounts.map((row: any) => <tr key={row.code} className="border-b border-slate-100"><td className="px-2 py-1">{row.name} <span className="text-[8px] text-slate-500">({row.code})</span></td><td className="px-2 py-1 text-right">{currency(row.amountDue, currencyCode)}</td><td className="px-2 py-1 text-right">{currency(row.advanceCredit, currencyCode)}</td><td className="px-2 py-1 text-right">{row.creditLimit > 0 ? currency(row.creditLimit, currencyCode) : '—'}</td><td className="px-2 py-1">{row.unapplied ? 'UNAPPLIED — ALLOCATE' : row.overLimit ? 'OVER LIMIT' : row.advanceCredit > 0 ? 'Advance credit' : row.creditBalance > 0 ? 'Credit balance' : row.exemptFromHighBalance ? 'EXEMPT' : 'Within limit'}</td></tr>)}</tbody></table> : <div className="py-3 text-xs italic text-slate-500">No corporate city-ledger accounts recorded.</div>}
          </Section>
          <Section title="Payments, deposits & balances">
            <table className="w-full text-xs"><tbody><Row label="Cash / card" value={`${currency(financial.cash, currencyCode)} / ${currency(financial.card, currencyCode)}`} /><Row label="Transfers / other" value={`${currency(financial.transfer, currencyCode)} / ${currency(financial.other, currencyCode)}`} /><Row label="Deposits received" value={currency(financial.deposits, currencyCode)} /><Row label="Outstanding amounts due" value={currency(financial.outstanding, currencyCode)} /><Row label="Guest credit balances" value={currency(financial.creditBalance, currencyCode)} /><Row label="Cash expected / declared" value={`${currency(financial.cashExpected, currencyCode)} / ${currency(financial.cashDeclared, currencyCode)}`} /><Row label="Cash variance" value={currency(financial.cashVariance, currencyCode)} total /></tbody></table>
          </Section>
          <Section title="Complimentary & guest benefits">
            <table className="w-full text-xs"><tbody><Row label="Complimentary room revenue" value={currency(concessions.complimentaryRoom, currencyCode)} /><Row label="Complimentary food from room packages" value={currency(concessions.complimentaryFood, currencyCode)} /><Row label="POS complimentary sales" value={currency(concessions.complimentaryPos, currencyCode)} /><Row label="Guest gifts / amenity cost" value={currency(concessions.guestAmenityCost, currencyCode)} /><Row label="Total complimentary value" value={currency(concessions.totalValue, currencyCode)} total /></tbody></table>
          </Section>
          <Section title="Night audit controls">
            <table className="w-full text-xs"><tbody><Row label="Room charges posted" value={audit.roomChargesPosted || 0} /><Row label="Open POS orders" value={controls.openPosOrders || 0} /><Row label="Transaction / reconciliation exceptions" value={`${controls.unresolvedTransactionExceptions || 0} / ${controls.openReconciliationExceptions || 0}`} /><Row label="Late postings / voids / adjustments" value={`${controls.latePostings || 0} / ${controls.voids || 0} / ${controls.adjustments || 0}`} /><Row label="Audit errors" value={audit.errors || 0} total /></tbody></table>
          </Section>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-10">
        <Section title="Operations, housekeeping & service">
          <table className="w-full text-xs"><tbody><Row label="Scheduled / published staff rosters" value={`${labour.scheduled || 0} / ${labour.published || 0}`} /><Row label="Attendance present / late / absent" value={`${labour.present || 0} / ${labour.late || 0} / ${labour.absent || 0}`} /><Row label="Worked hours" value={n(labour.workedHours).toFixed(2)} /><Row label="Housekeeping" value={housekeeping.length ? housekeeping.map((row: any) => `${row.status}: ${row.count}`).join(' · ') : '—'} /><Row label="Guest service requests" value={serviceRequests.length ? serviceRequests.map((row: any) => `${row.status}: ${row.count}`).join(' · ') : '—'} total /></tbody></table>
        </Section>
        <Section title="Cashier session controls">
          {sessions.length ? <table className="w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Session</th><th className="px-2 py-1">Status</th><th className="px-2 py-1 text-right">Expected</th><th className="px-2 py-1 text-right">Variance</th></tr></thead><tbody>{sessions.map((row: any, index: number) => <tr key={`${row.type}-${row.id || index}`} className="border-b border-slate-100"><td className="px-2 py-1">{row.type} · {row.name}<div className="text-[8px] text-slate-500">{row.id || '—'}</div></td><td className="px-2 py-1">{row.status || '—'}</td><td className="px-2 py-1 text-right">{currency(row.expectedCash, currencyCode)}</td><td className="px-2 py-1 text-right">{currency(row.variance, currencyCode)}</td></tr>)}</tbody></table> : <Empty />}
        </Section>
      </div>

      <Section title="Open exception detail">
        {(controls.transactionExceptionDetails?.length || controls.reconciliationExceptionDetails?.length) ? <table className="w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Source</th><th className="px-2 py-1">Severity/status</th><th className="px-2 py-1">Reason</th><th className="px-2 py-1 text-right">Amount</th></tr></thead><tbody>{(controls.transactionExceptionDetails || []).map((row: any) => <tr key={`tx-${row.id}`} className="border-b border-slate-100"><td className="px-2 py-1">Transaction</td><td className="px-2 py-1">{row.status}</td><td className="px-2 py-1">{row.questionReason}</td><td className="px-2 py-1 text-right">—</td></tr>)}{(controls.reconciliationExceptionDetails || []).map((row: any) => <tr key={`rx-${row.id}`} className="border-b border-slate-100"><td className="px-2 py-1">{row.source || 'Reconciliation'}{row.session ? ` · ${row.session}` : ''}</td><td className="px-2 py-1">{row.severity || row.status}</td><td className="px-2 py-1">{row.reason || row.type}</td><td className="px-2 py-1 text-right">{row.amount == null ? '—' : currency(row.amount, currencyCode)}</td></tr>)}</tbody></table> : <Empty />}
      </Section>

      <Section title="Arrivals & departures detail">
        <div className="grid grid-cols-2 gap-8 text-[10px]">
          {[['Arrivals', arrivals], ['Departures', departures], ['Cancellations', data.movements?.cancellations || []]].map(([title, rows]) => <div key={String(title)}><h3 className="mb-1 font-semibold text-slate-700">{title} ({(rows as any[]).length})</h3>{(rows as any[]).length ? <table className="w-full"><tbody>{(rows as any[]).slice(0, 25).map((row: any) => <tr key={`${title}-${row.reservationId}`} className="border-b border-slate-100"><td className="px-1 py-1">{row.guestName}</td><td className="px-1 py-1">{row.roomNumber}</td><td className="px-1 py-1 text-right">{row.status}</td></tr>)}</tbody></table> : <Empty />}</div>)}
        </div>
      </Section>

      <div className="mt-6 border-t border-slate-300 pt-3 text-[9px] text-slate-500">Prepared from the business-date ledger and night-audit controls. Revenue variances should be investigated before financial sign-off. Report generated for {businessDate}.</div>
    </A4ReportWrapper>
  );
}
