import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const GM_ROLES = new Set(['GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'CEO']);
const SEPARATION_TYPES = new Set(['TERMINATED', 'RESIGNED', 'RETIRED']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');
    const { id: staffId } = await params;
    const body = await req.json();
    const separationType = String(body.separationType || 'TERMINATED').toUpperCase();
    const reason = String(body.reason || '').trim();
    const effectiveDate = new Date(String(body.effectiveDate || ''));

    if (!SEPARATION_TYPES.has(separationType)) return NextResponse.json({ error: 'Invalid separation type' }, { status: 400 });
    if (reason.length < 10) return NextResponse.json({ error: 'A separation reason of at least 10 characters is required' }, { status: 400 });
    if (Number.isNaN(effectiveDate.getTime())) return NextResponse.json({ error: 'A valid effective date is required' }, { status: 400 });

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: authContext.organizationId, propertyAccess: { has: authContext.propertyId }, deletedAt: null },
    });
    if (!staff) return NextResponse.json({ error: 'Employee not found or inaccessible' }, { status: 404 });
    if (!staff.isActive) return NextResponse.json({ error: 'This employee is already inactive' }, { status: 409 });

    const pending = await prisma.employeeSeparationRequest.findFirst({ where: { staffId, status: 'PENDING' } });
    if (pending) return NextResponse.json({ error: 'This employee already has a pending separation request' }, { status: 409 });

    const request = await prisma.employeeSeparationRequest.create({
      data: { staffId, propertyId: authContext.propertyId, requestedById: authContext.userId, separationType, reason, effectiveDate },
    });
    return NextResponse.json({ success: true, data: request }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to create employee separation request:', error);
    return NextResponse.json({ error: 'Failed to submit separation request' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');
    if (!GM_ROLES.has(authContext.role)) return NextResponse.json({ error: 'Only the General Manager can approve separations' }, { status: 403 });

    const { id: requestId } = await params;
    const body = await req.json();
    const action = String(body.action || '').toUpperCase();
    const reviewNotes = String(body.reviewNotes || '').trim() || null;
    if (!['APPROVE', 'REJECT'].includes(action)) return NextResponse.json({ error: 'A valid approval action is required' }, { status: 400 });

    const separation = await prisma.employeeSeparationRequest.findFirst({
      where: { id: requestId, propertyId: authContext.propertyId, status: 'PENDING' },
      include: { staff: true },
    });
    if (!separation) return NextResponse.json({ error: 'Pending separation request not found' }, { status: 404 });
    if (separation.requestedById === authContext.userId) return NextResponse.json({ error: 'The requester cannot approve their own separation request' }, { status: 403 });

    if (action === 'REJECT') {
      const rejected = await prisma.employeeSeparationRequest.update({
        where: { id: separation.id },
        data: { status: 'REJECTED', reviewedById: authContext.userId, reviewedAt: new Date(), reviewNotes },
      });
      return NextResponse.json({ success: true, data: rejected });
    }

    const approved = await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.update({ where: { id: separation.staffId }, data: { isActive: false } });
      await tx.employeeProfile.updateMany({ where: { staffId: separation.staffId }, data: { status: separation.separationType } });
      if (staff.userId) {
        await tx.user.update({ where: { id: staff.userId }, data: { sessionVersion: { increment: 1 } } });
      }
      const request = await tx.employeeSeparationRequest.update({
        where: { id: separation.id },
        data: { status: 'APPROVED', reviewedById: authContext.userId, reviewedAt: new Date(), reviewNotes },
      });
      return { request, staff };
    });
    return NextResponse.json({ success: true, data: approved });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to review employee separation request:', error);
    return NextResponse.json({ error: 'Failed to review separation request' }, { status: 500 });
  }
}
