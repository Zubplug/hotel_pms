/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ctx = await requireOrganizationContext(session.user.id);
  const propertyId = req.nextUrl.searchParams.get('propertyId') || (session.user as any).propertyId;
  if (!propertyId || !ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
  const from = new Date(req.nextUrl.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString());
  const to = new Date(req.nextUrl.searchParams.get('to') || new Date().toISOString());
  const [entries, orders, resources, incidents, safety] = await Promise.all([
    prisma.poolEntry.findMany({ where: { propertyId, createdAt: { gte: from, lte: to } }, include: { passType: true, facility: true, guest: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.posOrder.findMany({ where: { propertyId, businessDate: { gte: from, lte: to }, status: { notIn: ['VOIDED', 'CANCELLED'] }, outlet: { type: { in: ['POOL', 'RECREATION'] } } }, select: { id: true, orderNumber: true, businessDate: true, total: true, paymentStatus: true }, orderBy: { businessDate: 'desc' } }),
    prisma.poolResourceBooking.findMany({ where: { propertyId, startAt: { lt: to }, endAt: { gt: from } }, include: { resource: true }, orderBy: { startAt: 'desc' } }),
    prisma.poolIncident.findMany({ where: { propertyId, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' } }),
    prisma.poolSafetyCheck.findMany({ where: { propertyId, checkedAt: { gte: from, lte: to } }, orderBy: { checkedAt: 'desc' } }),
  ]);
  const byPass = new Map<string, { count: number; guests: number }>();
  for (const entry of entries) { const key = entry.passType.name; const current = byPass.get(key) || { count: 0, guests: 0 }; current.count += 1; current.guests += entry.guestCount; byPass.set(key, current); }
  return NextResponse.json({ data: { from, to, summary: { admissions: entries.length, guests: entries.reduce((sum, entry) => sum + entry.guestCount, 0), posRevenue: orders.reduce((sum, order) => sum + Number(order.total), 0), resourcesBooked: resources.length, incidents: incidents.length, safetyChecks: safety.length }, byPass: Array.from(byPass, ([passType, values]) => ({ passType, ...values })), entries, orders, resources, incidents, safety } });
}
