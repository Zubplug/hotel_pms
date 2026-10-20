import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { portalPropertyLimit, requirePortalAdmin } from '@/lib/portal-authorization';

const updateSchema = z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().min(3).max(240), city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(100), country: z.string().trim().min(2).max(100), phone: z.string().trim().min(7).max(30), email: z.string().trim().email().max(254).optional().or(z.literal('')), website: z.string().trim().max(200).optional().or(z.literal('')), isActive: z.boolean().optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requirePortalAdmin();
    const id = (await params).id;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Complete all property details.' }, { status: 400 });
    const current = await prisma.property.findFirst({ where: { id, organizationId } });
    if (!current) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
    if (parsed.data.isActive === true && !current.isActive) {
      const limit = await portalPropertyLimit(organizationId);
      const activeCount = await prisma.property.count({ where: { organizationId, isActive: true } });
      if (limit !== null && activeCount + 1 > limit) return NextResponse.json({ error: `Your subscription allows ${limit} active propert${limit === 1 ? 'y' : 'ies'}. Upgrade your plan to reactivate this property.` }, { status: 402 });
    }
    const property = await prisma.property.update({ where: { id }, data: { ...parsed.data, email: parsed.data.email || '', website: parsed.data.website || null } });
    return NextResponse.json({ property });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'FORBIDDEN' ? 'Only organization administrators can manage properties.' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401 });
  }
}
