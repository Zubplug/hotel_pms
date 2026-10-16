import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { createAuditLog } from '@/lib/audit';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess, ForbiddenError, NotFoundError } from '@/lib/property-access';
import { requireOrganizationContext } from '@/lib/organization-access';

type Params = { params: Promise<{ id: string }> };
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function authorize(userId: string, propertyId: string) {
  const ctx = await requireOrganizationContext(userId);
  await assertPropertyAccess(userId, propertyId);
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, organizationId: true } });
  if (!property) throw new NotFoundError('Property not found');
  if (!(await hasPermission(userId, 'property', 'update', propertyId))) throw new ForbiddenError('Insufficient permissions');
  return { ctx, property };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const { ctx, property } = await authorize(session.user.id, id);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return errorResponse('VALIDATION_ERROR', 'An image file is required', 400);
    if (file.size > MAX_IMAGE_SIZE) return errorResponse('VALIDATION_ERROR', 'Images must be 10 MB or smaller', 400);
    if (!IMAGE_TYPES.has(file.type)) return errorResponse('VALIDATION_ERROR', 'Only JPG, PNG, and WebP images are supported', 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `properties/${property.id}/media/${crypto.randomUUID()}-${safeName}`;
    const blob = await put(storageKey, file, { access: 'public', addRandomSuffix: false });
    const existing = await prisma.reachPropertyMedia.count({ where: { propertyId: property.id, kind: 'PROPERTY', status: 'APPROVED' } });
    const media = await prisma.reachPropertyMedia.create({ data: { propertyId: property.id, kind: 'PROPERTY', url: blob.url, altText: String(form.get('altText') || `${property.id} property image`), storageKey, mimeType: file.type, status: 'APPROVED', sortOrder: existing } });
    await createAuditLog({ organizationId: ctx.organizationId, propertyId: property.id, userId: session.user.id, action: 'CREATE', resource: 'property_media', resourceId: media.id, newValue: media });
    return successResponse(media, 201);
  } catch (error: any) {
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message, 403);
    if (error instanceof NotFoundError) return errorResponse('NOT_FOUND', error.message, 404);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to upload property image' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const { ctx, property } = await authorize(session.user.id, id);
    const body = await req.json();
    const mediaId = typeof body?.mediaId === 'string' ? body.mediaId : '';
    if (!mediaId) return errorResponse('VALIDATION_ERROR', 'The media ID is required', 400);
    const media = await prisma.reachPropertyMedia.findFirst({ where: { id: mediaId, propertyId: property.id, kind: 'PROPERTY' } });
    if (!media) return errorResponse('NOT_FOUND', 'Property image not found', 404);
    const archived = await prisma.reachPropertyMedia.update({ where: { id: media.id }, data: { status: 'ARCHIVED' } });
    await createAuditLog({ organizationId: ctx.organizationId, propertyId: property.id, userId: session.user.id, action: 'UPDATE', resource: 'property_media', resourceId: media.id, previousValue: media, newValue: archived });
    return successResponse(archived);
  } catch (error: any) {
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message, 403);
    if (error instanceof NotFoundError) return errorResponse('NOT_FOUND', error.message, 404);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to remove property image' } }, { status: 500 });
  }
}
