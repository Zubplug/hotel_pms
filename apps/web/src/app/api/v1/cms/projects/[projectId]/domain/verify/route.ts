import { NextRequest } from 'next/server';
import { promises as dns } from 'dns';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds } = await requireOrganizationContext(session.user.id);
    const project = await prisma.websiteProject.findUnique({ where: { id: projectId } }) as any;
    if (!project) return errorResponse('NOT_FOUND', 'Project not found', 404);
    if (!propertyIds.includes(project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);
    if (!project.customDomain || !project.customDomainVerificationToken) return errorResponse('BAD_REQUEST', 'Configure a custom domain first', 400);

    const records = await dns.resolveTxt(`_lodgecore-verification.${project.customDomain}`);
    const values = records.flat();
    if (!values.includes(project.customDomainVerificationToken)) {
      return errorResponse('UNPROCESSABLE', 'DNS verification record was not found', 422);
    }
    const verified = await (prisma.websiteProject.update as any)({
      where: { id: project.id },
      data: { customDomainVerifiedAt: new Date() },
      select: { id: true, customDomain: true, customDomainVerifiedAt: true },
    });
    return successResponse(verified);
  } catch (error) {
    console.error('[CMS_DOMAIN_VERIFY]', error);
    return errorResponse('UNPROCESSABLE', 'DNS verification failed', 422);
  }
}
