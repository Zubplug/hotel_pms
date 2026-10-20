import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
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
    const properties = await prisma.property.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true, address: true, city: true, state: true, country: true, phone: true, email: true, website: true, isActive: true, createdAt: true } });
    return NextResponse.json({ properties, limit: await portalPropertyLimit(organizationId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'FORBIDDEN' ? 'Only organization administrators can manage properties.' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requirePortalAdmin();
    const parsed = propertySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Complete all property details.' }, { status: 400 });
    const limit = await portalPropertyLimit(organizationId);
    const activeCount = await prisma.property.count({ where: { organizationId, isActive: true } });
    if (limit !== null && activeCount + 1 > limit) return NextResponse.json({ error: `Your subscription allows ${limit} active propert${limit === 1 ? 'y' : 'ies'}. Upgrade your plan to add another.` }, { status: 402 });
    const property = await prisma.property.create({ data: { ...parsed.data, email: parsed.data.email || '', website: parsed.data.website || null, organizationId, code: `PROP-${randomUUID().slice(0, 8).toUpperCase()}`, baseCurrency: 'NGN', supportedCurrencies: ['NGN'], businessDate: new Date(), auditStatus: 'OPEN', settings: { onboarding: { needsCompletion: false, source: 'PORTAL_PROPERTY_MANAGEMENT' } } } });
    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    console.error('[portal.properties.create]', error);
    return NextResponse.json({ error: error instanceof Error && error.message === 'FORBIDDEN' ? 'Only organization administrators can manage properties.' : 'Unable to create property.' }, { status: error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401 });
  }
}
