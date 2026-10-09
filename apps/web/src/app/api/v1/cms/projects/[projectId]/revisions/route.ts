import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';
import { createPreviewToken } from '@/lib/cms/preview-token';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const project = await prisma.websiteProject.findUnique({ where: { id: projectId } });
    if (!project) return errorResponse('NOT_FOUND', 'Project not found', 404);
    if (!propertyIds.includes(project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);

    const body = await req.json();
    const { versionName, cloneFromRevisionId } = body;

    if (!versionName) return errorResponse('BAD_REQUEST', 'Version name required', 400);

    const newRevision = await prisma.$transaction(async (tx) => {
      const revision = await tx.websiteRevision.create({
        data: {
          projectId: project.id,
          status: 'DRAFT',
          versionName,
          createdBy: session.user!.id,
        }
      });

      if (cloneFromRevisionId) {
        // Clone pages and sections
        const sourceRevision = await tx.websiteRevision.findFirst({
          where: { id: cloneFromRevisionId, projectId: project.id },
        });
        if (!sourceRevision) throw new Error('Invalid source revision');
        const pagesToClone = await tx.websitePage.findMany({
          where: { revisionId: sourceRevision.id },
          include: { sections: true }
        });

        for (const page of pagesToClone) {
          const newPage = await tx.websitePage.create({
            data: {
              revisionId: revision.id,
              slug: page.slug,
              title: page.title,
              seoTitle: page.seoTitle,
              seoDescription: page.seoDescription,
              status: page.status,
            }
          });

          if (page.sections.length > 0) {
            await tx.websiteSection.createMany({
              data: page.sections.map(sec => ({
                pageId: newPage.id,
                type: sec.type,
                sortOrder: sec.sortOrder,
                content: sec.content as any,
              }))
            });
          }
        }
      }

      await tx.websiteProject.update({
        where: { id: project.id },
        data: { previewRevisionId: revision.id }
      });

      return revision;
    });

    return successResponse({ ...newRevision, previewToken: createPreviewToken(project.id, newRevision.id) }, 201);
  } catch (error) {
    console.error('[CMS_REVISIONS_POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
