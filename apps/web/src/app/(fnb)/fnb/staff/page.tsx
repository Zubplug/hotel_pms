import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { auth } from '@/lib/auth';
import { format } from 'date-fns';

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Performance</h1>
          <p className="text-muted-foreground mt-1">
            Track shift performance, sales per staff, and void frequencies for {format(businessDate, 'PPP')}.
          </p>
        </div>
      </div>

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
