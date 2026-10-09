import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';
import { AnySectionContentSchema, SectionTypeSchema } from '@hotel-pms/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { pageId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const page = await prisma.websitePage.findUnique({
      where: { id: pageId },
      include: {
        revision: { include: { project: true } }
      }
    });

    if (!page) return errorResponse('NOT_FOUND', 'Page not found', 404);
    if (!propertyIds.includes(page.revision.project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, page.revision.project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);

    const sections = await prisma.websiteSection.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' }
    });

    return successResponse(sections);
  } catch (error) {
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { pageId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const page = await prisma.websitePage.findUnique({
      where: { id: pageId },
      include: {
        revision: { include: { project: true } }
      }
    });

    if (!page) return errorResponse('NOT_FOUND', 'Page not found', 404);
    if (!propertyIds.includes(page.revision.project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, page.revision.project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);
    
    if (page.revision.status !== 'DRAFT') {
      return errorResponse('BAD_REQUEST', 'Cannot modify a non-draft revision', 400);
    }

    const body = await req.json();
    const { type, sortOrder, content } = body;

    const parsedType = SectionTypeSchema.safeParse(type);
    if (!parsedType.success) {
      return errorResponse('BAD_REQUEST', 'Invalid section type', 400);
    }

    // Validate content payload
    const parsedContent = AnySectionContentSchema.safeParse({ type, content });
    if (!parsedContent.success) {
      return errorResponse('BAD_REQUEST', 'Invalid content payload for the given type', 400, { issues: parsedContent.error.issues });
    }

    const section = await prisma.websiteSection.create({
      data: {
        pageId: page.id,
        type: parsedType.data,
        sortOrder: sortOrder || 0,
        content: parsedContent.data.content as any, // Storing just the content block
      }
    });

    return successResponse(section, 201);
  } catch (error) {
    console.error('[CMS_SECTIONS_POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { pageId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const page = await prisma.websitePage.findUnique({
      where: { id: pageId },
      include: {
        revision: { include: { project: true } }
      }
    });

    if (!page) return errorResponse('NOT_FOUND', 'Page not found', 404);
    if (!propertyIds.includes(page.revision.project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, page.revision.project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);
    
    if (page.revision.status !== 'DRAFT') {
      return errorResponse('BAD_REQUEST', 'Cannot modify a non-draft revision', 400);
    }

    const body = await req.json();
    const { sections } = body; // Expects array of { id, sortOrder, content? }

    if (!Array.isArray(sections)) {
      return errorResponse('BAD_REQUEST', 'Sections array required', 400);
    }

    await prisma.$transaction(async (tx) => {
      for (const sec of sections) {
        if (sec.id) {
          const updateData: any = {};
          if (sec.sortOrder !== undefined) updateData.sortOrder = sec.sortOrder;
          if (sec.content !== undefined) {
            const existing = await tx.websiteSection.findFirst({ where: { id: sec.id, pageId: page.id } });
            if (!existing) throw new Error('Section does not belong to this page');
            const parsedContent = AnySectionContentSchema.safeParse({ type: existing.type, content: sec.content });
            if (!parsedContent.success) throw new Error('Invalid section content');
            updateData.content = parsedContent.data.content;
          }
          
          await tx.websiteSection.update({
            where: { id: sec.id, pageId: page.id },
            data: updateData
          });
        }
      }
    });

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
