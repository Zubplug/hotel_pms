import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate } from '@/lib/kpi';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

type AccountRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  normalBalance: string;
  isActive: boolean;
};

type Totals = { today: number; mtd: number; ytd: number; priorYear: number; count: number; gross: number; discounts: number };
type DailyTotals = { revenue: number; gross: number; discounts: number; transactions: number };

const dateOnly = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const addYears = (date: Date, years: number) => new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
const key = (date: Date) => date.toISOString().slice(0, 10);

function amountForItem(item: { type: string; amount: unknown }) {
  const amount = Number(item.amount || 0);
  if (item.type === 'DISCOUNT' || item.type === 'COMPLIMENTARY') return -Math.abs(amount);
  return amount;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function resolveAccountCode(
  propertyId: string,
  item: { source: string; revenueCategory: string; revenueClass?: string | null; type: string },
  accounts: Map<string, AccountRow>,
  accountingConfig: Record<string, unknown>,
): string {
  const revenueAccounts = asRecord(accountingConfig.revenueAccounts);
  const contraAccounts = asRecord(accountingConfig.contraRevenueAccounts);
  const activeCode = (value: unknown) => typeof value === 'string' && accounts.has(value) ? value : undefined;
  const findByName = (...terms: string[]) => [...accounts.values()].find(account => terms.some(term => account.name.toLowerCase().includes(term)))?.code;

  if (item.revenueClass) {
    const key = item.revenueClass === 'HALL' ? 'EVENT_HALL' : item.revenueClass === 'EQUIPMENT' ? 'EVENT_EQUIPMENT' : item.revenueClass === 'FOOD' ? 'FOOD' : 'EVENT_OTHER';
    const configured = activeCode(revenueAccounts[key]);
    const canonical = activeCode(item.revenueClass === 'FOOD' ? '4250' : '4300');
    if (configured || canonical) return configured || canonical!;
    throw new Error(`Missing event ${item.revenueClass} revenue account for property ${propertyId}`);
  }

  if (item.type === 'DISCOUNT' || item.type === 'COMPLIMENTARY') {
    const isComplimentary = item.type === 'COMPLIMENTARY';
    const configured = activeCode(contraAccounts[isComplimentary ? 'COMPLIMENTARY' : 'DISCOUNT']);
    const canonical = activeCode(isComplimentary ? '4950' : '4900');
    const named = isComplimentary
      ? findByName('complimentary allowance', 'complimentary')
      : findByName('rebate', 'discount', 'allowance');
    const resolved = configured || canonical || named;
    if (!resolved) throw new Error(`Missing ${isComplimentary ? 'complimentary' : 'discount'} contra-revenue account for property ${propertyId}`);
    return resolved;
  }

  if (item.source === 'ROOM_CHARGE' || item.source === 'DAY_USE_ROOM_CHARGE' || item.source === 'ROOM_UPGRADE' || item.source === 'ROOM_DOWNGRADE_CREDIT' || item.revenueCategory === 'ROOM') {
    const resolved = activeCode('4050') || findByName('room revenue', 'rooms revenue') || activeCode('4400');
    if (!resolved) throw new Error(`Missing room revenue account for property ${propertyId}`);
    return resolved;
  }

  if (item.source === 'LAUNDRY') {
    const resolved = activeCode(revenueAccounts.LAUNDRY) || findByName('laundry') || activeCode('4400');
    if (!resolved) throw new Error(`Missing laundry revenue account for property ${propertyId}`);
    return resolved;
  }

  if (item.source === 'POS' || item.source === 'RESTAURANT' || item.source === 'BAR' || item.source === 'MINIBAR' || item.revenueCategory === 'FNB') {
    const configured = item.source === 'BAR' ? revenueAccounts.BEVERAGE : revenueAccounts.FOOD;
    // 4250 is the canonical F&B revenue account. Prefer it before legacy
    // name-based matching, otherwise an old 4100 account labelled "F&B
    // Revenue" can steal current POS and folio production.
    const resolved = activeCode(configured) || activeCode('4250') || findByName('food and beverage', 'f&b', 'food');
    if (!resolved) throw new Error(`Missing F&B revenue account for property ${propertyId}`);
    return resolved;
  }

  const resolved = activeCode(revenueAccounts.OTHER) || findByName('other operating revenue') || activeCode('4400');
  if (!resolved) throw new Error(`Missing other operating revenue account for property ${propertyId}`);
  return resolved;
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

    const [property, chartOfAccounts, items, posOrders] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, settings: true } }),
      prisma.chartOfAccount.findMany({
        where: { propertyId, type: 'REVENUE', isActive: true },
        select: { id: true, code: true, name: true, category: true, normalBalance: true, isActive: true },
        orderBy: { code: 'asc' },
      }),
      prisma.folioItem.findMany({
        where: {
          folio: { propertyId },
          businessDate: { gte: queryStart, lte: businessDate },
          type: { in: ['CHARGE', 'DISCOUNT', 'COMPLIMENTARY'] },
          voidedAt: null,
        },
        select: { businessDate: true, source: true, type: true, amount: true, revenueCategory: true, revenueClass: true },
      }),
      prisma.posOrder.findMany({
        where: { propertyId, businessDate: { gte: queryStart, lte: businessDate }, status: { not: 'VOIDED' }, folioId: null },
        select: {
          id: true,
          businessDate: true,
          subtotal: true,
          discount: true,
          total: true,
        },
      }),
    ]);

    const posOrderIds = posOrders.map((order) => order.id);
    const [posPayments, posComplimentaryRecords] = posOrderIds.length
      ? await Promise.all([
        prisma.posPayment.findMany({
          where: { orderId: { in: posOrderIds }, status: { notIn: ['VOIDED', 'FAILED', 'REFUNDED'] } },
          select: { orderId: true, amount: true, method: true },
        }),
        prisma.complimentaryRecord.findMany({
          where: { posOrderId: { in: posOrderIds }, status: { notIn: ['UNRESOLVED', 'REVERSED'] } },
          select: { posOrderId: true, complAmount: true },
        }),
      ])
      : [[], []];
    const paymentsByOrder = new Map<string, typeof posPayments>();
    for (const payment of posPayments) {
      const payments = paymentsByOrder.get(payment.orderId) || [];
      payments.push(payment);
      paymentsByOrder.set(payment.orderId, payments);
    }
    const complimentaryByOrder = new Map<string, typeof posComplimentaryRecords>();
    for (const record of posComplimentaryRecords) {
      if (!record.posOrderId) continue;
      const records = complimentaryByOrder.get(record.posOrderId) || [];
      records.push(record);
      complimentaryByOrder.set(record.posOrderId, records);
    }

    const accounts = new Map(chartOfAccounts.map(account => [account.code, account]));
    const accountingConfig = asRecord(asRecord(property?.settings).accountingConfig);
    const totals = new Map<string, Totals>();
    const daily = new Map<string, DailyTotals>();
    let discountsToday = 0;
    let complimentaryToday = 0;
    const getTotals = (accountCode: string) => {
      const existing = totals.get(accountCode);
      if (existing) return existing;
      const created = { today: 0, mtd: 0, ytd: 0, priorYear: 0, count: 0, gross: 0, discounts: 0 };
      totals.set(accountCode, created);
      return created;
    };
    const addToTotals = (accountCode: string, date: Date, value: number, gross: number, discount: number, transactionCount: number) => {
      const accountTotals = getTotals(accountCode);
      const dateKey = key(date);
      if (dateKey === key(businessDate)) accountTotals.today += value;
      if (date >= monthStart && date <= businessDate) accountTotals.mtd += value;
      if (date >= yearStart && date <= businessDate) accountTotals.ytd += value;
      if (dateKey === key(priorYearDate)) accountTotals.priorYear += value;
      accountTotals.count += transactionCount;
      accountTotals.gross += gross;
      accountTotals.discounts += discount;
      const day = daily.get(dateKey) || { revenue: 0, gross: 0, discounts: 0, transactions: 0 };
      day.revenue += value;
      day.gross += gross;
      day.discounts += discount;
      day.transactions += transactionCount;
      daily.set(dateKey, day);
    };

    for (const item of items) {
      const itemDate = dateOnly(new Date(item.businessDate));
      const value = amountForItem(item);
      const accountCode = resolveAccountCode(propertyId, item, accounts, accountingConfig);
      if (!accountCode) continue;
      const gross = item.type === 'CHARGE' ? Number(item.amount || 0) : 0;
      const discount = item.type === 'DISCOUNT' || item.type === 'COMPLIMENTARY' ? Math.abs(Number(item.amount || 0)) : 0;
      if (key(itemDate) === key(businessDate)) {
        if (item.type === 'DISCOUNT') discountsToday += discount;
        if (item.type === 'COMPLIMENTARY') complimentaryToday += discount;
      }
      addToTotals(accountCode, itemDate, value, gross, discount, item.type === 'CHARGE' ? 1 : 0);
    }

    // Direct POS sales are revenue when they were paid without routing to a
    // guest folio. Folio-routed POS sales are already represented by FolioItem.
    for (const order of posOrders) {
      if (!order.businessDate) continue;
      const orderDate = dateOnly(new Date(order.businessDate));
      const revenueAccountCode = resolveAccountCode(propertyId, { source: 'POS', revenueCategory: 'FNB', type: 'CHARGE' }, accounts, accountingConfig);
      if (!revenueAccountCode) continue;

      // POS accounting posts the item subtotal to revenue. Tax and service
      // charge are liabilities, while discounts/complimentary amounts are
      // separate contra-revenue debits. Using order.total here previously
      // made complimentary POS sales appear as ordinary net revenue.
      const gross = Number(order.subtotal || 0);
      const requestedDiscount = Math.max(0, Number(order.discount || 0));
      const recordedComplimentary = Math.min(
        requestedDiscount,
        (complimentaryByOrder.get(order.id) || []).reduce((sum, record) => sum + Math.max(0, Number(record.complAmount || 0)), 0),
      );
      const discountAmount = Math.max(0, requestedDiscount - recordedComplimentary);
      const payments = paymentsByOrder.get(order.id) || [];
      const complimentaryPayments = payments
        .filter((payment) => String(payment.method).toUpperCase() === 'COMPLIMENTARY')
        .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
      const nonComplimentaryPaymentTotal = payments
        .filter((payment) => String(payment.method).toUpperCase() !== 'COMPLIMENTARY')
        .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
      const orderTotal = Math.max(0, Number(order.total || 0));
      const paymentRatio = orderTotal > 0 ? nonComplimentaryPaymentTotal / orderTotal : 1;

      addToTotals(revenueAccountCode, orderDate, gross, gross, 0, 1);

      if (discountAmount > 0) {
        const discountAccountCode = resolveAccountCode(propertyId, { source: 'POS', revenueCategory: 'FNB', type: 'DISCOUNT' }, accounts, accountingConfig);
        if (key(orderDate) === key(businessDate)) discountsToday += discountAmount;
        addToTotals(discountAccountCode, orderDate, -discountAmount, 0, discountAmount, 0);
      }

      // A COMPLIMENTARY tender is itself posted to 4950. If a complimentary
      // record is paired with a normal tender, mirror the accounting service's
      // proportional allowance allocation instead.
      const complimentaryAmount = complimentaryPayments > 0
        ? complimentaryPayments
        : recordedComplimentary * paymentRatio;
      if (complimentaryAmount > 0) {
        const complimentaryAccountCode = resolveAccountCode(propertyId, { source: 'POS', revenueCategory: 'FNB', type: 'COMPLIMENTARY' }, accounts, accountingConfig);
        if (key(orderDate) === key(businessDate)) complimentaryToday += complimentaryAmount;
        addToTotals(complimentaryAccountCode, orderDate, -complimentaryAmount, 0, complimentaryAmount, 0);
      }
    }

    const departments = chartOfAccounts.map(account => {
      const values = totals.get(account.code) || { today: 0, mtd: 0, ytd: 0, priorYear: 0, count: 0, gross: 0, discounts: 0 };
      const today = Number(values.today.toFixed(2));
      const mtd = Number(values.mtd.toFixed(2));
      const ytd = Number(values.ytd.toFixed(2));
      const priorYear = Number(values.priorYear.toFixed(2));
      return {
        id: account.id,
        accountCode: account.code,
        accountName: account.name,
        department: account.name,
        category: account.category,
        isContra: account.category.toLowerCase().includes('contra') || account.normalBalance === 'DEBIT',
        today,
        mtd,
        ytd,
        priorYear,
        count: values.count,
        gross: Number(values.gross.toFixed(2)),
        discounts: Number(values.discounts.toFixed(2)),
        variance: priorYear === 0 ? null : Number((((today - priorYear) / Math.abs(priorYear)) * 100).toFixed(1)),
        isUp: priorYear > 0 && today >= priorYear,
      };
    });

    const sum = (field: 'today' | 'mtd' | 'ytd' | 'priorYear') => departments.reduce((total, item) => total + item[field], 0);
    const today = sum('today');
    const priorYear = sum('priorYear');
    const dailyTrend = Array.from({ length: 14 }, (_, index) => {
      const date = addDays(businessDate, index - 13);
      const values = daily.get(key(date)) || { revenue: 0, gross: 0, discounts: 0, transactions: 0 };
      return { date: key(date), revenue: Number(values.revenue.toFixed(2)), gross: Number(values.gross.toFixed(2)), discounts: Number(values.discounts.toFixed(2)), transactions: values.transactions };
    });
    const todayActivity = daily.get(key(businessDate)) || { revenue: 0, gross: 0, discounts: 0, transactions: 0 };

    return successResponse({
      property: { id: propertyId, name: property?.name || 'Property', currency: property?.baseCurrency || 'NGN' },
      businessDate: key(businessDate),
      snapshot: {
        today: Number(today.toFixed(2)),
        mtd: Number(sum('mtd').toFixed(2)),
        ytd: Number(sum('ytd').toFixed(2)),
        priorYear: Number(priorYear.toFixed(2)),
        grossToday: Number(todayActivity.gross.toFixed(2)),
        discountsToday: Number(discountsToday.toFixed(2)),
        complimentaryToday: Number(complimentaryToday.toFixed(2)),
        transactionCountToday: todayActivity.transactions,
        variance: priorYear === 0 ? null : Number((((today - priorYear) / Math.abs(priorYear)) * 100).toFixed(1)),
        isUp: priorYear > 0 && today >= priorYear,
      },
      departments,
      dailyTrend,
    });
  } catch (error: unknown) {
    console.error('[Accountant Revenue GET]', error);
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unable to load revenue report', 500);
  }
}
