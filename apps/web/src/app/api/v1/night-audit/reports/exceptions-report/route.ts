import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const businessDate = new Date(businessDateStr);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    // 1. Voids: Folio items that have been voided
    const voidsData = await prisma.folioItem.findMany({
      where: { folio: { propertyId }, businessDate, voidedAt: { not: null } },
      include: { folio: { include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } } } } }
    });

    // 2. Refunds
    const refundsData = await prisma.refund.findMany({
      where: { propertyId, businessDate, status: 'COMPLETED' },
      include: { folio: { include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } } } } }
    });

    // 3. Discounts: Folio items marked as discount
    const discountsData = await prisma.folioItem.findMany({
      where: { folio: { propertyId }, businessDate, type: 'DISCOUNT', voidedAt: null },
      include: { folio: { include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } } } } }
    });

    // 4. Comps
    const compsData = await prisma.complimentaryRecord.findMany({
      where: { propertyId, businessDate },
      include: {
        operator: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } }
      }
    });

    const discountApprovalIds = discountsData
      .map(item => item.discountApprovalId?.replace(/^PENDING:/, ''))
      .filter((id): id is string => Boolean(id));
    const discountApprovals = discountApprovalIds.length > 0
      ? await prisma.approvalRequest.findMany({
          where: { id: { in: discountApprovalIds }, type: 'DISCOUNT' },
          select: { id: true, details: true, snapshot: true, reviewedBy: true },
        })
      : [];
    const discountApprovalById = new Map(discountApprovals.map(approval => [approval.id, approval]));
    const readAcknowledgedBy = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
      const record = value as Record<string, unknown>;
      return [record.acknowledgedByStaffId, record.acknowledgedBy, record.acknowledgedById]
        .find((id): id is string => typeof id === 'string' && id.length > 0);
    };
    const compAcknowledgedBy = compsData.map(item => {
      try {
        return readAcknowledgedBy(item.notes ? JSON.parse(item.notes) : null)
          || item.approverId
          || item.nightAuditorId;
      } catch {
        return item.approverId || item.nightAuditorId;
      }
    });

    // Exception records store staff IDs rather than a Staff relation. Resolve
    // those IDs in one query so the report shows the actual operator and
    // acknowledgement staff member.
    const operatorIds = Array.from(new Set([
      ...voidsData.map(item => item.voidedBy).filter((id): id is string => Boolean(id)),
      ...refundsData.map(item => item.authorizedBy).filter(Boolean),
      ...discountsData.map(item => item.postedBy).filter(Boolean),
      ...discountApprovals.map(item => item.reviewedBy).filter((id): id is string => Boolean(id)),
      ...discountsData.map(item => {
        const approvalId = item.discountApprovalId?.replace(/^PENDING:/, '');
        const approval = approvalId ? discountApprovalById.get(approvalId) : undefined;
        return readAcknowledgedBy(approval?.details) || readAcknowledgedBy(approval?.snapshot);
      }).filter((id): id is string => Boolean(id)),
      ...compAcknowledgedBy.filter((id): id is string => Boolean(id)),
    ]));
    const staffRecords = operatorIds.length > 0
      ? await prisma.staff.findMany({
          where: {
            OR: [
              { id: { in: operatorIds } },
              { userId: { in: operatorIds } },
            ],
          },
          select: { id: true, userId: true, firstName: true, lastName: true },
        })
      : [];
    const staffNames = new Map<string, string>();
    for (const staff of staffRecords) {
      const name = `${staff.firstName} ${staff.lastName}`.trim();
      staffNames.set(staff.id, name);
      if (staff.userId) staffNames.set(staff.userId, name);
    }
    const operatorName = (id: string | null | undefined, fallback = 'System/Unknown') =>
      (id && staffNames.get(id)) || fallback;

    const formatGuestName = (guest: any) => guest ? `${guest.firstName} ${guest.lastName}` : 'Walk-in';

    const exceptions = {
      voids: voidsData.map(v => ({
        id: v.id,
        timestamp: v.voidedAt,
        folioId: v.folio.folioNumber || v.folio.id.slice(0, 8),
        guestName: formatGuestName(v.folio.guest),
        amount: Number(v.amount),
        reason: v.voidReason || 'No reason provided',
        operator: operatorName(v.voidedBy)
      })),
      refunds: refundsData.map(r => ({
        id: r.id,
        timestamp: r.createdAt,
        folioId: r.folio?.folioNumber || r.folio?.id.slice(0, 8) || 'Standalone refund',
        guestName: r.folio ? formatGuestName(r.folio.guest) : 'Guest credit',
        amount: Number(r.amount),
        reason: r.reason,
        operator: operatorName(r.authorizedBy)
      })),
      discounts: discountsData.map(d => ({
        id: d.id,
        timestamp: d.createdAt,
        folioId: d.folio.folioNumber || d.folio.id.slice(0, 8),
        guestName: formatGuestName(d.folio.guest),
        amount: Number(d.amount),
        reason: d.description,
        operator: operatorName(d.postedBy),
        acknowledgedBy: (() => {
          const approvalId = d.discountApprovalId?.replace(/^PENDING:/, '');
          const approval = approvalId ? discountApprovalById.get(approvalId) : undefined;
          const id = readAcknowledgedBy(approval?.details) || readAcknowledgedBy(approval?.snapshot) || approval?.reviewedBy;
          return operatorName(id, 'Not acknowledged');
        })(),
      })),
      comps: compsData.map(c => ({
        id: c.id,
        timestamp: c.createdAt,
        folioId: c.reference,
        guestName: 'N/A', // Comps might not be guest-linked directly in this query
        amount: Number(c.complAmount),
        reason: c.reason,
        operator: c.operator ? `${c.operator.firstName} ${c.operator.lastName}` : 'System',
        acknowledgedBy: operatorName(compAcknowledgedBy[compsData.indexOf(c)], 'Not acknowledged'),
      }))
    };

    const totals = {
      voids: exceptions.voids.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      refunds: exceptions.refunds.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      discounts: exceptions.discounts.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      comps: exceptions.comps.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      exceptions,
      totals,
      grandTotal: totals.voids + totals.refunds + totals.discounts + totals.comps
    });

  } catch (err: any) {
    console.error('[Exceptions Report GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
