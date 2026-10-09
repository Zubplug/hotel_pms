import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';
import crypto from 'crypto';
import { createPreviewToken } from '@/lib/cms/preview-token';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId') || propertyIds[0];

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID required', 400);
    }
    
    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Unauthorized property access', 403);
    }

    const projects = await prisma.websiteProject.findMany({
      where: { propertyId },
      include: {
        activeRevision: true,
        previewRevision: true,
      }
    });

    return successResponse(projects);
  } catch (error: any) {
    console.error('[CMS_PROJECTS_GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const body = await req.json();
    const propertyId = body.propertyId || propertyIds[0];

    if (!propertyId || !organizationId) {
      return errorResponse('BAD_REQUEST', 'Property ID required', 400);
    }

    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Unauthorized property access', 403);
    }

    const hasManageAccess = await hasPermission(session.user.id, propertyId, 'website:manage');
    if (!hasManageAccess) return errorResponse('FORBIDDEN', 'Website management permission required', 403);

    const { name, customDomain: requestedDomain } = body;
    const customDomain = requestedDomain ? String(requestedDomain).trim().toLowerCase() : null;
    if (!name) return errorResponse('BAD_REQUEST', 'Project name is required', 400);

    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.websiteProject.create({
        data: {
          name,
          customDomain: customDomain || null,
          propertyId,
          organizationId,
          status: 'DRAFT',
        }
      });

      const revision = await tx.websiteRevision.create({
        data: {
          projectId: project.id,
          status: 'DRAFT',
          versionName: 'Initial Revision',
          createdBy: session.user!.id,
        }
      });

      return await (tx.websiteProject.update as any)({
        where: { id: project.id },
        data: {
          previewRevisionId: revision.id,
          customDomainVerificationToken: customDomain ? crypto.randomBytes(24).toString('hex') : null,
        },
        include: { previewRevision: true }
      });
    });

    return successResponse({ ...newProject, previewToken: createPreviewToken(newProject.id, newProject.previewRevisionId!) }, 201);
  } catch (error: any) {
    console.error('[CMS_PROJECTS_POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
