import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const businessDate = new Date(businessDateStr);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    // Aggregate FolioItems for the day
    const items = await prisma.folioItem.findMany({
      where: { folio: { propertyId }, businessDate },
      select: { type: true, source: true, description: true, amount: true }
    });

    // Group by department/source
    const deptMap: Record<string, Record<string, any>> = {};

    items.forEach(item => {
      // Basic department mapping
      let department = 'Other';
      if (item.source === 'ROOM_CHARGE') department = 'Front Desk';
      else if (item.source === 'POS') department = 'POS';
      else if (item.source === 'LAUNDRY') department = 'Laundry';

      const code = item.source;
      const desc = code === 'ROOM_CHARGE' ? 'Room Night' : item.description || code;

      if (!deptMap[department]) deptMap[department] = {};
      if (!deptMap[department][code]) {
        deptMap[department][code] = { code, description: desc, gross: 0, discounts: 0, adjustments: 0, net: 0, tax: 0, total: 0, transactionCount: 0 };
      }

      const row = deptMap[department][code];
      const amt = Number(item.amount);

      if (item.type === 'CHARGE') {
        row.gross += amt;
        row.net += amt;
        row.total += amt;
        row.transactionCount++;
      } else if (item.type === 'DISCOUNT') {
        row.discounts += Math.abs(amt);
        row.net -= Math.abs(amt);
        row.total -= Math.abs(amt);
      } else if (item.type === 'ADJUSTMENT') {
        row.adjustments += Math.abs(amt);
        row.net -= Math.abs(amt);
        row.total -= Math.abs(amt);
      } else if (item.type === 'TAX') {
        row.tax += amt;
        row.total += amt;
      }
    });

    const departments = [];
    let totals = { gross: 0, discounts: 0, adjustments: 0, net: 0, tax: 0, total: 0, transactionCount: 0 };

    for (const [dept, codes] of Object.entries(deptMap)) {
      const revenues = Object.values(codes);
      revenues.forEach(r => {
        totals.gross += r.gross;
        totals.discounts += r.discounts;
        totals.adjustments += r.adjustments;
        totals.net += r.net;
        totals.tax += r.tax;
        totals.total += r.total;
        totals.transactionCount += r.transactionCount;
      });
      departments.push({ department: dept, revenues });
    }

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      departments,
      totals
    });

  } catch (err: any) {
    console.error('[Detailed Revenue GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
