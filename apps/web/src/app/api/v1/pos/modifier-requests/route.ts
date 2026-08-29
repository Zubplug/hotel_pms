import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { getUserPropertyIds } from '@/lib/property-access';

const CASHIER_ROLES = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'];

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!CASHIER_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Modifier access required', 403);
  const items = await prisma.stockItem.findMany({ where: { propertyId: { in: await getUserPropertyIds(user.id) }, isActive: true }, select: { id: true, name: true, baseUnit: true, stockUnits: true }, orderBy: { name: 'asc' }, take: 500 });
  return successResponse(items);
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!CASHIER_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Only cashiers can submit modifier requests', 403);
  const body = await req.json();
  const productId = String(body.productId || '');
  const modifierId = body.modifierId ? String(body.modifierId) : null;
  const name = String(body.name || '').trim();
  const price = Number(body.price ?? 0);
  const quantity = Number(body.quantity ?? 1);
  if (!productId || !name || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) return errorResponse('BAD_REQUEST', 'Product, modifier name, valid price, and quantity are required', 400);
  const product = await prisma.posProduct.findUnique({ where: { id: productId } });
  if (!product) return errorResponse('NOT_FOUND', 'Product not found', 404);
  if (!(await getUserPropertyIds(user.id)).includes(product.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
  const existingModifier = modifierId ? await prisma.posProductModifier.findFirst({ where: { id: modifierId, productId } }) : null;
  if (modifierId && !existingModifier) return errorResponse('NOT_FOUND', 'Modifier not found', 404);
  let stockItem: { id: string; baseUnit: any } | null = null;
  if (body.stockItemId) {
    stockItem = await prisma.stockItem.findFirst({ where: { id: String(body.stockItemId), propertyId: product.propertyId, isActive: true }, select: { id: true, baseUnit: true } });
    if (!stockItem) return errorResponse('BAD_REQUEST', 'Select a valid active stock item', 400);
  }
  const pending = await prisma.approvalRequest.findFirst({ where: { propertyId: product.propertyId, type: { in: ['POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'] }, status: 'PENDING', details: modifierId ? { path: ['modifierId'], equals: modifierId } : { path: ['name'], equals: name } } });
  if (pending) return errorResponse('CONFLICT', 'This product already has a pending modifier request', 409);
  const approval = await prisma.approvalRequest.create({ data: { propertyId: product.propertyId, type: modifierId ? 'POS_MODIFIER_UPDATE' : 'POS_MODIFIER_CREATE', status: 'PENDING', requestedBy: user.id, amount: price, currency: 'NGN', reason: String(body.reason || `${modifierId ? 'Modifier update' : 'New modifier'} requested: ${name}`), details: { stage: 'ACCOUNTANT_REVIEW', productId, productName: product.name, modifierId, name, price, stockItemId: stockItem?.id || null, quantity, unitOfMeasure: body.unitOfMeasure || stockItem?.baseUnit || null } } });
  return successResponse(approval, 201);
}
