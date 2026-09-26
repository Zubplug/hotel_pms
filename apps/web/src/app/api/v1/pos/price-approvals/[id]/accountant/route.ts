import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from "@/lib/organization-access";

const ACCOUNTANT_ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!ACCOUNTANT_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Accountant approval required', 403);
  const { id } = await params;
  const approval = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!approval || !['POS_PRICE_CHANGE', 'POS_MENU_CREATE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'].includes(approval.type)) return errorResponse('NOT_FOUND', 'POS approval request not found', 404);
  const context = await requireOrganizationContext(user.id);
  if (!context.propertyIds.includes(approval.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
  if (approval.status !== 'PENDING') return errorResponse('CONFLICT', 'Price request is no longer pending', 409);
  const details = (approval.details || {}) as Record<string, any>;
  if (approval.requestedBy === user.id && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'The requester cannot approve their own price request', 403);
  if (['POS_PRICE_CHANGE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'].includes(approval.type) && details.stage !== 'ACCOUNTANT_REVIEW') return errorResponse('CONFLICT', 'This price request is not awaiting Accountant approval', 409);
  if (details.accountantApprovedBy) return errorResponse('CONFLICT', 'Accountant approval already recorded', 409);
  const updated = await prisma.approvalRequest.update({ where: { id }, data: { details: { ...details, stage: 'MANAGER_REVIEW', accountantApprovedBy: user.id, accountantApprovedAt: new Date().toISOString(), accountantNotes: (await req.json().catch(() => ({}))).notes || null } } });
  return successResponse(updated);
}
