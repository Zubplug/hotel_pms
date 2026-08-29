import React from "react";
import prisma from "@hotel-pms/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Receipt, AlertCircle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const [safeAccount, revenue, frontDeskRevenue, pettyCash, pendingApprovals, pendingReviewPosShifts, activeFrontDeskShifts, pendingReviewFrontDeskShifts] = await Promise.all([
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
      where: { propertyId, controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] } },
      orderBy: { updatedAt: 'desc' },
      include: { outlet: true, primaryOperator: true, settlements: { orderBy: { settledAt: 'desc' }, take: 1 }, payments: true, cashMovements: true, orders: { select: { status: true } } },
    }),
    prisma.frontdeskSession.findMany({
      where: { propertyId, status: { in: ['OPEN', 'CLOSING'] } },
      orderBy: { updatedAt: 'desc' }, take: 20,
      include: { staff: true, cashAccount: true, payments: true, cashMovements: true, exceptions: true },
    }),
    prisma.frontdeskSession.findMany({
      where: { propertyId, controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] } },
      orderBy: { updatedAt: 'desc' },
      include: { staff: true, cashAccount: true, payments: true, cashMovements: true, exceptions: true },
    }),
  ]);

  const currency = property.baseCurrency;
  const todayRevenue = Number(revenue._sum?.amount || 0) + Number(frontDeskRevenue._sum?.amount || 0);
  const cashInDrawer = Number(safeAccount?.balance || 0);
  const pettyCashPayouts = Number(pettyCash._sum?.amount || 0);
  const pendingDrops = activeOutletShifts.length + activeFrontDeskShifts.length;
  const methodTotals = [...pendingReviewPosShifts.flatMap(shift => shift.payments), ...pendingReviewFrontDeskShifts.flatMap(shift => shift.payments)].filter((payment: any) => ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status)).reduce((result: Record<string, number>, payment: any) => {
    result[payment.method] = (result[payment.method] || 0) + Number(payment.amount || 0);
    return result;
  }, {});

  const queueItems = [
    ...pendingReviewPosShifts.map(shift => ({
      id: shift.id,
      type: 'POS',
      label: shift.outlet.name,
      operator: shift.primaryOperator ? `${shift.primaryOperator.firstName} ${shift.primaryOperator.lastName}` : 'System',
      status: shift.controlStatus || 'SUBMITTED',
      expected: Number(shift.expectedCash),
      declared: shift.actualCash == null ? null : Number(shift.actualCash),
      variance: shift.variance == null ? null : Number(shift.variance),
      updatedAt: shift.updatedAt,
    })),
    ...pendingReviewFrontDeskShifts.map(shift => ({
      id: shift.id,
      type: 'FRONT DESK',
      label: shift.cashAccount.name,
      operator: `${shift.staff.firstName} ${shift.staff.lastName}`,
      status: shift.controlStatus || 'SUBMITTED',
      expected: Number(shift.systemExpectedCash),
      declared: shift.declaredCash == null ? null : Number(shift.declaredCash),
      variance: shift.variance == null ? null : Number(shift.variance),
      updatedAt: shift.updatedAt,
    }))
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">General Cashier Workspace</h1>
          <p className="text-slate-500">Manage central hotel finances, folios, till drops, and pending reviews.</p>
        </div>
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
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pending Review Queue</h2>
            <p className="text-sm text-slate-500">Shifts submitted by operators requiring General Cashier approval.</p>
          </div>
        </div>
        
        {queueItems.length === 0 ? (
           <div className="p-12 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
             <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-400" />
             <p>All shifts are reviewed and approved.</p>
           </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Declared</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueItems.map(item => (
                <TableRow key={`${item.type}-${item.id}`}>
                  <TableCell>
                    <Badge variant="outline" className={item.type === 'POS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{item.label}</TableCell>
                  <TableCell>{item.operator}</TableCell>
                  <TableCell>
                     <Badge variant={item.status === 'RETURNED' ? 'destructive' : item.status === 'UNDER_REVIEW' ? 'secondary' : 'default'} className="text-[10px] uppercase">
                       {item.status.replace(/_/g, ' ')}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.expected, currency)}</TableCell>
                  <TableCell className="text-right">{item.declared == null ? '-' : formatCurrency(item.declared, currency)}</TableCell>
                  <TableCell className={`text-right font-medium ${item.variance && item.variance < 0 ? 'text-red-600' : item.variance && item.variance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {item.variance == null ? '-' : formatCurrency(item.variance, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/reports/shift?shiftId=${encodeURIComponent(item.id)}`} className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-slate-50 text-indigo-600">
                      Review &rarr;
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </div>
  );
}
