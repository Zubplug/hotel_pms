import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ revisionId: string }> }) {
  try {
    const { revisionId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const revision = await prisma.websiteRevision.findUnique({
      where: { id: revisionId },
      include: { project: true }
    });

    if (!revision) return errorResponse('NOT_FOUND', 'Revision not found', 404);
    if (!propertyIds.includes(revision.project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, revision.project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);
    
    if (!['DRAFT', 'ARCHIVED'].includes(revision.status)) {
      return errorResponse('BAD_REQUEST', 'Only DRAFT or ARCHIVED revisions can be published', 400);
    }

    // Atomic publish flow
    await prisma.$transaction(async (tx) => {
      // 1. Mark this revision as PUBLISHED
      const publishedRev = await tx.websiteRevision.update({
        where: { id: revision.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        }
      });

      await tx.websiteRevision.updateMany({
        where: { projectId: revision.projectId, id: { not: revision.id }, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });

      // 2. Point Project's activeRevisionId to this revision, and status to PUBLISHED
      await tx.websiteProject.update({
        where: { id: revision.projectId },
        data: {
          activeRevisionId: publishedRev.id,
          previewRevisionId: null,
          status: 'PUBLISHED',
        }
      });
    });

    return successResponse({ success: true, publishedRevisionId: revision.id });
  } catch (error) {
    console.error('[CMS_PUBLISH_POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
