import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: Promise<{ revisionId: string }> }) {
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

    const pages = await prisma.websitePage.findMany({
      where: { revisionId },
      orderBy: { slug: 'asc' }
    });

    return successResponse(pages);
  } catch (error) {
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}

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
    
    if (revision.status !== 'DRAFT') {
      return errorResponse('BAD_REQUEST', 'Cannot add pages to a non-draft revision', 400);
    }

    const body = await req.json();
    const { slug, title, seoTitle, seoDescription, status } = body;

    if (!slug || !title) return errorResponse('BAD_REQUEST', 'Slug and title required', 400);

    const existingPage = await prisma.websitePage.findFirst({
      where: { revisionId: revision.id, slug }
    });
    if (existingPage) {
      return errorResponse('CONFLICT', 'Page with this slug already exists in this revision', 409);
    }

    const page = await prisma.websitePage.create({
      data: {
        revisionId: revision.id,
        slug,
        title,
        seoTitle,
        seoDescription,
        status: status || 'PUBLISHED',
      }
    });

    return successResponse(page, 201);
  } catch (error) {
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
