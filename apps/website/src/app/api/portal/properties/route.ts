import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { portalPropertyLimit, requirePortalAdmin } from '@/lib/portal-authorization';

const propertySchema = z.object({
  name: z.string().trim().min(2).max(160), address: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100), phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  website: z.string().trim().max(200).optional().or(z.literal('')),
});

export async function GET() {
  try {
    const { organizationId } = await requirePortalAdmin();
    const [properties, requests] = await Promise.all([
      prisma.property.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true, address: true, city: true, state: true, country: true, phone: true, email: true, website: true, isActive: true, createdAt: true } }),
      prisma.organizationApprovalRequest.findMany({ where: { organizationId, type: 'PROPERTY_CREATE' }, orderBy: { requestedAt: 'desc' }, select: { id: true, status: true, payload: true, reviewNotes: true, requestedAt: true } }),
    ]);
    return NextResponse.json({ properties, requests, limit: await portalPropertyLimit(organizationId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'FORBIDDEN' ? 'Only organization administrators can manage properties.' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId } = await requirePortalAdmin();
    const parsed = propertySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Complete all property details.' }, { status: 400 });
    const pending = await prisma.organizationApprovalRequest.findFirst({ where: { organizationId, requestedById: userId, type: 'PROPERTY_CREATE', status: 'PENDING' }, select: { id: true } });
    if (pending) return NextResponse.json({ error: 'A property request is already awaiting HQ approval.' }, { status: 409 });
    const approvalRequest = await prisma.organizationApprovalRequest.create({ data: { organizationId, requestedById: userId, type: 'PROPERTY_CREATE', reason: 'Customer requested a new property from the portal.', payload: { ...parsed.data, email: parsed.data.email || '', website: parsed.data.website || null } }, select: { id: true, status: true, payload: true, requestedAt: true } });
    return NextResponse.json({ request: approvalRequest, message: 'Property request submitted for HQ approval.' }, { status: 202 });
  } catch (error) {
    console.error('[portal.properties.create]', error);
    return NextResponse.json({ error: error instanceof Error && error.message === 'FORBIDDEN' ? 'Only organization administrators can manage properties.' : 'Unable to create property.' }, { status: error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401 });
  }
}
