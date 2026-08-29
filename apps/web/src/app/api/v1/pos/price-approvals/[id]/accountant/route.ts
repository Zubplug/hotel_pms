import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

const ACCOUNTANT_ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'MANAGER', 'CEO', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  if (!ACCOUNTANT_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Accountant approval required', 403);
  const { id } = await params;
  const approval = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!approval || approval.type !== 'POS_PRICE_CHANGE') return errorResponse('NOT_FOUND', 'Price request not found', 404);
  if (approval.status !== 'PENDING') return errorResponse('CONFLICT', 'Price request is no longer pending', 409);
  const details = (approval.details || {}) as Record<string, any>;
  if (details.accountantApprovedBy) return errorResponse('CONFLICT', 'Accountant approval already recorded', 409);
  const updated = await prisma.approvalRequest.update({ where: { id }, data: { details: { ...details, stage: 'MANAGER_REVIEW', accountantApprovedBy: user.id, accountantApprovedAt: new Date().toISOString(), accountantNotes: (await req.json().catch(() => ({}))).notes || null } } });
  return successResponse(updated);
}
