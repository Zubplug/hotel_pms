import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const context = await requireOrganizationContext(session.user.id);
  const partners = await prisma.referralPartner.findMany({
    where: { OR: [{ organizationId: context.organizationId }, { organizationId: null }] },
    orderBy: { createdAt: 'desc' },
    select: { id: true, displayName: true, businessName: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, status: true, verificationStatus: true, termsAcceptedAt: true, createdAt: true },
  });
  return successResponse({ partners });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const context = await requireOrganizationContext(session.user.id);
    if (!['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(context.role)) return errorResponse('FORBIDDEN', 'Only property administrators can verify Reach partners', 403);

    const body = await req.json().catch(() => ({}));
    const partnerId = typeof body?.partnerId === 'string' ? body.partnerId : '';
    const verificationStatus = typeof body?.verificationStatus === 'string' ? body.verificationStatus.toUpperCase() : '';
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : undefined;
    if (!partnerId) return errorResponse('BAD_REQUEST', 'partnerId is required', 400);
    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(verificationStatus)) return errorResponse('BAD_REQUEST', 'verificationStatus must be PENDING, VERIFIED, or REJECTED', 400);
    if (status !== undefined && !['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status)) return errorResponse('BAD_REQUEST', 'status must be ACTIVE, SUSPENDED, or CLOSED', 400);

    const partner = await prisma.referralPartner.findFirst({
      where: { id: partnerId, OR: [{ organizationId: context.organizationId }, { organizationId: null }] },
      select: { id: true },
    });
    if (!partner) return errorResponse('NOT_FOUND', 'Reach partner not found', 404);

    const updated = await prisma.referralPartner.update({
      where: { id: partner.id },
      data: {
        verificationStatus,
        ...(status ? { status } : verificationStatus === 'VERIFIED' ? { status: 'ACTIVE' } : {}),
      },
      select: { id: true, displayName: true, businessName: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, status: true, verificationStatus: true },
    });
    return successResponse({ partner });
  } catch (error: any) {
    return errorResponse('BAD_REQUEST', error?.message || 'Unable to update partner verification', 400);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const context = await requireOrganizationContext(session.user.id);
    if (!['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(context.role)) return errorResponse('FORBIDDEN', 'Only property administrators can register Reach partners', 403);
    const body = await req.json().catch(() => ({}));
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    if (!displayName || displayName.length > 160) return errorResponse('BAD_REQUEST', 'displayName is required', 400);
    const partner = await prisma.referralPartner.create({
      data: {
        organizationId: context.organizationId,
        displayName,
        email,
        phone,
        status: 'ACTIVE',
        verificationStatus: body?.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        termsAcceptedAt: body?.termsAccepted === true ? new Date() : null,
      },
    });
    return successResponse({ partner }, 201);
  } catch (error: any) {
    return errorResponse('BAD_REQUEST', error?.message || 'Unable to create partner', 400);
  }
}
