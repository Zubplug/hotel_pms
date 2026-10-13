import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const ALLOWED_FIELDS = new Set([
  'phone',
  'personalEmail',
  'residentialAddress',
  'maritalStatus',
  'emergencyContacts',
  'nextOfKin',
  'bankAccountNumber',
  'bankName',
  'bankSortCode',
  'tin',
  'pfaName',
  'rsaPin',
]);

function errorResponse(error: any) {
  const message = String(error?.message || 'Profile change request failed');
  return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
}

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });
    const requests = await prisma.employeeChangeRequest.findMany({ where: { staffId: staff.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json({ requests });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const fieldName = String(body.fieldName || '').trim();
    const proposedValue = typeof body.proposedValue === 'string' ? body.proposedValue.trim() : JSON.stringify(body.proposedValue ?? '');
    if (!ALLOWED_FIELDS.has(fieldName) || !proposedValue) return NextResponse.json({ error: 'A permitted field and proposed value are required' }, { status: 400 });

    const staff = await prisma.staff.findFirst({
      where: { userId: context.userId, organizationId: context.organizationId, isActive: true, deletedAt: null },
      include: { employeeProfile: true, salaryStructure: true },
    });
    if (!staff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });

    const source: Record<string, unknown> = {
      phone: staff.phone,
      personalEmail: staff.email,
      residentialAddress: staff.employeeProfile?.residentialAddress,
      maritalStatus: staff.employeeProfile?.maritalStatus,
      emergencyContacts: staff.employeeProfile?.emergencyContacts,
      nextOfKin: staff.employeeProfile?.nextOfKin,
      bankAccountNumber: staff.salaryStructure?.bankAccountNumber,
      bankName: staff.salaryStructure?.bankName,
      bankSortCode: staff.salaryStructure?.bankSortCode,
      tin: staff.employeeProfile?.tin,
      pfaName: staff.salaryStructure?.pensionFundAdmin,
      rsaPin: staff.salaryStructure?.pensionNumber,
    };

    const currentValue = source[fieldName];
    const serializedCurrent = typeof currentValue === 'string' || currentValue == null ? currentValue : JSON.stringify(currentValue);
    const duplicate = await prisma.employeeChangeRequest.findFirst({ where: { staffId: staff.id, fieldName, status: { in: ['PENDING', 'CLARIFICATION'] } } });
    if (duplicate) return NextResponse.json({ error: 'There is already an open request for this field' }, { status: 409 });

    const request = await prisma.employeeChangeRequest.create({ data: { staffId: staff.id, fieldName, currentValue: serializedCurrent, proposedValue, reason: String(body.reason || '').trim() || null, requestedBy: context.userId } });
    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
