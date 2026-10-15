/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

const n = (value: unknown) => Number(value || 0);
const round = (value: number) => Math.round(value * 100) / 100;

function revenueDepartment(source: string, category: string, revenueClass?: string | null) {
  const sourceName = source.toUpperCase();
  const className = String(revenueClass || '').toUpperCase();
  if (className === 'HALL') return 'Events';
  if (className === 'EQUIPMENT') return 'Events';
  if (sourceName === 'ROOM_CHARGE' || sourceName === 'DAY_USE_ROOM_CHARGE') {
    if (category === 'FNB') return 'F&B';
    if (category === 'OTHER') return 'Service Charge';
    return 'Rooms';
  }
  if (sourceName === 'POS' || sourceName === 'RESTAURANT' || sourceName === 'BAR' || category === 'FNB') return 'F&B';
  const labels: Record<string, string> = { SPA: 'Spa', LAUNDRY: 'Laundry', TRANSPORT: 'Transport', TELEPHONE: 'Telephone', INTERNET: 'Internet', MINIBAR: 'Minibar', MANUAL: 'Other' };
  return labels[sourceName] || 'Other';
}

function addRow(map: Map<string, any>, key: string, row: any) {
  const current = map.get(key) || { ...row, gross: 0, discounts: 0, adjustments: 0, refunds: 0, net: 0, tax: 0, total: 0, transactionCount: 0 };
  current.gross += row.gross || 0;
  current.discounts += row.discounts || 0;
  current.adjustments += row.adjustments || 0;
  current.refunds += row.refunds || 0;
  current.net += row.net || 0;
  current.tax += row.tax || 0;
  current.total += row.total || 0;
  current.transactionCount += row.transactionCount || 0;
  map.set(key, current);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const businessDateValue = req.nextUrl.searchParams.get('businessDate');
    if (!propertyId || !businessDateValue || !/^\d{4}-\d{2}-\d{2}$/.test(businessDateValue)) return errorResponse('BAD_REQUEST', 'propertyId and businessDate (YYYY-MM-DD) are required', 400);
    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Property access denied', 403);
    const businessDate = new Date(`${businessDateValue}T00:00:00.000Z`);

    const [property, audit, items, posOrders, payments, posPayments] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, email: true, phone: true, address: true, city: true, state: true, baseCurrency: true } }),
      prisma.nightAudit.findUnique({ where: { propertyId_businessDate: { propertyId, businessDate } }, include: { financialSnapshot: true, closePackage: { select: { status: true, finalizedAt: true, packageHash: true } } } }),
      prisma.folioItem.findMany({ where: { folio: { propertyId }, businessDate }, select: { id: true, type: true, source: true, revenueCategory: true, revenueClass: true, description: true, amount: true, quantity: true, unitAmount: true, baseAmount: true, posTransactionId: true, voidedAt: true, isLatePosting: true, taxId: true, discountId: true, reservation: { select: { reservationRooms: { where: { checkIn: { lte: businessDate }, checkOut: { gte: businessDate } }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { room: { select: { number: true } } } } } } } }),
      prisma.posOrder.findMany({ where: { propertyId, businessDate, status: 'CLOSED', payments: { some: { status: { in: ['CONFIRMED', 'PAID'] } } } }, select: { id: true, orderNumber: true, subtotal: true, taxAmount: true, discount: true, total: true, serviceCharge: true, outlet: { select: { name: true, type: true } }, payments: { where: { status: { in: ['CONFIRMED', 'PAID'] } }, select: { amount: true, method: true } } } }),
      prisma.payment.groupBy({ by: ['method'], where: { propertyId, businessDate, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true }, _count: { id: true } }),
      prisma.posPayment.groupBy({ by: ['method'], where: { businessDate, status: { in: ['CONFIRMED', 'PAID'] }, order: { propertyId } }, _sum: { amount: true }, _count: { id: true } }),
    ]);
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const rows = new Map<string, any>();
    const representedPos = new Set<string>();
    const taxRows = new Map<string, any>();
    const sourceRows = new Map<string, any>();
    const detail: any[] = [];
    let voidCount = 0;
    let latePostingCount = 0;
    let complimentaryPos = 0;
    for (const item of items) {
      if (item.voidedAt) { voidCount += 1; continue; }
      if (item.isLatePosting) latePostingCount += 1;
      if (item.posTransactionId) representedPos.add(item.posTransactionId);
      const amount = n(item.amount);
      const department = revenueDepartment(String(item.source), String(item.revenueCategory), item.revenueClass);
      const code = String(item.source);
      const description = item.description || code;
      const values = { department, code, description, gross: item.type === 'CHARGE' ? amount : 0, discounts: ['DISCOUNT', 'COMPLIMENTARY'].includes(item.type) ? Math.abs(amount) : 0, adjustments: item.type === 'ADJUSTMENT' ? Math.abs(amount) : 0, refunds: item.type === 'REFUND' ? Math.abs(amount) : 0, net: item.type === 'CHARGE' ? amount : ['DISCOUNT', 'COMPLIMENTARY', 'ADJUSTMENT', 'REFUND'].includes(item.type) ? -Math.abs(amount) : 0, tax: item.type === 'TAX' ? amount : 0, total: ['CHARGE', 'TAX'].includes(item.type) ? amount : ['DISCOUNT', 'COMPLIMENTARY', 'ADJUSTMENT', 'REFUND'].includes(item.type) ? -Math.abs(amount) : 0, transactionCount: item.type === 'CHARGE' ? 1 : 0 };
      addRow(rows, `${department}:${code}:${description}`, values);
      addRow(sourceRows, code, { department, code, description: code, transactionCount: values.transactionCount, gross: values.gross, net: values.net, tax: values.tax, total: values.total });
      if (item.type === 'TAX') addRow(taxRows, item.taxId || description, { code: item.taxId || '—', description, transactionCount: 1, gross: 0, net: 0, tax: amount, total: amount });
      if (item.type !== 'PAYMENT') detail.push({ id: item.id, type: item.type, department, source: code, description, roomNumber: item.reservation?.reservationRooms[0]?.room?.number ? String(item.reservation.reservationRooms[0].room.number).split('.').pop() : null, amount: round(amount), quantity: n(item.quantity), unitAmount: round(n(item.unitAmount)), latePosting: Boolean(item.isLatePosting) });
    }

    for (const order of posOrders) {
      if (representedPos.has(order.id)) continue;
      const complimentary = order.payments.filter((payment) => String(payment.method) === 'COMPLIMENTARY').reduce((sum, payment) => sum + n(payment.amount), 0);
      complimentaryPos += complimentary;
      const outlet = order.outlet?.name || 'F&B';
      // Complimentary POS tenders are concessions, not recognized revenue.
      // Exclude them from gross while retaining the amount in the control summary.
      const gross = Math.max(0, n(order.subtotal) - complimentary);
      const discounts = n(order.discount);
      const total = Math.max(0, n(order.total) - complimentary);
      addRow(rows, `F&B:POS:${outlet}`, { department: 'F&B', code: 'POS', description: `${outlet} · POS sales`, gross, discounts, net: gross - discounts, tax: n(order.taxAmount), total, transactionCount: 1 });
      detail.push({ id: order.id, type: 'POS_ORDER', department: 'F&B', source: 'POS', description: `${outlet} · ${order.orderNumber}${complimentary > 0 ? ` · complimentary ${round(complimentary)}` : ''}`, roomNumber: null, amount: round(total), quantity: 1, unitAmount: round(total), latePosting: false });
    }

    const departments = [...new Set([...rows.values()].map((row: any) => row.department))].map((department) => ({ department, revenues: [...rows.values()].filter((row: any) => row.department === department).map((row: any) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value]))) })).sort((a, b) => a.department.localeCompare(b.department));
    const allRows = [...rows.values()];
    const totals = ['gross', 'discounts', 'adjustments', 'refunds', 'net', 'tax', 'total', 'transactionCount'].reduce((result: any, key) => { result[key] = round(allRows.reduce((sum, row) => sum + n(row[key]), 0)); return result; }, {});
    const paymentMap = new Map<string, any>();
    for (const payment of [...payments, ...posPayments]) { const key = String(payment.method); const row = paymentMap.get(key) || { method: key, amount: 0, transactionCount: 0 }; row.amount += n(payment._sum?.amount); row.transactionCount += payment._count?.id || 0; paymentMap.set(key, row); }
    const paymentTotals = [...paymentMap.values()].map((row) => ({ ...row, amount: round(row.amount) })).sort((a, b) => b.amount - a.amount);
    const snapshot = audit?.financialSnapshot;
    const snapshotValues = { gross: n(snapshot?.grossRevenue), net: n(snapshot?.netRevenue), tax: n(snapshot?.taxes), discounts: n(snapshot?.discounts), refunds: n(snapshot?.refunds) };
    return successResponse({ propertyName: property.name, propertyEmail: property.email || '', propertyPhone: property.phone || '', propertyAddress: [property.address, property.city, property.state].filter(Boolean).join(', '), propertyCurrency: property.baseCurrency || 'NGN', businessDate: businessDateValue, auditStatus: audit?.status || 'NOT_RUN', audit: { status: audit?.status || 'NOT_RUN', closePackageStatus: audit?.closePackage?.status || 'NOT_FINALIZED', finalizedAt: audit?.closePackage?.finalizedAt, roomChargesPosted: audit?.roomChargesPosted || 0, errors: audit?.errors || 0 }, departments, totals, taxBreakdown: [...taxRows.values()].map((row) => ({ ...row, tax: round(row.tax), total: round(row.total) })), sourceBreakdown: [...sourceRows.values()].map((row) => ({ ...row, gross: round(row.gross), net: round(row.net), tax: round(row.tax), total: round(row.total), transactionCount: row.transactionCount })), paymentTotals, detail: detail.slice(0, 500), controls: { itemCount: items.length, detailCount: detail.length, voidCount, latePostingCount, complimentaryPos: round(complimentaryPos), posOrderCount: posOrders.length, representedPosOrderCount: representedPos.size }, reconciliation: { snapshot: snapshotValues, detail: { gross: totals.gross, net: totals.net, tax: totals.tax, discounts: totals.discounts, refunds: totals.refunds }, variance: { gross: round(totals.gross - snapshotValues.gross), net: round(totals.net - snapshotValues.net), tax: round(totals.tax - snapshotValues.tax), discounts: round(totals.discounts - snapshotValues.discounts), refunds: round(totals.refunds - snapshotValues.refunds) } } });
  } catch (err: any) {
    console.error('[Detailed Revenue GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message || 'Failed to build detailed revenue report', 500);
  }
}
