import { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';

const IMAGE_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!IMAGE_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'F&B menu access required', 403);
  const ctx = await requireOrganizationContext(user.id);
  const form = await req.formData();
  const propertyId = String(form.get('propertyId') || '');
  if (!propertyId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return errorResponse('VALIDATION_ERROR', 'An image file is required', 400);
  if (file.size > MAX_IMAGE_SIZE) return errorResponse('VALIDATION_ERROR', 'Images must be 10 MB or smaller', 400);
  if (!IMAGE_TYPES.has(file.type)) return errorResponse('VALIDATION_ERROR', 'Only JPG, PNG, and WebP images are supported', 400);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(`pos-menu/${propertyId}/${crypto.randomUUID()}-${safeName}`, file, { access: 'public', addRandomSuffix: false });
  return successResponse({ url: blob.url }, 201);
}
