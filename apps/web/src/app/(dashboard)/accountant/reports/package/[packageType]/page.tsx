import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';
import { CheckCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { PrintPackageButton } from '@/components/accountant/PrintPackageButton';

export const dynamic = 'force-dynamic';

export default async function ReportPackagePage({ params, searchParams }: { params: { packageType: string }, searchParams: { businessDate?: string } }) {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Freports');

  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const propertyId = session.user.propertyId && propertyIds.includes(session.user.propertyId) ? session.user.propertyId : propertyIds[0];
  if (!propertyId) return <div>No property assigned</div>;

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } });

  const bDateStr = searchParams.businessDate || property?.businessDate?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10);

  let title = '';
  let description = '';
  let checklist: string[] = [];
  let reports: { name: string, href: string }[] = [];

  if (params.packageType === 'daily') {
    title = 'Daily Financial Close Package';
    description = 'Standard operating package required for daily hotel reconciliation and night audit sign-off.';
    checklist = [
      'Verify Cashier Settlements have no unexplained variances',
      'Ensure all Daily Revenue accounts are balanced against POS/PMS subledgers',
      'Verify all Folio transfers to City Ledger are correct',
      'Acknowledge any Accounting Exceptions logged for the day'
    ];
    reports = [
      { name: 'Trial Balance', href: '/accountant/reports/viewer/trial-balance' },
      { name: 'Daily Revenue', href: '/accountant/reports/viewer/daily-revenue' },
      { name: 'Payment Method Report', href: '/accountant/reports/viewer/payment-methods' },
      { name: 'Cashier Settlement', href: '/accountant/reports/viewer/cashier-settlement' },
      { name: 'Guest Ledger', href: '/accountant/reports/viewer/guest-ledger' },
      { name: 'City Ledger Transfers', href: '/accountant/reports/viewer/city-ledger-transfer' },
      { name: 'Night Audit Log', href: '/accountant/reports/viewer/night-audit' }
    ];
  } else if (params.packageType === 'monthly') {
    title = 'Month-End Close Package';
    description = 'Comprehensive accounting package required for period-end closure and financial reporting.';
    checklist = [
      'Reconcile all Bank Accounts to Cash GL',
      'Reconcile AR Aging to City Ledger GL',
      'Post all recurring manual journals (Depreciation, Amortization)',
      'Review Inventory Valuation and post Cost of Sales adjustments'
    ];
    reports = [
      { name: 'Trial Balance', href: '/accountant/reports/viewer/trial-balance' },
      { name: 'Profit & Loss', href: '/accountant/reports/viewer/profit-and-loss' },
      { name: 'Balance Sheet', href: '/accountant/reports/viewer/balance-sheet' },
      { name: 'Cash Flow Statement', href: '/accountant/reports/viewer/cash-flow' },
      { name: 'AR Aging Summary', href: '/accountant/reports/viewer/ar-aging' },
      { name: 'Inventory Valuation', href: '/accountant/reports/viewer/inventory-valuation' }
    ];
  } else {
    notFound();
  }

  reports = reports.map(report => ({
    ...report,
    href: `${report.href}?businessDate=${encodeURIComponent(bDateStr)}`,
  }));

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex justify-between items-center">
          <Link href="/accountant/reports" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
            &larr; Back to Reports
          </Link>
          <div className="flex gap-3">
            <Link href="/accountant/gl" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">Open period control</Link>
            <PrintPackageButton />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-slate-800 p-6 sm:p-8 text-white">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-2">
              <FileText className="h-4 w-4" />
              Accounting Package
            </div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-2 text-slate-300 max-w-2xl">{description}</p>
            <div className="mt-6 flex items-center gap-4 text-sm font-medium text-slate-300">
              <div className="bg-white/10 px-3 py-1 rounded-full">Property: {property?.name}</div>
              <div className="bg-white/10 px-3 py-1 rounded-full">Business Date: {bDateStr}</div>
            </div>
          </div>

          <div className="p-6 sm:p-8 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Control Checklist
            </h3>
            <p className="mb-3 text-xs text-slate-500">Checklist state is a local review aid. Period locking remains controlled from the General Ledger workflow.</p>
            <ul className="space-y-3">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 sm:p-8 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Package Manifest</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {reports.map((report, i) => (
                <Link key={i} href={report.href} target="_blank" className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-cyan-400 hover:shadow-sm transition-all group">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-cyan-700">{report.name}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded group-hover:bg-cyan-50 group-hover:text-cyan-600">View</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
