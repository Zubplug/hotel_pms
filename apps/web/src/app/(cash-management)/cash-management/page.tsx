import React from "react";
import prisma from "@hotel-pms/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Receipt, AlertCircle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";

export default async function GeneralCashierDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const propertyId = (session.user as any).propertyId;
  if (!propertyId) redirect('/hub');

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { baseCurrency: true, businessDate: true },
  });
  if (!property) redirect('/hub');
  const businessDate = property.businessDate ?? new Date();

  const activeOutletShifts = await prisma.posSession.findMany({
    where: { propertyId, status: 'OPEN' },
    include: {
      outlet: true,
      primaryOperator: true
    }
  });

  const [safeAccount, revenue, frontDeskRevenue, pettyCash, pendingApprovals, recentPosShifts, recentFrontDeskShifts] = await Promise.all([
    prisma.cashAccount.findFirst({ where: { propertyId, type: 'SAFE', isActive: true }, select: { balance: true } }),
    prisma.posPayment.aggregate({
      where: { order: { propertyId }, businessDate, status: 'CONFIRMED', amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { propertyId, createdAt: { gte: businessDate, lt: new Date(businessDate.getTime() + 86_400_000) }, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
      _sum: { amount: true },
    }),
    prisma.posCashMovement.aggregate({
      where: { propertyId, businessDate, type: 'PAID_OUT' },
      _sum: { amount: true },
    }),
    prisma.approvalRequest.count({ where: { propertyId, status: 'PENDING' } }),
    prisma.posSession.findMany({
      where: { propertyId, businessDate, status: { not: 'OPEN' } },
      orderBy: { updatedAt: 'desc' }, take: 20,
      include: { outlet: true, primaryOperator: true, settlements: { orderBy: { settledAt: 'desc' }, take: 1 }, payments: true, cashMovements: true, orders: { select: { status: true } } },
    }),
    prisma.frontdeskSession.findMany({
      where: { propertyId, businessDate, status: { in: ['CLOSING', 'CLOSED', 'UNDER_REVIEW', 'RECONCILED'] } },
      orderBy: { updatedAt: 'desc' }, take: 20,
      include: { staff: true, cashAccount: true, payments: true, cashMovements: true, exceptions: true },
    }),
  ]);

  const currency = property.baseCurrency;
  const todayRevenue = Number(revenue._sum?.amount || 0) + Number(frontDeskRevenue._sum?.amount || 0);
  const cashInDrawer = Number(safeAccount?.balance || 0);
  const pettyCashPayouts = Number(pettyCash._sum?.amount || 0);
  const pendingDrops = activeOutletShifts.length;
  const methodTotals = [...recentPosShifts.flatMap(shift => shift.payments), ...recentFrontDeskShifts.flatMap(shift => shift.payments)].filter((payment: any) => ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status)).reduce((result: Record<string, number>, payment: any) => {
    result[payment.method] = (result[payment.method] || 0) + Number(payment.amount || 0);
    return result;
  }, {});

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">General Cashier</h1>
          <p className="text-slate-500">Manage central hotel finances, folios, till drops, and payouts.</p>
        </div>
        <Link href="/reports/shift" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">View shift reports</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><Wallet className="w-4 h-4" /> Current Float</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(cashInDrawer, currency)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><Receipt className="w-4 h-4" /> Today's Consolidated Revenue</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(todayRevenue, currency)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><ArrowDownToLine className="w-4 h-4" /> Pending Till Drops</h3>
          <div className="text-3xl font-black text-amber-600 mt-2">{pendingDrops} Outlets</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><ArrowUpFromLine className="w-4 h-4" /> Petty Cash Payouts</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(pettyCashPayouts, currency)}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div><h2 className="text-xl font-semibold text-slate-900">Payment method control totals</h2><p className="text-sm text-slate-500">Live totals from POS and Front Desk sessions for the business date.</p></div>
          <Link href="/reports/shift" className="text-sm font-medium text-indigo-600">Open full audit report →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['CASH', 'POS', 'CARD', 'BANK_TRANSFER', 'PAYMENT_GATEWAY', 'CHEQUE', 'ROOM_CHARGE', 'OTHER'].map(method => <div key={method} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{method.replace('_', ' ')}</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(methodTotals[method] || 0, currency)}</p></div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Till Drops Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Outlet Shifts & Till Drops</h2>
            <Link href="/reports/shift" className="rounded-lg border px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50">View shift reports</Link>
          </div>
          
          <div className="grid gap-4">
            {activeOutletShifts.map(shift => (
              <div key={shift.id} className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{shift.outlet.name}</h3>
                  <div className="text-sm text-slate-500 mt-1">Cashier: {shift.primaryOperator ? `${shift.primaryOperator.firstName} ${shift.primaryOperator.lastName}` : 'System'} • Opened: {shift.openedAt.toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-2">Status: <span className="text-emerald-600 font-medium">Active</span></div>
                  <Link href="/reports/shift" className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50">Review shift</Link>
                </div>
              </div>
            ))}
            
            {activeOutletShifts.length === 0 && (
              <div className="p-12 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-400" />
                <p>All outlets are closed and reconciled.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-6 py-4"><h2 className="text-xl font-semibold">Submitted shift reports</h2><p className="text-sm text-slate-500">POS and Front Desk shifts awaiting or completed cashier review.</p></div>
            <div className="divide-y">
              {[...recentPosShifts.map(shift => ({ id: shift.id, type: 'POS', label: shift.outlet.name, operator: shift.primaryOperator ? `${shift.primaryOperator.firstName} ${shift.primaryOperator.lastName}` : 'Unknown operator', status: shift.status, expected: Number(shift.expectedCash), declared: shift.actualCash == null ? null : Number(shift.actualCash), variance: shift.variance == null ? null : Number(shift.variance), updated: shift.updatedAt })), ...recentFrontDeskShifts.map(shift => ({ id: shift.id, type: 'FRONT DESK', label: shift.cashAccount.name, operator: `${shift.staff.firstName} ${shift.staff.lastName}`, status: shift.status, expected: Number(shift.systemExpectedCash), declared: shift.declaredCash == null ? null : Number(shift.declaredCash), variance: shift.variance == null ? null : Number(shift.variance), updated: shift.updatedAt }))].map(report => <div key={`${report.type}-${report.id}`} className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{report.type}</span><span className="font-semibold text-slate-900">{report.label}</span></div><p className="mt-1 text-sm text-slate-500">{report.operator} · Updated {report.updated.toLocaleString()}</p></div><div className="text-left md:text-right"><p className="text-xs uppercase text-slate-500">{report.status}</p><p className="font-semibold">Expected {formatCurrency(report.expected, currency)} {report.variance == null ? '' : ` · Variance ${formatCurrency(report.variance, currency)}`}</p></div></div>)}
              {recentPosShifts.length === 0 && recentFrontDeskShifts.length === 0 && <p className="px-6 py-10 text-center text-slate-500">No submitted shift reports for this business date.</p>}
            </div>
          </div>
        </div>
        
        {/* Central Operations Section */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-lg font-medium text-slate-300">Folio Settlements</h2>
              <div className="mt-4 space-y-2">
                <Link href="/frontdesk" className="block w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Settle guest folio</Link>
                <Link href="/frontdesk" className="block w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Receive advance deposit</Link>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900">General Operations</h3>
            <div className="space-y-2">
              <Link href="/cash-management" className="block w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">Cash movement controls</Link>
              <Link href="/refunds" className="block w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">Process refund</Link>
              <Link href="/reports/gateway" className="block w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">Review payment gateways</Link>
            </div>
          </div>
          
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm space-y-2">
            <div className="flex gap-2 items-center text-amber-800 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>Pending Approvals</span>
            </div>
            <p className="text-sm text-amber-700">{pendingApprovals} approval request{pendingApprovals === 1 ? '' : 's'} awaiting review.</p>
            <Link href="/dashboard" className="font-bold text-amber-800">Review requests →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
