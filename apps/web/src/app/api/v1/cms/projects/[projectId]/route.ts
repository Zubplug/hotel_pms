import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';
import crypto from 'crypto';

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const project = await prisma.websiteProject.findUnique({
      where: { id: projectId },
      include: {
        revisions: { orderBy: { createdAt: 'desc' } },
        activeRevision: true,
        previewRevision: true,
      }
    });

    if (!project) return errorResponse('NOT_FOUND', 'Project not found', 404);
    if (!propertyIds.includes(project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);

    return successResponse(project);
  } catch (error) {
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    
    const project = await prisma.websiteProject.findUnique({ where: { id: projectId } }) as any;
    if (!project) return errorResponse('NOT_FOUND', 'Project not found', 404);
    if (!propertyIds.includes(project.propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!(await hasPermission(session.user.id, project.propertyId, 'website:manage'))) return errorResponse('FORBIDDEN', 'Website management permission required', 403);

    const body = await req.json();
    const { name, customDomain, primaryColor, secondaryColor, logoUrl, faviconUrl, contactEmail, contactPhone, socialLinks, seoMetadata } = body;

    const updated = await (prisma.websiteProject.update as any)({
      where: { id: project.id },
      data: {
        name: name !== undefined ? name : project.name,
        customDomain: customDomain !== undefined ? (customDomain ? String(customDomain).trim().toLowerCase() : null) : project.customDomain,
        customDomainVerifiedAt: customDomain !== undefined && customDomain !== project.customDomain ? null : project.customDomainVerifiedAt,
        customDomainVerificationToken: customDomain !== undefined && customDomain !== project.customDomain ? (customDomain ? crypto.randomBytes(24).toString('hex') : null) : project.customDomainVerificationToken,
        primaryColor: primaryColor !== undefined ? primaryColor : project.primaryColor,
        secondaryColor: secondaryColor !== undefined ? secondaryColor : project.secondaryColor,
        logoUrl: logoUrl !== undefined ? logoUrl : project.logoUrl,
        faviconUrl: faviconUrl !== undefined ? faviconUrl : project.faviconUrl,
        contactEmail: contactEmail !== undefined ? contactEmail : project.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : project.contactPhone,
        socialLinks: socialLinks !== undefined ? socialLinks : (project.socialLinks as any),
        seoMetadata: seoMetadata !== undefined ? seoMetadata : (project.seoMetadata as any),
      }
    });

    return successResponse(updated);
  } catch (error) {
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
