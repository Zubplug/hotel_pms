import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/auth';

async function propertyForUser(propertyId: string) {
  const session = await auth();
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
  if (!property) return { response: NextResponse.json({ error: 'Property not found' }, { status: 404 }) };
  return { organizationId, property };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const access = await propertyForUser(propertyId);
  if ('response' in access) return access.response;
  const [policies, ratePlans] = await Promise.all([
    prisma.cancellationPolicy.findMany({ where: { propertyId }, orderBy: { name: 'asc' } }),
    prisma.ratePlan.findMany({ where: { propertyId, isActive: true, isPublic: true, deletedAt: null }, select: { id: true, name: true, code: true, cancellationPolicyId: true }, orderBy: { name: 'asc' } }),
  ]);
  return NextResponse.json({ policies, ratePlans });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const access = await propertyForUser(propertyId);
  if ('response' in access) return access.response;
  const body = await request.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const type = String(body?.type || 'FLEXIBLE').toUpperCase();
  const penaltyType = String(body?.penaltyType || 'NONE').toUpperCase();
  const hoursBeforeCheckIn = Number(body?.hoursBeforeCheckIn);
  const penaltyValue = Number(body?.penaltyValue || 0);
  const ratePlanIds = Array.isArray(body?.ratePlanIds) ? body.ratePlanIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  if (!name || !['FLEXIBLE', 'MODERATE', 'STRICT', 'NON_REFUNDABLE'].includes(type) || !['NONE', 'FIRST_NIGHT', 'PERCENTAGE', 'FLAT'].includes(penaltyType) || !Number.isInteger(hoursBeforeCheckIn) || hoursBeforeCheckIn < 0 || penaltyValue < 0) {
    return NextResponse.json({ error: 'Invalid cancellation policy' }, { status: 400 });
  }
  const validPlans = await prisma.ratePlan.count({ where: { id: { in: ratePlanIds }, propertyId, isActive: true, isPublic: true, deletedAt: null } });
  if (validPlans !== ratePlanIds.length) return NextResponse.json({ error: 'One or more selected rate plans are invalid' }, { status: 400 });
  if (body.id) {
    const existing = await prisma.cancellationPolicy.findFirst({ where: { id: String(body.id), propertyId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }
  const policy = await prisma.$transaction(async (tx) => {
    const saved = body.id
      ? await tx.cancellationPolicy.update({ where: { id: String(body.id) }, data: { name, type, hoursBeforeCheckIn, penaltyType, penaltyValue } })
      : await tx.cancellationPolicy.create({ data: { propertyId, name, type, hoursBeforeCheckIn, penaltyType, penaltyValue } });
    await tx.ratePlan.updateMany({ where: { propertyId, isPublic: true }, data: { cancellationPolicyId: null } });
    if (ratePlanIds.length) await tx.ratePlan.updateMany({ where: { id: { in: ratePlanIds }, propertyId }, data: { cancellationPolicyId: saved.id } });
    return saved;
  });
  return NextResponse.json({ policy }, { status: 200 });
}
