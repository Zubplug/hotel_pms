import { NextRequest } from 'next/server';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (user.role !== 'GENERAL_CASHIER' && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'General Cashier approval required', 403);
  const approval = await prisma.approvalRequest.findUnique({ where: { id: (await params).id } });
  if (!approval || !['POS_PRICE_CHANGE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'].includes(approval.type)) return errorResponse('NOT_FOUND', 'Price approval not found', 404);
  const ctx = await requireOrganizationContext(user.id);
  if (!ctx.propertyIds.includes(approval.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
  const details = (approval.details || {}) as Record<string, any>;
  if (approval.requestedBy === user.id) return errorResponse('FORBIDDEN', 'The requester cannot provide the General Cashier approval', 403);
  if (approval.status !== 'PENDING' || details.stage !== 'GENERAL_CASHIER_REVIEW') return errorResponse('CONFLICT', 'This request is not awaiting General Cashier approval', 409);
  const updated = await prisma.approvalRequest.update({ where: { id: approval.id }, data: { details: { ...details, stage: 'ACCOUNTANT_REVIEW', cashierApprovedBy: user.id, cashierApprovedAt: new Date().toISOString(), cashierNotes: (await req.json().catch(() => ({}))).notes || null } } });
  return successResponse(updated);
}
