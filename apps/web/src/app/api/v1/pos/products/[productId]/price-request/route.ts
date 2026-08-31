import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';

const CASHIER_ROLES = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!CASHIER_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Only cashiers can submit price requests', 403);
  const { productId } = await params;
  const body = await req.json();
  const newPrice = Number(body.price);
  if (!Number.isFinite(newPrice) || newPrice < 0) return errorResponse('BAD_REQUEST', 'A valid non-negative selling price is required', 400);
  const product = await prisma.posProduct.findUnique({ where: { id: productId } });
  if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);
  if (!((await requireOrganizationContext(user.id)).propertyIds).includes(product.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
  const pending = await prisma.approvalRequest.findFirst({ where: { propertyId: product.propertyId, type: 'POS_PRICE_CHANGE', status: 'PENDING', details: { path: ['productId'], equals: productId } } });
  if (pending) return errorResponse('CONFLICT', 'This product already has a pending price request', 409);
  const approval = await prisma.approvalRequest.create({ data: {
    propertyId: product.propertyId, type: 'POS_PRICE_CHANGE', status: 'PENDING', requestedBy: user.id,
    amount: newPrice, currency: 'NGN', reason: String(body.reason || 'Selling price change requested by cashier'),
    details: { productId, productName: product.name, oldPrice: Number(product.price), newPrice, stage: 'ACCOUNTANT_REVIEW' },
    idempotencyKey: body.idempotencyKey || undefined,
  } });
  return successResponse(approval, 201);
}
