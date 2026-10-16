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
    select: { id: true, displayName: true, email: true, phone: true, status: true, verificationStatus: true, termsAcceptedAt: true, createdAt: true },
  });
  return successResponse({ partners });
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
