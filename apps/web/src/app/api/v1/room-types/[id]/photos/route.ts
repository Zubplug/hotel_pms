import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { createAuditLog } from '@/lib/audit';
import { errorResponse, successResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { requireOrganizationContext } from '@/lib/organization-access';

type Params = { params: Promise<{ id: string }> };
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function resolveRoomType(id: string, userId: string) {
  const ctx = await requireOrganizationContext(userId);
  const roomType = await prisma.roomType.findUnique({ where: { id } });
  if (!roomType || !ctx.propertyIds.includes(roomType.propertyId)) return { ctx, roomType: null };
  return { ctx, roomType };
}

async function canManageMedia(userId: string, propertyId: string, membershipRole: string) {
  if (['ADMIN', 'SUPER_ADMIN', 'OWNER', 'GENERAL_MANAGER'].includes(membershipRole.toUpperCase())) return true;
  const assigned = await prisma.userRole.findMany({ where: { userId, propertyId }, include: { role: { select: { name: true } } } });
  if (assigned.some(({ role }) => ['ADMIN', 'SUPER_ADMIN', 'GENERAL_MANAGER'].includes(role.name.toUpperCase()))) return true;
  return hasPermission(userId, 'room_type', 'update', propertyId);
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const { ctx, roomType } = await resolveRoomType(id, session.user.id);
    if (!roomType) return errorResponse('NOT_FOUND', 'Room type not found', 404);
    if (!(await canManageMedia(session.user.id, roomType.propertyId, ctx.role))) return errorResponse('FORBIDDEN', 'Only an administrator or general manager can manage room media', 403);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return errorResponse('VALIDATION_ERROR', 'An image file is required', 400);
    if (file.size > MAX_IMAGE_SIZE) return errorResponse('VALIDATION_ERROR', 'Images must be 10 MB or smaller', 400);
    if (!IMAGE_TYPES.has(file.type)) return errorResponse('VALIDATION_ERROR', 'Only JPG, PNG, and WebP images are supported', 400);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `room-types/${roomType.propertyId}/${roomType.id}/${crypto.randomUUID()}-${safeName}`;
    const blob = await put(storageKey, file, { access: 'public', addRandomSuffix: false });
    const photos = Array.from(new Set([...(roomType.photos || []), blob.url]));
    const altText = String(form.get('altText') || `${roomType.name} room`);
    const [updated, media] = await prisma.$transaction([
      prisma.roomType.update({ where: { id: roomType.id }, data: { photos } }),
      prisma.reachPropertyMedia.create({ data: { propertyId: roomType.propertyId, roomTypeId: roomType.id, kind: 'ROOM', url: blob.url, altText, storageKey, mimeType: file.type, status: 'APPROVED', sortOrder: photos.length - 1 } }),
    ]);
    await createAuditLog({ organizationId: ctx.organizationId, propertyId: roomType.propertyId, userId: session.user.id, action: 'UPDATE', resource: 'room_type_media', resourceId: roomType.id, previousValue: { photos: roomType.photos }, newValue: { photos } });
    return successResponse({ roomType: updated, media }, 201);
  } catch (error: any) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to upload room image' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const { ctx, roomType } = await resolveRoomType(id, session.user.id);
    if (!roomType) return errorResponse('NOT_FOUND', 'Room type not found', 404);
    if (!(await canManageMedia(session.user.id, roomType.propertyId, ctx.role))) return errorResponse('FORBIDDEN', 'Only an administrator or general manager can manage room media', 403);
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : '';
    if (!url) return errorResponse('VALIDATION_ERROR', 'The image URL is required', 400);
    const photos = (roomType.photos || []).filter((photo) => photo !== url);
    await prisma.$transaction([
      prisma.roomType.update({ where: { id: roomType.id }, data: { photos } }),
      prisma.reachPropertyMedia.updateMany({ where: { roomTypeId: roomType.id, url }, data: { status: 'ARCHIVED' } }),
    ]);
    await createAuditLog({ organizationId: ctx.organizationId, propertyId: roomType.propertyId, userId: session.user.id, action: 'UPDATE', resource: 'room_type_media', resourceId: roomType.id, previousValue: { photos: roomType.photos }, newValue: { photos } });
    return successResponse({ photos });
  } catch (error: any) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to remove room image' } }, { status: 500 });
  }
}
