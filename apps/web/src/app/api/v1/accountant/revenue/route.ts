import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate } from '@/lib/kpi';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

const departmentForSource: Record<string, string> = {
  ROOM_CHARGE: 'Rooms',
  ROOM_UPGRADE: 'Rooms',
  ROOM_DOWNGRADE_CREDIT: 'Rooms',
  POS: 'Food & Beverage',
  RESTAURANT: 'Food & Beverage',
  BAR: 'Bar',
  SPA: 'Spa',
  LAUNDRY: 'Laundry',
  TRANSPORT: 'Transport',
  MINIBAR: 'Minibar',
  TELEPHONE: 'Telephone',
  INTERNET: 'Internet',
  CITY_LEDGER: 'City Ledger',
  MANUAL: 'Other',
  OTHER: 'Other',
};

const dateOnly = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const addYears = (date: Date, years: number) => new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
const key = (date: Date) => date.toISOString().slice(0, 10);

function amountForItem(item: { type: string; amount: unknown }) {
  const amount = Number(item.amount || 0);
  if (item.type === 'DISCOUNT') return -Math.abs(amount);
  return amount;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const businessDate = dateOnly(await getPropertyBusinessDate(propertyId));
    const monthStart = new Date(Date.UTC(businessDate.getUTCFullYear(), businessDate.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(businessDate.getUTCFullYear(), 0, 1));
    const priorYearDate = addYears(businessDate, -1);
    const queryStart = addYears(yearStart, -1);

    const [property, items] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
      prisma.folioItem.findMany({
        where: {
          folio: { propertyId },
          businessDate: { gte: queryStart, lte: businessDate },
          type: { in: ['CHARGE', 'DISCOUNT'] },
          voidedAt: null,
        },
        select: { businessDate: true, source: true, type: true, amount: true },
      }),
    ]);

    const totals = new Map<string, { today: number; mtd: number; ytd: number; priorYear: number; count: number }>();
    const getTotals = (department: string) => {
      const existing = totals.get(department);
      if (existing) return existing;
      const created = { today: 0, mtd: 0, ytd: 0, priorYear: 0, count: 0 };
      totals.set(department, created);
      return created;
    };

    for (const item of items) {
      const itemDate = dateOnly(new Date(item.businessDate));
      const value = amountForItem(item);
      const department = departmentForSource[item.source] || 'Other';
      const departmentTotals = getTotals(department);
      if (key(itemDate) === key(businessDate)) departmentTotals.today += value;
      if (itemDate >= monthStart && itemDate <= businessDate) departmentTotals.mtd += value;
      if (itemDate >= yearStart && itemDate <= businessDate) departmentTotals.ytd += value;
      if (key(itemDate) === key(priorYearDate)) departmentTotals.priorYear += value;
      if (item.type === 'CHARGE') departmentTotals.count += 1;
    }

    const departments = Array.from(totals.entries())
      .map(([department, values]) => {
        const today = Number(values.today.toFixed(2));
        const mtd = Number(values.mtd.toFixed(2));
        const ytd = Number(values.ytd.toFixed(2));
        const priorYear = Number(values.priorYear.toFixed(2));
        return {
          id: department.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
          department,
          today,
          mtd,
          ytd,
          priorYear,
          count: values.count,
          variance: priorYear === 0 ? (today === 0 ? 0 : 100) : Number((((today - priorYear) / Math.abs(priorYear)) * 100).toFixed(1)),
          isUp: today >= priorYear,
        };
      })
      .sort((a, b) => b.today - a.today || a.department.localeCompare(b.department));

    const sum = (field: 'today' | 'mtd' | 'ytd' | 'priorYear') => departments.reduce((total, item) => total + Number(item[field] || 0), 0);
    const today = sum('today');
    const priorYear = sum('priorYear');

    return successResponse({
      property: { id: propertyId, name: property?.name || 'Property', currency: property?.baseCurrency || 'NGN' },
      businessDate: key(businessDate),
      snapshot: {
        today: Number(today.toFixed(2)),
        mtd: Number(sum('mtd').toFixed(2)),
        ytd: Number(sum('ytd').toFixed(2)),
        priorYear: Number(priorYear.toFixed(2)),
        variance: priorYear === 0 ? (today === 0 ? 0 : 100) : Number((((today - priorYear) / Math.abs(priorYear)) * 100).toFixed(1)),
        isUp: today >= priorYear,
      },
      departments,
    });
  } catch (error: any) {
    console.error('[Accountant Revenue GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to load revenue report', 500);
  }
}
