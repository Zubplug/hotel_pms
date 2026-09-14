import { NextRequest } from 'next/server';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';

const EDIT_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!EDIT_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'F&B management access required', 403);
  const { productId } = await params;
  const product = await prisma.posProduct.findUnique({ where: { id: productId } });
  if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);
  const ctx = await requireOrganizationContext(user.id);
  if (!ctx.propertyIds.includes(product.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
  const body = await req.json();
  if (body.price !== undefined) return errorResponse('PRICE_APPROVAL_REQUIRED', 'Selling-price changes must use the three-step approval workflow', 409);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.taxRate !== undefined && Number.isFinite(Number(body.taxRate)) && Number(body.taxRate) >= 0 && Number(body.taxRate) <= 100) data.taxRate = Number(body.taxRate);
  if (body.inventoryMode !== undefined && ['NON_STOCK', 'STOCK', 'PREPARED_RECIPE'].includes(String(body.inventoryMode))) data.inventoryMode = String(body.inventoryMode);
  if (body.categoryId !== undefined) {
    const category = await prisma.productCategory.findFirst({ where: { id: String(body.categoryId), outlet: { propertyId: product.propertyId, isActive: true }, isActive: true } });
    if (!category) return errorResponse('BAD_REQUEST', 'Invalid category for this property', 400);
    data.categoryId = category.id;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (!Object.keys(data).length) return errorResponse('BAD_REQUEST', 'No editable fields supplied', 400);
  data.updatedBy = user.id;
  const updated = await prisma.posProduct.update({ where: { id: productId }, data });
  return successResponse(updated);
}
