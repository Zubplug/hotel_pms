/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate } from '@/lib/date-utils';

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function context() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const ctx = await requireOrganizationContext(session.user.id);
  return { session, ctx };
}

interface AuditEvent {
  id: string;
  type: string;
  timestamp: string;
  actorId: string | null;
  description: string;
  meta: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    const sp = req.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const facilityId = sp.get('facilityId') || undefined;
    const typeFilter = sp.get('type')?.split(',').filter(Boolean);
    const page = Math.max(1, Number(sp.get('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(sp.get('limit') || 100)));

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { businessDate: true, timezone: true },
    });
    if (!property) return error('Property not found', 404);
    const businessDate = property.businessDate || getPropertyBusinessDate(property.timezone);

    const fromRaw = sp.get('from');
    const toRaw = sp.get('to');
    const from = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : businessDate;
    const to = toRaw ? new Date(`${toRaw}T00:00:00.000Z`) : new Date();

    const facilityFilter = facilityId ? { facilityId } : {};
    const entryBaseFilter = { propertyId, ...facilityFilter };

    // Fetch all relevant records in parallel
    const [entries, incidents, safetyChecks, resourceBookings] = await Promise.all([
      prisma.poolEntry.findMany({
        where: { ...entryBaseFilter, updatedAt: { gte: from, lte: to } },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          passType: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
      prisma.poolIncident.findMany({
        where: { ...entryBaseFilter, updatedAt: { gte: from, lte: to } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      prisma.poolSafetyCheck.findMany({
        where: { ...entryBaseFilter, checkedAt: { gte: from, lte: to } },
        orderBy: { checkedAt: 'desc' },
        take: 200,
      }),
      prisma.poolResourceBooking.findMany({
        where: { propertyId, updatedAt: { gte: from, lte: to }, ...(facilityId ? { resource: { facilityId } } : {}) },
        include: { resource: { select: { name: true, type: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ]);

    const events: AuditEvent[] = [];

    // ─── Pool entries → events ─────────────────────────────────────────────────
    for (const e of entries) {
      const guestName = e.guest ? `${e.guest.firstName} ${e.guest.lastName}`.trim() : 'Walk-in guest';
      const passName = e.passType?.name ?? 'Unknown pass';

      // Entry created (RESERVED or ACTIVE)
      events.push({
        id: `entry-created-${e.id}`,
        type: 'ENTRY_CREATED',
        timestamp: e.createdAt.toISOString(),
        actorId: e.createdBy,
        description: `Admission created · ${passName} · ${guestName}${e.identifier ? ` · Wristband: ${e.identifier}` : ''} · ${e.guestCount} guest${e.guestCount !== 1 ? 's' : ''}`,
        meta: { entryId: e.id, entryNumber: e.entryNumber, guestName, passType: passName, guestCount: e.guestCount, status: e.status },
      });

      // Checked in
      if (e.admittedAt) {
        events.push({
          id: `entry-checkin-${e.id}`,
          type: 'ENTRY_CHECKED_IN',
          timestamp: e.admittedAt.toISOString(),
          actorId: e.checkedInBy,
          description: `Checked in · ${passName} · ${guestName} · ${e.guestCount} guest${e.guestCount !== 1 ? 's' : ''}`,
          meta: { entryId: e.id, entryNumber: e.entryNumber, guestName, passType: passName, guestCount: e.guestCount },
        });
      }

      // Checked out
      if (e.exitedAt) {
        events.push({
          id: `entry-checkout-${e.id}`,
          type: 'ENTRY_CHECKED_OUT',
          timestamp: e.exitedAt.toISOString(),
          actorId: e.checkedOutBy,
          description: `Checked out · ${guestName}${e.identifier ? ` · ${e.identifier}` : ''}`,
          meta: { entryId: e.id, entryNumber: e.entryNumber, guestName },
        });
      }

      // Cancelled
      if (e.status === 'CANCELLED') {
        events.push({
          id: `entry-cancelled-${e.id}`,
          type: 'ENTRY_CANCELLED',
          timestamp: e.updatedAt.toISOString(),
          actorId: e.createdBy,
          description: `Admission cancelled · ${passName} · ${guestName}`,
          meta: { entryId: e.id, entryNumber: e.entryNumber, guestName, passType: passName },
        });
      }
    }

    // ─── Incidents → events ────────────────────────────────────────────────────
    for (const i of incidents) {
      events.push({
        id: `incident-created-${i.id}`,
        type: 'INCIDENT_CREATED',
        timestamp: i.createdAt.toISOString(),
        actorId: i.createdBy,
        description: `Incident reported · ${i.severity} · ${i.title}`,
        meta: { incidentId: i.id, severity: i.severity, title: i.title, status: i.status },
      });
      if (i.resolvedAt) {
        events.push({
          id: `incident-resolved-${i.id}`,
          type: 'INCIDENT_RESOLVED',
          timestamp: i.resolvedAt.toISOString(),
          actorId: i.resolvedBy,
          description: `Incident resolved · ${i.title}`,
          meta: { incidentId: i.id, severity: i.severity, title: i.title },
        });
      }
    }

    // ─── Safety checks → events ────────────────────────────────────────────────
    for (const s of safetyChecks) {
      events.push({
        id: `safety-${s.id}`,
        type: 'SAFETY_CHECK',
        timestamp: s.checkedAt.toISOString(),
        actorId: s.checkedBy,
        description: `Safety check · ${s.checkType} · ${s.status}${s.chlorine != null ? ` · Cl: ${s.chlorine}` : ''}${s.ph != null ? ` · pH: ${s.ph}` : ''}`,
        meta: { safetyId: s.id, checkType: s.checkType, status: s.status, chlorine: s.chlorine, ph: s.ph },
      });
    }

    // ─── Resource bookings → events ────────────────────────────────────────────
    for (const b of resourceBookings) {
      const resourceName = b.resource ? `${b.resource.name} (${b.resource.type})` : 'Resource';
      if (b.status === 'BOOKED' || b.status === 'ACTIVE') {
        events.push({
          id: `resource-booked-${b.id}`,
          type: 'RESOURCE_BOOKED',
          timestamp: b.createdAt.toISOString(),
          actorId: b.createdBy,
          description: `Resource booked · ${resourceName}`,
          meta: { bookingId: b.id, resourceName, status: b.status },
        });
      }
      if (b.status === 'CANCELLED') {
        events.push({
          id: `resource-released-${b.id}`,
          type: 'RESOURCE_RELEASED',
          timestamp: b.updatedAt.toISOString(),
          actorId: b.createdBy,
          description: `Resource released · ${resourceName}`,
          meta: { bookingId: b.id, resourceName },
        });
      }
    }

    // Filter by event type
    const filtered = typeFilter?.length
      ? events.filter((e) => typeFilter.includes(e.type))
      : events;

    // Sort by timestamp DESC
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    return NextResponse.json({ data: { events: paginated, total, page, limit } });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL AUDIT GET]', err);
    return error('Internal Server Error', 500);
  }
}
