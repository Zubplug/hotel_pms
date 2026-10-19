/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { PaymentService } from '@/lib/cash-management/PaymentService';
import { PosPaymentAccountingService } from '@/lib/services/pos-payment-accounting-service';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function context() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const ctx = await requireOrganizationContext(session.user.id);
  return { session, ctx };
}

function allowedProperty(ctx: { propertyIds: readonly string[] }, propertyId: string) {
  return ctx.propertyIds.includes(propertyId);
}

export async function GET(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    const propertyId = req.nextUrl.searchParams.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !allowedProperty(ctx, propertyId)) return error('Forbidden property', 403);

    const facilityId = req.nextUrl.searchParams.get('facilityId');
    const search = req.nextUrl.searchParams.get('search')?.trim();
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true, timezone: true, baseCurrency: true } });
    if (!property) return error('Property not found', 404);
    const businessDate = property.businessDate || getPropertyBusinessDate(property.timezone);
    const dayStart = new Date(businessDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const facilities = await prisma.poolFacility.findMany({
      where: { propertyId, isActive: true, ...(facilityId ? { id: facilityId } : {}) },
      include: {
        passTypes: { where: { isActive: true }, orderBy: { name: 'asc' } },
        resources: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    const selectedFacilityId = facilityId || facilities[0]?.id;
    const activeWhere = { propertyId, ...(selectedFacilityId ? { facilityId: selectedFacilityId } : {}), status: 'ACTIVE' };
    const todayWhere = { propertyId, ...(selectedFacilityId ? { facilityId: selectedFacilityId } : {}), entryDate: businessDate };
    const [activeEntries, todayEntries, incidents, latestSafety, guestMatches] = await Promise.all([
      prisma.poolEntry.findMany({ where: activeWhere, include: { guest: true, passType: true }, orderBy: { admittedAt: 'desc' }, take: 100 }),
      prisma.poolEntry.findMany({ where: todayWhere, include: { guest: true, passType: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.poolIncident.findMany({ where: { propertyId, ...(selectedFacilityId ? { facilityId: selectedFacilityId } : {}), status: { not: 'RESOLVED' } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      selectedFacilityId ? prisma.poolSafetyCheck.findFirst({ where: { propertyId, facilityId: selectedFacilityId }, orderBy: { checkedAt: 'desc' } }) : null,
      search && search.length >= 2 ? prisma.guest.findMany({ where: { propertyId, deletedAt: null, OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }, select: { id: true, firstName: true, lastName: true, phone: true, reservations: { where: { status: { in: ['CHECKED_IN', 'CONFIRMED'] }, checkIn: { lte: businessDate }, checkOut: { gt: businessDate } }, select: { id: true, confirmationNumber: true, status: true, checkIn: true, checkOut: true, folios: { where: { status: 'OPEN' }, select: { id: true, folioNumber: true, balance: true }, take: 1 } }, take: 3 } }, take: 20 }) : [],
    ]);

    const facility = facilities.find((item) => item.id === selectedFacilityId);
    const occupancy = activeEntries.reduce((total, entry) => total + entry.guestCount, 0);
    const revenue = await prisma.posOrder.aggregate({
      where: { propertyId, businessDate, status: { notIn: ['VOIDED', 'CANCELLED'] }, outlet: { type: { in: ['POOL', 'RECREATION'] } } },
      _sum: { total: true },
    });

    return NextResponse.json({ data: {
      businessDate,
      currency: property.baseCurrency,
      facility: facility || null,
      facilities,
      metrics: { occupancy, capacity: facility?.capacity || 0, available: Math.max(0, (facility?.capacity || 0) - occupancy), admissions: todayEntries.length, revenue: Number(revenue._sum.total || 0) },
      activeEntries,
      todayEntries,
      incidents,
      latestSafety,
      guestMatches,
    } });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL GET]', err);
    return error('Internal Server Error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    const body = await req.json();
    const propertyId = String(body.propertyId || (session.user as any).propertyId || '');
    if (!propertyId || !allowedProperty(ctx, propertyId)) return error('Forbidden property', 403);
    const action = String(body.action || 'entry');
    const actorId = session.user.id;

    if (action === 'sale') {
      const passType = await prisma.poolPassType.findFirst({ where: { id: String(body.passTypeId || ''), propertyId, isActive: true }, include: { facility: true } });
      if (!passType?.productId) return error('This pass is not linked to a POS product', 409);
      const product = await prisma.posProduct.findFirst({ where: { id: passType.productId, propertyId, isActive: true }, include: { category: { include: { outlet: true } } } });
      if (!product?.category?.outlet) return error('The linked POS product or outlet is unavailable', 409);
      const method = String(body.method || '').toUpperCase();
      if (!['CASH', 'CARD', 'POS', 'BANK_TRANSFER', 'CARD_OFFLINE', 'MOBILE_PAYMENT', 'ROOM_CHARGE', 'COMPLIMENTARY'].includes(method)) return error('Unsupported payment method');
      if (method === 'ROOM_CHARGE' && !body.folioId) return error('An open folio is required for a room charge');
      if (await isNightAuditTransactionLocked(propertyId)) return error('Night audit is in progress. Pool sales are temporarily paused.', 409);
      const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true, timezone: true } });
      if (!property) return error('Property not found', 404);
      const businessDate = property.businessDate || getPropertyBusinessDate(property.timezone);
      const sessionRow = await prisma.posSession.findFirst({ where: { id: body.sessionId || undefined, propertyId, outletId: product.category.outlet.id, status: 'OPEN', controlStatus: 'OPEN' }, orderBy: { openedAt: 'desc' } });
      if (!sessionRow) return error('Open POS session required for the pool outlet', 409);
      const quantity = Math.max(1, Number(body.guestCount || 1));
      const unitPrice = Number(product.price);
      const subtotal = unitPrice * quantity;
      const taxAmount = subtotal * Number(product.taxRate || 0) / 100;
      const total = subtotal + taxAmount;
      const operationId = String(body.operationId || `POOL-SALE-${crypto.randomUUID()}`);
      const existingPayment = await prisma.posPayment.findFirst({ where: { operationId } });
      if (existingPayment) return NextResponse.json({ data: { payment: existingPayment, orderId: existingPayment.orderId }, alreadyApplied: true });
      const order = await prisma.$transaction(async (tx: any) => tx.posOrder.create({ data: { propertyId, outletId: product.category.outlet.id, sessionId: sessionRow.id, folioId: method === 'ROOM_CHARGE' ? String(body.folioId) : undefined, reservationId: body.reservationId || undefined, roomId: body.roomId || undefined, orderNumber: `POOL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, orderType: 'WALK_IN', status: 'SUBMITTED', paymentStatus: 'UNPAID', businessDate, subtotal, taxAmount, total, guestCount: quantity, displayName: body.displayName || 'Pool admission', items: { create: { productId: product.id, productName: product.name, quantity, unitPrice, subtotal, taxRate: product.taxRate, taxAmount, total, kitchenStatus: 'COMPLETED' } } } }));
      if (method === 'ROOM_CHARGE') {
        const settled = await PaymentService.settleOrder({ orderId: order.id, method: 'ROOM_CHARGE', amount: total, cashierId: actorId, sessionId: sessionRow.id, folioId: String(body.folioId), idempotencyKey: operationId });
        return NextResponse.json({ data: { orderId: order.id, payment: settled.payment, total, operationId } }, { status: 201 });
      }
      const result = await prisma.$transaction(async (tx: any) => {
        const payment = await tx.posPayment.create({ data: { orderId: order.id, method: method as any, amount: total, currency: body.currency || 'NGN', status: 'CONFIRMED', sessionId: sessionRow.id, processedById: actorId, reference: operationId, operationId, businessDate, paidAt: new Date() } });
        const fullOrder = await tx.posOrder.findUnique({ where: { id: order.id }, include: { property: true, outlet: true, items: { include: { product: { include: { category: true } } } } } });
        await PosPaymentAccountingService.processPaymentAccounting(tx, payment, fullOrder, actorId);
        if (method === 'CASH') await tx.posSession.update({ where: { id: sessionRow.id }, data: { cashSales: { increment: total } } });
        await InventoryService.commitSaleInTransaction(tx, order.id, actorId, `POOL_SALE_${operationId}`);
        const updatedOrder = await tx.posOrder.update({ where: { id: order.id }, data: { status: 'CLOSED', paymentStatus: 'PAID', closedAt: new Date() } });
        return { payment, order: updatedOrder };
      });
      return NextResponse.json({ data: { orderId: result.order.id, payment: result.payment, total, operationId } }, { status: 201 });
    }

    if (action === 'setup') {
      const role = String((session.user as any).role || ctx.role || '').toUpperCase();
      if (!['SUPER_ADMIN', 'ADMIN', 'OWNER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR'].includes(role)) return error('Only an authorized manager can configure pool operations', 403);
      if (!body.name || !body.code || Number(body.capacity) < 1) return error('Facility name, code and capacity are required');
      const setup = await prisma.$transaction(async (tx: any) => {
        const facility = await tx.poolFacility.create({ data: { propertyId, name: String(body.name), code: String(body.code).toUpperCase(), capacity: Number(body.capacity) } });
        const passTypes = Array.isArray(body.passTypes) && body.passTypes.length ? body.passTypes : [{ name: 'Adult day pass', code: 'ADULT-DAY', guestClass: 'ADULT', price: 0 }, { name: 'Child day pass', code: 'CHILD-DAY', guestClass: 'CHILD', price: 0 }];
        await tx.poolPassType.createMany({ data: passTypes.map((pass: any) => ({ propertyId, facilityId: facility.id, name: String(pass.name), code: String(pass.code).toUpperCase(), guestClass: String(pass.guestClass || 'ADULT'), price: Number(pass.price || 0), currency: String(pass.currency || 'NGN') })) });
        return tx.poolFacility.findUnique({ where: { id: facility.id }, include: { passTypes: true } });
      });
      return NextResponse.json({ data: setup }, { status: 201 });
    }

    if (action === 'configure_pass') {
      const role = String((session.user as any).role || ctx.role || '').toUpperCase();
      if (!['SUPER_ADMIN', 'ADMIN', 'OWNER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR'].includes(role)) return error('Only an authorized manager can configure pool passes', 403);
      const passType = await prisma.poolPassType.findFirst({ where: { id: String(body.passTypeId || ''), propertyId, isActive: true } });
      if (!passType) return error('Pool pass not found', 404);
      const productId = body.productId ? String(body.productId) : null;
      if (productId) {
        const product = await prisma.posProduct.findFirst({ where: { id: productId, propertyId, isActive: true }, select: { id: true, price: true } });
        if (!product) return error('Active POS product not found for this property', 404);
      }
      const updated = await prisma.poolPassType.update({ where: { id: passType.id }, data: { productId, price: body.price == null ? passType.price : Number(body.price), isComplimentary: Boolean(body.isComplimentary) } });
      return NextResponse.json({ data: updated });
    }

    if (action === 'safety_check') {
      const facility = await prisma.poolFacility.findFirst({ where: { id: body.facilityId, propertyId, isActive: true } });
      if (!facility) return error('Facility not found', 404);
      const check = await prisma.poolSafetyCheck.create({ data: { propertyId, facilityId: facility.id, checkType: String(body.checkType || 'OPENING'), status: String(body.status || 'PASS'), chlorine: body.chlorine == null ? undefined : Number(body.chlorine), ph: body.ph == null ? undefined : Number(body.ph), notes: body.notes ? String(body.notes) : undefined, checkedBy: actorId } });
      return NextResponse.json({ data: check }, { status: 201 });
    }

    if (action === 'incident') {
      const facility = await prisma.poolFacility.findFirst({ where: { id: body.facilityId, propertyId, isActive: true } });
      if (!facility || !body.title || !body.description) return error('Facility, title and description are required');
      if (body.entryId) {
        const entry = await prisma.poolEntry.findFirst({ where: { id: String(body.entryId), propertyId, facilityId: facility.id }, select: { id: true } });
        if (!entry) return error('Pool entry not found', 404);
      }
      const severity = String(body.severity || 'LOW').toUpperCase();
      if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) return error('Invalid incident severity');
      const incident = await prisma.poolIncident.create({ data: { propertyId, facilityId: facility.id, entryId: body.entryId || undefined, severity, title: String(body.title), description: String(body.description), createdBy: actorId } });
      return NextResponse.json({ data: incident }, { status: 201 });
    }

    const facilityId = String(body.facilityId || '');
    const passTypeId = String(body.passTypeId || '');
    const guestCount = Math.max(1, Math.min(20, Number(body.guestCount || 1)));
    if (!facilityId || !passTypeId) return error('facilityId and passTypeId are required');
    if (!body.waiverAccepted) return error('A guest waiver must be accepted before admission');
    if (body.operationId) {
      const existing = await prisma.poolEntry.findUnique({ where: { operationId: String(body.operationId) }, include: { guest: true, passType: true, facility: true } });
      if (existing) return NextResponse.json({ data: existing, alreadyApplied: true });
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { timezone: true } });
    if (!property) return error('Property not found', 404);
    const businessDate = body.entryDate ? new Date(`${body.entryDate}T00:00:00.000Z`) : getPropertyBusinessDate(property.timezone);
    const result = await prisma.$transaction(async (tx: any) => {
      const facility = await tx.poolFacility.findFirst({ where: { id: facilityId, propertyId, isActive: true } });
      const passType = await tx.poolPassType.findFirst({ where: { id: passTypeId, facilityId, propertyId, isActive: true } });
      if (!facility || !passType) throw new Error('FACILITY_OR_PASS_NOT_FOUND');
      if (facility.status !== 'OPEN') throw new Error(`FACILITY_${facility.status}`);
      if (body.guestId) {
        const guest = await tx.guest.findFirst({ where: { id: String(body.guestId), propertyId, deletedAt: null }, select: { id: true } });
        if (!guest) throw new Error('GUEST_NOT_FOUND');
      }
      if (body.folioId) {
        const folio = await tx.folio.findFirst({ where: { id: String(body.folioId), propertyId, status: 'OPEN' }, select: { id: true } });
        if (!folio) throw new Error('FOLIO_NOT_FOUND');
      }
      if (body.reservationId) {
        const reservation = await tx.reservation.findFirst({ where: { id: String(body.reservationId), propertyId }, select: { id: true } });
        if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
      }
      if (body.posOrderId) {
        const order = await tx.posOrder.findFirst({ where: { id: String(body.posOrderId), propertyId }, select: { id: true } });
        if (!order) throw new Error('POS_ORDER_NOT_FOUND');
      }
      if (body.identifier) {
        const duplicate = await tx.poolEntry.findFirst({ where: { propertyId, identifier: String(body.identifier), status: 'ACTIVE' } });
        if (duplicate) throw new Error('IDENTIFIER_ALREADY_ACTIVE');
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${facilityId}:${businessDate.toISOString().slice(0, 10)}`}, 0))`;
      const active = await tx.poolEntry.aggregate({ where: { propertyId, facilityId, status: 'ACTIVE' }, _sum: { guestCount: true } });
      if (Number(active._sum.guestCount || 0) + guestCount > facility.capacity) throw new Error('CAPACITY_EXCEEDED');
      const entryNumber = `POOL-${businessDate.toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      return tx.poolEntry.create({ data: { propertyId, facilityId, passTypeId, guestId: body.guestId || undefined, reservationId: body.reservationId || undefined, folioId: body.folioId || undefined, posOrderId: body.posOrderId || undefined, entryNumber, identifier: body.identifier ? String(body.identifier) : undefined, status: body.admitNow === false ? 'RESERVED' : 'ACTIVE', entryDate: businessDate, admittedAt: body.admitNow === false ? undefined : new Date(), guestCount, waiverAccepted: true, notes: body.notes ? String(body.notes) : undefined, createdBy: actorId, checkedInBy: body.admitNow === false ? undefined : actorId, operationId: body.operationId ? String(body.operationId) : undefined, deviceId: body.deviceId ? String(body.deviceId) : undefined }, include: { guest: true, passType: true, facility: true } });
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    const known: Record<string, string> = { FACILITY_OR_PASS_NOT_FOUND: 'Facility or pass type not found', FACILITY_CLOSED: 'The pool is closed', FACILITY_MAINTENANCE: 'The pool is under maintenance', FACILITY_WEATHER_HOLD: 'The pool is on a weather hold', GUEST_NOT_FOUND: 'Guest not found for this property', FOLIO_NOT_FOUND: 'Open folio not found for this property', RESERVATION_NOT_FOUND: 'Reservation not found for this property', POS_ORDER_NOT_FOUND: 'POS order not found for this property', IDENTIFIER_ALREADY_ACTIVE: 'This wristband or identifier is already active', CAPACITY_EXCEEDED: 'Pool capacity would be exceeded' };
    if (known[err?.message]) return error(known[err.message], 409);
    console.error('[POOL POST]', err);
    return error('Internal Server Error', 500);
  }
}
