import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { auth } from '@/lib/auth';
import { format } from 'date-fns';
import { OutletStaffAssignment } from './outlet-assignment';
import { AlertTriangle, BarChart3, ShieldCheck, TrendingUp, UsersRound } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Staff Performance | F&B Management',
};

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount);
};

export default async function FnbStaffPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Unauthorized</h1>
        <p className="text-muted-foreground mt-2">Please log in to view this page.</p>
      </div>
    );
  }

  const orgContext = await requireOrganizationContext(session.user.id);
  const propertyIds = [...orgContext.propertyIds];

  if (propertyIds.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">No Property Access</h1>
        <p className="text-muted-foreground mt-2">You do not have access to any properties.</p>
      </div>
    );
  }

  // 1. Determine Business Date
  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, businessDate: true, baseCurrency: true, name: true, timezone: true }
  });

  const primaryProperty = properties[0];
  const baseCurrency = primaryProperty?.baseCurrency || 'NGN';
  
  let businessDate = new Date();
  if (primaryProperty?.businessDate) {
    businessDate = primaryProperty.businessDate;
  } else {
    // If no explicit businessDate, align with timezone or UTC
    businessDate = new Date(businessDate.getFullYear(), businessDate.getMonth(), businessDate.getDate());
  }

  // 2. Fetch Active Staff
  const activeFnbStaff = await prisma.staff.findMany({
    where: {
      organizationId: orgContext.organizationId,
      isActive: true,
      OR: [
        {
          outletAccess: {
            some: {
              outlet: { propertyId: { in: propertyIds } }
            }
          }
        },
        {
          department: { in: ['F&B', 'Food & Beverage', 'Kitchen', 'Bar', 'Restaurant'] }
        }
      ]
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
    }
  });

  const activeStaffIds = new Set(activeFnbStaff.map(s => s.id));

  // 3. Aggregate Orders, Sales, Tips
  const orderStats = await prisma.posOrder.groupBy({
    by: ['serverStaffId'],
    where: {
      propertyId: { in: propertyIds },
      businessDate: businessDate,
      status: 'CLOSED'
    },
    _count: {
      id: true
    },
    _sum: {
      total: true,
      tipAmount: true,
    }
  });

  const allOrderStats = await prisma.posOrder.groupBy({
    by: ['serverStaffId'],
    where: {
      propertyId: { in: propertyIds },
      businessDate: businessDate,
    },
    _count: {
      id: true
    }
  });

  // Check for any missing staff
  const missingStaffIds = allOrderStats
    .map(o => o.serverStaffId)
    .filter((id): id is string => id !== null && !activeStaffIds.has(id));

  let additionalStaff: any[] = [];
  if (missingStaffIds.length > 0) {
    additionalStaff = await prisma.staff.findMany({
      where: { id: { in: missingStaffIds } },
      select: { id: true, firstName: true, lastName: true, position: true }
    });
  }

  const allStaff = [...activeFnbStaff, ...additionalStaff];

  // 4. Fetch Voids (both authorized by staff, and voids on orders served by staff)
  const voids = await prisma.posVoid.findMany({
    where: {
      order: {
        propertyId: { in: propertyIds },
        businessDate: businessDate,
      }
    },
    select: {
      authorizerId: true,
      order: {
        select: {
          serverStaffId: true
        }
      }
    }
  });

  // Process data into map for rendering
  const staffDataMap = new Map();

  for (const staff of allStaff) {
    staffDataMap.set(staff.id, {
      id: staff.id,
      name: `${staff.firstName} ${staff.lastName}`,
      role: staff.position || 'Staff',
      sales: 0,
      ordersHandled: 0,
      tips: 0,
      voidsOnOrders: 0,
      voidsAuthorized: 0,
    });
  }

  for (const stat of orderStats) {
    if (stat.serverStaffId && staffDataMap.has(stat.serverStaffId)) {
      const data = staffDataMap.get(stat.serverStaffId);
      data.sales = Number(stat._sum?.total || 0);
      data.tips = Number(stat._sum?.tipAmount || 0);
    }
  }

  for (const stat of allOrderStats) {
    if (stat.serverStaffId && staffDataMap.has(stat.serverStaffId)) {
      const data = staffDataMap.get(stat.serverStaffId);
      data.ordersHandled = stat._count?.id || 0;
    }
  }

  for (const v of voids) {
    if (v.authorizerId && staffDataMap.has(v.authorizerId)) {
      staffDataMap.get(v.authorizerId).voidsAuthorized += 1;
    }
    if (v.order?.serverStaffId && staffDataMap.has(v.order.serverStaffId)) {
      staffDataMap.get(v.order.serverStaffId).voidsOnOrders += 1;
    }
  }

  const staffPerformance = Array.from(staffDataMap.values()).map(staff => {
    let rating = 'Standard';
    let ratingVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';

    if (staff.voidsOnOrders > 3 || staff.voidsAuthorized > 5) {
      rating = 'Review Voids';
      ratingVariant = 'destructive';
    } else if (staff.sales > 100000) {
      rating = 'Top Performer';
      ratingVariant = 'default';
    } else if (staff.ordersHandled === 0) {
      rating = 'No Activity';
      ratingVariant = 'outline';
    }

    return {
      ...staff,
      rating,
      ratingVariant
    };
  });

  const totalSales = staffPerformance.reduce((sum, staff) => sum + staff.sales, 0);
  const totalOrders = staffPerformance.reduce((sum, staff) => sum + staff.ordersHandled, 0);
  const totalTips = staffPerformance.reduce((sum, staff) => sum + staff.tips, 0);
  const reviewCount = staffPerformance.filter((staff) => staff.rating === 'Review Voids').length;
  const topPerformer = [...staffPerformance].sort((a, b) => b.sales - a.sales)[0];
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  return (
    <div className="min-h-screen bg-[#fbf8f6] p-4 font-sans text-[#24130d] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl border border-[#3d2318] bg-[#24130d] px-6 py-7 text-white shadow-xl"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-300"><UsersRound className="h-4 w-4" /> F&B people performance</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Staff performance</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">Understand service contribution, sales ownership, tips, and control signals for {format(businessDate, 'PPP')}.</p></div><div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-right"><p className="text-xs font-bold text-white">Manager view</p><p className="mt-1 text-[11px] text-orange-100/70">Read performance and manage outlet access</p></div></div></div></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Team members</p><p className="mt-3 text-2xl font-bold text-[#24130d]">{staffPerformance.length}</p><p className="mt-1 text-xs text-[#927b70]">Active F&B staff in scope</p></div><div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Sales owned</p><p className="mt-3 text-2xl font-bold text-[#24130d]">{formatCurrency(totalSales, baseCurrency)}</p><p className="mt-1 text-xs text-[#927b70]">{totalOrders} orders · {formatCurrency(averageOrderValue, baseCurrency)} average</p></div><div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Tips collected</p><p className="mt-3 text-2xl font-bold text-emerald-700">{formatCurrency(totalTips, baseCurrency)}</p><p className="mt-1 text-xs text-[#927b70]">Reported on closed orders</p></div><div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#927b70]">Review signals</p><p className="mt-3 text-2xl font-bold text-red-700">{reviewCount}</p><p className="mt-1 text-xs text-[#927b70]">Staff with elevated void activity</p></div></div>
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]"><section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Manager insight</h2><p className="mt-1 text-xs text-[#927b70]">The clearest signal from today’s staff activity</p></div><TrendingUp className="h-5 w-5 text-orange-500" /></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#fff7ed] p-4"><p className="text-xs font-semibold text-orange-700">Top sales owner</p><p className="mt-2 truncate text-sm font-bold text-orange-950">{topPerformer?.name || 'No activity'}</p><p className="mt-1 text-xs text-orange-700/80">{topPerformer ? formatCurrency(topPerformer.sales, baseCurrency) : 'No closed sales recorded'}</p></div><div className="rounded-xl bg-[#f7eee9] p-4"><p className="text-xs font-semibold text-[#7c2d12]">Service productivity</p><p className="mt-2 text-sm font-bold text-[#3d2318]">{totalOrders ? `${(totalOrders / Math.max(staffPerformance.length, 1)).toFixed(1)} orders / staff` : 'No orders'}</p><p className="mt-1 text-xs text-[#7c2d12]/80">Average order ownership</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-semibold text-red-700">Control attention</p><p className="mt-2 text-sm font-bold text-red-950">{reviewCount ? `${reviewCount} staff to review` : 'No review signals'}</p><p className="mt-1 text-xs text-red-700/80">Based on void thresholds</p></div></div></section><section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Performance lens</h2><p className="mt-1 text-xs text-[#927b70]">What the team data is measuring</p></div><BarChart3 className="h-5 w-5 text-orange-500" /></div><div className="space-y-3 text-sm"><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><ShieldCheck className="h-4 w-4 text-emerald-600" /><span className="text-slate-700">Sales ownership from closed orders</span></div><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><UsersRound className="h-4 w-4 text-indigo-600" /><span className="text-slate-700">Orders handled across active staff</span></div><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="text-slate-700">Void activity requiring review</span></div></div></section></div>
      <OutletStaffAssignment />

      {staffPerformance.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No F&B staff found for this property.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {staffPerformance.map((staff) => (
            <Card key={staff.id}>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center font-semibold text-secondary-foreground shrink-0">
                  {staff.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{staff.name}</CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{staff.role}</p>
                </div>
                {staff.rating !== 'Standard' && (
                  <Badge variant={staff.ratingVariant} className="shrink-0">
                    {staff.rating}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Completed Sales</span>
                    <span className="text-sm font-medium">{formatCurrency(staff.sales, baseCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Orders Handled</span>
                    <span className="text-sm font-medium">{staff.ordersHandled}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Collected Tips</span>
                    <span className="text-sm font-medium text-green-600">{formatCurrency(staff.tips, baseCurrency)}</span>
                  </div>
                  <div className="flex flex-col mt-2 pt-2 border-t gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Voids (On Orders)</span>
                      <span className="text-sm font-medium">{staff.voidsOnOrders}</span>
                    </div>
                    {staff.voidsAuthorized > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Voids Authorized</span>
                        <span className="text-sm font-medium text-amber-600">{staff.voidsAuthorized}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
