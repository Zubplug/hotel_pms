import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';

const REQUEST_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!REQUEST_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'F&B menu access required', 403);
  const { productId } = await params;
  const body = await req.json();
  const newPrice = Number(body.price);
  if (!Number.isFinite(newPrice) || newPrice < 0) return errorResponse('BAD_REQUEST', 'A valid non-negative selling price is required', 400);
  const product = await prisma.posProduct.findUnique({ where: { id: productId } });
  if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);
  if (!((await requireOrganizationContext(user.id)).propertyIds).includes(product.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
  const requestedProductIds: string[] = Array.isArray(body.productIds) ? [...new Set<string>(body.productIds.map((id: unknown) => String(id)).filter(Boolean))] : [productId];
  if (!requestedProductIds.includes(productId)) requestedProductIds.unshift(productId);
  const products = await prisma.posProduct.findMany({ where: { id: { in: requestedProductIds }, propertyId: product.propertyId }, select: { id: true, name: true, price: true } });
  if (products.length !== requestedProductIds.length) return errorResponse('BAD_REQUEST', 'One or more selected outlet products are invalid', 400);
  const pendingRequests = await prisma.approvalRequest.findMany({ where: { propertyId: product.propertyId, type: 'POS_PRICE_CHANGE', status: 'PENDING' }, select: { details: true } });
  const pending = pendingRequests.find((request) => {
    const details = (request.details || {}) as Record<string, any>;
    const existingIds = Array.isArray(details.productIds) ? details.productIds : details.productId ? [details.productId] : [];
    return existingIds.some((id: string) => requestedProductIds.includes(id));
  });
  if (pending) return errorResponse('CONFLICT', 'This product already has a pending price request', 409);
  const approval = await prisma.approvalRequest.create({ data: {
    propertyId: product.propertyId, type: 'POS_PRICE_CHANGE', status: 'PENDING', requestedBy: user.id,
    amount: newPrice, currency: 'NGN', reason: String(body.reason || 'Selling price change requested by cashier'),
    details: { productId, productIds: requestedProductIds, productName: product.name, oldPrice: Number(product.price), newPrice, stage: 'GENERAL_CASHIER_REVIEW' },
    idempotencyKey: body.idempotencyKey || undefined,
  } });
  return successResponse(approval, 201);
}
