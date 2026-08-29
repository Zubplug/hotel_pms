import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { getUserPropertyIds } from '@/lib/property-access';

const CASHIER_ROLES = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'];
const STATIONS = ['KITCHEN', 'BAR', 'DIRECT', 'NONE'];

export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!CASHIER_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Only cashiers can submit menu requests', 403);
  const body = await req.json();
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const taxRate = Number(body.taxRate || 0);
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return errorResponse('BAD_REQUEST', 'Name, valid price, and tax rate are required', 400);
  if (body.productionStation && !STATIONS.includes(body.productionStation)) return errorResponse('BAD_REQUEST', 'Invalid production station', 400);
  const category = await prisma.productCategory.findFirst({ where: { id: body.categoryId, outlet: { propertyId: { in: await getUserPropertyIds(user.id) }, isActive: true }, isActive: true }, include: { outlet: true } });
  if (!category) return errorResponse('BAD_REQUEST', 'Select a valid active category', 400);
  let stockItemId: string | null = null;
  if (body.stockItemId) {
    const stockItem = await prisma.stockItem.findFirst({ where: { id: String(body.stockItemId), propertyId: category.outlet.propertyId, isActive: true, posProductId: null }, select: { id: true } });
    if (!stockItem) return errorResponse('BAD_REQUEST', 'Select an available unlinked stock item', 400);
    stockItemId = stockItem.id;
  }
  const duplicate = await prisma.approvalRequest.findFirst({ where: { propertyId: category.outlet.propertyId, type: 'POS_MENU_CREATE', status: 'PENDING', details: { path: ['name'], equals: name } } });
  if (duplicate) return errorResponse('CONFLICT', 'A menu request with this name is already pending', 409);
  const approval = await prisma.approvalRequest.create({ data: { propertyId: category.outlet.propertyId, type: 'POS_MENU_CREATE', status: 'PENDING', requestedBy: user.id, amount: price, currency: 'NGN', reason: String(body.reason || `New menu item requested: ${name}`), details: { stage: 'ACCOUNTANT_REVIEW', name, categoryId: category.id, categoryName: category.name, price, taxRate, inventoryMode: body.inventoryMode === 'STOCK' ? 'STOCK' : 'NON_STOCK', stockItemId, productionStation: body.productionStation || null } } });
  return successResponse(approval, 201);
}
