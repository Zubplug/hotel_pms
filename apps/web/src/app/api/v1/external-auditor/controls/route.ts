import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const name = (person?: { firstName: string; lastName: string } | null) => person ? `${person.firstName} ${person.lastName}`.trim() : null;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isExternalAuditor(session)) return NextResponse.json({ error: 'External auditor access required' }, { status: 403 });

  const propertyId = request.nextUrl.searchParams.get('propertyId');
  const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';
  const kind = request.nextUrl.searchParams.get('kind') || 'all';
  const format = request.nextUrl.searchParams.get('format') || 'json';
  const dateFrom = request.nextUrl.searchParams.get('dateFrom');
  const dateTo = request.nextUrl.searchParams.get('dateTo');
  const minAmountStr = request.nextUrl.searchParams.get('minAmount');
  const maxAmountStr = request.nextUrl.searchParams.get('maxAmount');
  const minAmount = minAmountStr ? Number(minAmountStr) : NaN;
  const maxAmount = maxAmountStr ? Number(maxAmountStr) : NaN;
  const sourceFilter = request.nextUrl.searchParams.get('source')?.trim().toLowerCase() || '';
  const statusFilter = request.nextUrl.searchParams.get('status')?.trim().toLowerCase() || '';
  const operatorFilter = request.nextUrl.searchParams.get('operator')?.trim().toLowerCase() || '';
  const approverFilter = request.nextUrl.searchParams.get('approver')?.trim().toLowerCase() || '';
  const beneficiaryFilter = request.nextUrl.searchParams.get('beneficiary')?.trim().toLowerCase() || '';
  if (!propertyId) return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
  if (!['all', 'discounts', 'complimentary'].includes(kind)) return NextResponse.json({ error: 'Unsupported control type' }, { status: 400 });

  try {
    const scope = await getExternalAuditorScope(session.user.id, propertyId);
    const start = new Date(scope.auditPeriodStart);
    const end = new Date(scope.auditPeriodEnd);
    end.setUTCDate(end.getUTCDate() + 1);
    const requestedStart = dateFrom && !Number.isNaN(new Date(`${dateFrom}T00:00:00.000Z`).getTime()) ? new Date(`${dateFrom}T00:00:00.000Z`) : start;
    const requestedEnd = dateTo && !Number.isNaN(new Date(`${dateTo}T00:00:00.000Z`).getTime()) ? new Date(`${dateTo}T00:00:00.000Z`) : end;
    const date = { gte: requestedStart > start ? requestedStart : start, lt: requestedEnd < end ? new Date(requestedEnd.getTime() + 86400000) : end };

    const [discountItems, complimentaryRecords, complimentaryFolioItems, posComplimentary, fdComplimentary] = await Promise.all([
      kind === 'complimentary' ? Promise.resolve([]) : prisma.folioItem.findMany({
        where: { folio: { propertyId }, businessDate: date, type: 'DISCOUNT' },
        include: { folio: { select: { folioNumber: true, guest: { select: { firstName: true, lastName: true } } } } },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }], take: 1000,
      }),
      kind === 'discounts' ? Promise.resolve([]) : prisma.complimentaryRecord.findMany({
        where: { propertyId, businessDate: date },
        include: {
          operator: { select: { firstName: true, lastName: true } },
          approver: { select: { firstName: true, lastName: true } },
          nightAuditor: { select: { firstName: true, lastName: true } },
          staff: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }], take: 1000,
      }),
      kind === 'discounts' ? Promise.resolve([]) : prisma.folioItem.findMany({
        where: { folio: { propertyId }, businessDate: date, type: 'COMPLIMENTARY' },
        include: { folio: { select: { folioNumber: true, guest: { select: { firstName: true, lastName: true } } } } },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }], take: 1000,
      }),
      kind === 'discounts' ? Promise.resolve([]) : prisma.posPayment.findMany({
        where: { method: 'COMPLIMENTARY', order: { propertyId, businessDate: date } },
        include: { order: { select: { orderNumber: true, serverStaff: { select: { firstName: true, lastName: true } } } } },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }], take: 1000,
      }),
      kind === 'discounts' ? Promise.resolve([]) : prisma.reservationRoom.findMany({
        where: { discountType: 'COMPLIMENTARY', reservation: { propertyId }, checkIn: date },
        include: { reservation: { select: { confirmationNumber: true, primaryGuest: { select: { firstName: true, lastName: true } } } } },
        orderBy: [{ checkIn: 'desc' }, { createdAt: 'desc' }], take: 1000,
      }),
    ]);

    const approvalIds = discountItems.map(item => item.discountApprovalId?.replace(/^PENDING:/, '')).filter((id): id is string => Boolean(id));
    const approvals = approvalIds.length ? await prisma.approvalRequest.findMany({ where: { id: { in: approvalIds }, propertyId, type: 'DISCOUNT' }, select: { id: true, status: true, executionStatus: true, requestedBy: true, requestedAt: true, reviewedBy: true, reviewedAt: true, amount: true, currency: true, reason: true, details: true, snapshot: true } }) : [];
    const approvalById = new Map(approvals.map(item => [item.id, item]));

    const staffIds = Array.from(new Set([
      ...discountItems.map(item => item.postedBy),
      ...complimentaryFolioItems.map(item => item.postedBy),
      ...posComplimentary.map(item => item.processedById).filter((id): id is string => Boolean(id)),
      ...approvals.flatMap(item => [item.requestedBy, item.reviewedBy]).filter((id): id is string => Boolean(id)),
    ]));
    const staff = staffIds.length ? await prisma.staff.findMany({ where: { OR: [{ id: { in: staffIds } }, { userId: { in: staffIds } }] }, select: { id: true, userId: true, firstName: true, lastName: true } }) : [];
    const staffById = new Map<string, string>();
    for (const person of staff) { const value = name(person) || 'Unknown'; staffById.set(person.id, value); if (person.userId) staffById.set(person.userId, value); }
    const display = (id?: string | null) => id ? staffById.get(id) || id : 'Not recorded';
    const matches = (values: unknown[]) => !query || values.some(value => String(value ?? '').toLowerCase().includes(query));
    const passesFilters = (item: { amount: number; source: string; status: string; operator: string | null; approver: string; beneficiary: string }) =>
      (!Number.isFinite(minAmount) || Math.abs(item.amount) >= minAmount) &&
      (!Number.isFinite(maxAmount) || Math.abs(item.amount) <= maxAmount) &&
      (!sourceFilter || item.source.toLowerCase().includes(sourceFilter)) &&
      (!statusFilter || item.status.toLowerCase().includes(statusFilter)) &&
      (!operatorFilter || String(item.operator || '').toLowerCase().includes(operatorFilter)) &&
      (!approverFilter || item.approver.toLowerCase().includes(approverFilter)) &&
      (!beneficiaryFilter || item.beneficiary.toLowerCase().includes(beneficiaryFilter));

    const discounts = discountItems.map(item => {
      const approvalId = item.discountApprovalId?.replace(/^PENDING:/, '');
      const approval = approvalId ? approvalById.get(approvalId) : undefined;
      return {
        id: item.id, kind: 'DISCOUNT', businessDate: item.businessDate, createdAt: item.createdAt, folioId: item.folioId, operationId: item.operationId,
        reference: item.folio.folioNumber || item.folioId, guestName: name(item.folio.guest) || 'Walk-in',
        amount: Number(item.amount), currency: item.currency, description: item.description,
        reason: approval?.reason || item.description, source: item.source, status: item.voidedAt ? 'VOIDED' : approval?.status || 'APPLIED',
        operator: display(item.postedBy), approver: display(approval?.reviewedBy), requestedBy: display(approval?.requestedBy),
        beneficiary: 'Not applicable',
        requestedAt: approval?.requestedAt || null, reviewedAt: approval?.reviewedAt || null,
        approvalStatus: approval?.status || 'NOT_LINKED', executionStatus: approval?.executionStatus || null, approvalId: approval?.id || null,
      };
    }).filter(item => matches([item.reference, item.guestName, item.description, item.reason, item.operator, item.approver, item.beneficiary, item.status]) && passesFilters(item));

    const guestIds = complimentaryRecords.map(item => item.guestId).filter((id): id is string => Boolean(id));
    const [guests, compFolios, compOrders] = await Promise.all([
      guestIds.length ? prisma.guest.findMany({ where: { id: { in: guestIds } }, select: { id: true, firstName: true, lastName: true } }) : Promise.resolve([]),
      complimentaryRecords.map(item => item.folioItemId).filter((id): id is string => Boolean(id)).length ? prisma.folioItem.findMany({ where: { id: { in: complimentaryRecords.map(item => item.folioItemId).filter((id): id is string => Boolean(id)) } }, select: { id: true, folio: { select: { folioNumber: true } } } }) : Promise.resolve([]),
      complimentaryRecords.map(item => item.posOrderId).filter((id): id is string => Boolean(id)).length ? prisma.posOrder.findMany({ where: { id: { in: complimentaryRecords.map(item => item.posOrderId).filter((id): id is string => Boolean(id)) } }, select: { id: true, orderNumber: true } }) : Promise.resolve([]),
    ]);
    const guestById = new Map(guests.map(item => [item.id, `${item.firstName} ${item.lastName}`.trim()]));
    const folioByItemId = new Map(compFolios.map(item => [item.id, item.folio.folioNumber]));
    const orderById = new Map(compOrders.map(item => [item.id, item.orderNumber]));
    const verifiedComplimentaryFolioItemIds = new Set(complimentaryRecords.map(item => item.folioItemId).filter((id): id is string => Boolean(id)));
    const comps = [
      ...complimentaryRecords.map(item => ({
      id: item.id, kind: 'COMPLIMENTARY', businessDate: item.businessDate, createdAt: item.createdAt, folioId: item.folioItemId, operationId: item.operationId,
      reference: item.reference, folioReference: item.folioItemId ? folioByItemId.get(item.folioItemId) || null : item.posOrderId ? orderById.get(item.posOrderId) || null : null, guestName: item.guestId ? guestById.get(item.guestId) || 'Guest record' : 'Walk-in', amount: Number(item.complAmount), currency: scope.currency,
      description: item.complType, reason: item.reason, source: item.sourceModule, status: item.status,
      operator: name(item.operator), approver: name(item.approver) || 'Not recorded', requestedBy: name(item.operator),
      requestedAt: item.createdAt, reviewedAt: item.verifiedAt, approvalStatus: item.status, executionStatus: null,
      approvalId: null, beneficiary: name(item.staff) || 'No beneficiary recorded', nightAuditor: name(item.nightAuditor) || 'Not recorded', notes: item.notes,
      })),
      ...complimentaryFolioItems.filter(item => !verifiedComplimentaryFolioItemIds.has(item.id)).map(item => ({
        id: item.id, kind: 'COMPLIMENTARY', businessDate: item.businessDate, createdAt: item.createdAt, folioId: item.folioId, operationId: item.operationId,
        reference: item.folio.folioNumber || item.folioId, folioReference: item.folio.folioNumber || null, guestName: name(item.folio.guest) || 'Walk-in', amount: Number(item.amount), currency: item.currency,
        description: item.description, reason: item.description, source: item.source, status: item.voidedAt ? 'VOIDED' : 'POSTED',
        operator: display(item.postedBy), approver: 'Not recorded', requestedBy: display(item.postedBy),
        beneficiary: 'No beneficiary recorded',
        requestedAt: item.createdAt, reviewedAt: null, approvalStatus: 'NOT_LINKED', executionStatus: null,
        approvalId: null, nightAuditor: 'Not recorded', notes: item.voidReason,
      })),
      ...posComplimentary.map(item => ({
        id: item.id, kind: 'COMPLIMENTARY', businessDate: item.businessDate, createdAt: item.createdAt, folioId: null, operationId: item.operationId,
        reference: item.order.orderNumber || item.orderId, folioReference: null, guestName: 'POS Guest', amount: Number(item.amount), currency: item.currency,
        description: 'POS Complimentary', reason: 'Restaurant POS complimentary payment', source: 'POS', status: item.status,
        operator: display(item.processedById), approver: 'Not recorded', requestedBy: display(item.processedById),
        beneficiary: name(item.order.serverStaff) || 'No beneficiary recorded',
        requestedAt: item.createdAt, reviewedAt: null, approvalStatus: 'NOT_LINKED', executionStatus: null,
        approvalId: null, nightAuditor: 'Not recorded', notes: null,
      })),
      ...fdComplimentary.map(item => ({
        id: item.id, kind: 'COMPLIMENTARY', businessDate: item.checkIn, createdAt: item.createdAt, folioId: null, operationId: null,
        reference: item.reservation.confirmationNumber || item.reservationId, folioReference: null, guestName: name(item.reservation.primaryGuest) || 'Frontdesk Guest', amount: Number(item.discountAmount || 0), currency: item.currency,
        description: 'Frontdesk Complimentary', reason: item.discountReason || 'Complimentary stay', source: 'FRONTDESK', status: item.status,
        operator: 'Not recorded', approver: 'Not recorded', requestedBy: 'Not recorded',
        beneficiary: 'No beneficiary recorded',
        requestedAt: item.createdAt, reviewedAt: null, approvalStatus: 'NOT_LINKED', executionStatus: null,
        approvalId: null, nightAuditor: 'Not recorded', notes: null,
      })),
    ].filter(item => matches([item.reference, item.folioReference, item.guestName, item.description, item.reason, item.operator, item.approver, item.beneficiary, item.status]) && passesFilters(item));

    const items = [...discounts, ...comps].sort((a, b) => new Date(b.businessDate).getTime() - new Date(a.businessDate).getTime());
    const itemIds = items.map(item => item.id);
    const folioIds = items.map(item => item.folioId).filter((id): id is string => Boolean(id));
    const operationIds = items.map(item => item.operationId).filter((id): id is string => Boolean(id));
    const [financialLogs, auditLogs] = await Promise.all([
      itemIds.length || folioIds.length || operationIds.length ? prisma.financialAuditLog.findMany({ where: { propertyId, OR: [{ transactionId: { in: itemIds } }, { folioId: { in: folioIds } }, { operationId: { in: operationIds } }] }, select: { id: true, transactionId: true, folioId: true, operationId: true, operationType: true, amount: true, currency: true, reason: true, approvalStatus: true, approverId: true, approvedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } }) : Promise.resolve([]),
      itemIds.length ? prisma.auditLog.findMany({ where: { propertyId, resourceId: { in: itemIds } }, select: { id: true, resourceId: true, action: true, userEmail: true, userRole: true, requestId: true, createdAt: true }, orderBy: { createdAt: 'asc' } }) : Promise.resolve([]),
    ]);
    const withLineage = items.map(item => ({ ...item, lineage: { financialLogs: financialLogs.filter(log => log.transactionId === item.id || log.folioId === item.folioId || log.operationId === item.operationId), auditLogs: auditLogs.filter(log => log.resourceId === item.id) } }));
    const totals = { discounts: discounts.reduce((sum, item) => sum + Math.abs(item.amount), 0), complimentary: comps.reduce((sum, item) => sum + Math.abs(item.amount), 0), discountCount: discounts.length, complimentaryCount: comps.length };
    const summarize = (key: 'beneficiary' | 'source' | 'status') => Object.values(items.reduce<Record<string, { label: string; count: number; amount: number }>>((result, item) => {
      const label = String(item[key] || 'Not recorded');
      result[label] = result[label] || { label, count: 0, amount: 0 };
      result[label].count += 1;
      result[label].amount += Math.abs(item.amount);
      return result;
    }, {})).sort((a, b) => b.amount - a.amount);
    const byDate = Object.values(items.reduce<Record<string, { date: string; count: number; amount: number }>>((result, item) => {
      const dateKey = item.businessDate.toISOString().slice(0, 10);
      result[dateKey] = result[dateKey] || { date: dateKey, count: 0, amount: 0 };
      result[dateKey].count += 1;
      result[dateKey].amount += Math.abs(item.amount);
      return result;
    }, {})).sort((a, b) => a.date.localeCompare(b.date));
    const analytics = { byBeneficiary: summarize('beneficiary').filter(item => item.label !== 'Not applicable'), bySource: summarize('source'), byStatus: summarize('status'), byDate };
    if (format === 'csv') {
      const headers = ['Type', 'Business date', 'Reference', 'Guest', 'Beneficiary', 'Amount', 'Currency', 'Source', 'Status', 'Reason', 'Operator', 'Approver', 'Approval status', 'Requested at', 'Reviewed at'];
      const rows = withLineage.map(item => [item.kind, item.businessDate.toISOString().slice(0, 10), item.reference, item.guestName, item.beneficiary, item.amount, item.currency, item.source, item.status, item.reason, item.operator, item.approver, item.approvalStatus, item.requestedAt, item.reviewedAt]);
      const body = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
      return new NextResponse(`\ufeff${body}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="auditor-revenue-controls.csv"', 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ scope, items: withLineage, totals, analytics }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('403')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor controls failed', error);
    return NextResponse.json({ error: 'Unable to load revenue controls' }, { status: 500 });
  }
}
