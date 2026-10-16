import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const context = await requireOrganizationContext(session.user.id);
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  const campaigns = await prisma.referralCampaign.findMany({
    where: { organizationId: context.organizationId, ...(propertyId && context.propertyIds.includes(propertyId) ? { propertyId } : { propertyId: { in: [...context.propertyIds] } }) },
    orderBy: { createdAt: 'desc' },
    include: { partner: { select: { id: true, displayName: true, status: true, verificationStatus: true } }, program: { select: { enabled: true } } },
  });
  return successResponse({ campaigns });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const context = await requireOrganizationContext(session.user.id);
    if (!['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(context.role)) return errorResponse('FORBIDDEN', 'Only property administrators can create campaigns', 403);
    const body = await req.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : '';
    const partnerId = typeof body?.partnerId === 'string' ? body.partnerId : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!propertyId || !context.propertyIds.includes(propertyId) || !partnerId || !name || !code) return errorResponse('BAD_REQUEST', 'propertyId, partnerId, name and code are required', 400);
    const program = await prisma.referralProgram.findFirst({ where: { propertyId, organizationId: context.organizationId, enabled: true } });
    if (!program) return errorResponse('CONFLICT', 'Reach must be enabled for the property before creating campaigns', 409);
    const partner = await prisma.referralPartner.findFirst({ where: { id: partnerId, OR: [{ organizationId: context.organizationId }, { organizationId: null }], status: 'ACTIVE', verificationStatus: 'VERIFIED' } });
    if (!partner) return errorResponse('BAD_REQUEST', 'Partner is not active and verified for this organization', 400);
    const commissionBps = Number(body?.commissionBps ?? 700);
    if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 5000) return errorResponse('BAD_REQUEST', 'commissionBps must be between 0 and 5000', 400);
    const campaign = await prisma.referralCampaign.create({
      data: { organizationId: context.organizationId, propertyId, programId: program.id, partnerId, name, code, category: typeof body?.category === 'string' ? body.category : 'STAY', targetUrl: typeof body?.targetUrl === 'string' ? body.targetUrl : null, commissionBps, budget: body?.budget == null ? null : Number(body.budget), startsAt: body?.startsAt ? new Date(body.startsAt) : null, endsAt: body?.endsAt ? new Date(body.endsAt) : null },
    });
    return successResponse({ campaign }, 201);
  } catch (error: any) {
    return errorResponse('BAD_REQUEST', error?.message || 'Unable to create campaign', 400);
  }
}
