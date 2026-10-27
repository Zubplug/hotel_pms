import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isExternalAuditor(session)) return NextResponse.json({ error: 'External auditor access required' }, { status: 403 });
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (!propertyId) return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
  try {
    const scope = await getExternalAuditorScope(session.user.id, propertyId);
    const start = new Date(scope.auditPeriodStart);
    const end = new Date(scope.auditPeriodEnd);
    end.setUTCDate(end.getUTCDate() + 1);
    const text = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);
    const detailId = request.nextUrl.searchParams.get('id');
    const detailSource = request.nextUrl.searchParams.get('source');
    const resolveActors = async (ids: string[], emails: Array<string | null | undefined> = []) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      const uniqueEmails = Array.from(new Set(emails.filter((email): email is string => Boolean(email))));
      if (!uniqueIds.length && !uniqueEmails.length) return new Map<string, string>();
      const [staff, users] = await Promise.all([
        prisma.staff.findMany({ where: { OR: [{ id: { in: uniqueIds } }, { userId: { in: uniqueIds } }, { email: { in: uniqueEmails } }] }, select: { id: true, userId: true, email: true, firstName: true, lastName: true } }),
        prisma.user.findMany({ where: { OR: [{ id: { in: uniqueIds } }, { email: { in: uniqueEmails } }] }, select: { id: true, staffId: true, firstName: true, lastName: true, email: true } }),
      ]);
      const names = new Map<string, string>();
      const staffNames = new Map<string, string>();
      for (const person of staff) {
        const value = `${person.firstName} ${person.lastName}`.trim() || 'Unknown staff';
        staffNames.set(person.id, value);
        staffNames.set(person.email.toLowerCase(), value);
        names.set(person.id, value);
        if (person.userId) names.set(person.userId, value);
      }
      for (const user of users) {
        const value = names.get(user.id) || staffNames.get(user.staffId || '') || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown user';
        names.set(user.id, value);
        names.set(user.email.toLowerCase(), value);
      }
      return names;
    };
    if (detailId && detailSource === 'FOLIO') {
      const item = await prisma.folioItem.findFirst({ where: { id: detailId, folio: { propertyId }, businessDate: { gte: start, lt: end } }, include: { folio: { select: { folioNumber: true, propertyId: true } } } });
      if (!item) return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
      const [auditLogs, financialLogs, journalLines] = await Promise.all([
        prisma.auditLog.findMany({ where: { propertyId, OR: [{ resourceId: detailId }, ...(item.operationId ? [{ requestId: item.operationId }] : [])] }, orderBy: { createdAt: 'asc' } }),
        prisma.financialAuditLog.findMany({ where: { propertyId, OR: [{ transactionId: detailId }, { folioId: item.folioId }], businessDate: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } }),
        prisma.journalEntryLine.findMany({ where: { sourceId: detailId, entry: { propertyId, entryDate: { gte: start, lt: end } } }, select: { id: true, debit: true, credit: true, description: true, sourceType: true, account: { select: { code: true, name: true, type: true } }, entry: { select: { entryNumber: true, entryDate: true, status: true, source: true } } }, orderBy: { entry: { entryDate: 'asc' } } }),
      ]);
      const actorNames = await resolveActors([item.postedBy, ...auditLogs.map(log => log.userId || '')], auditLogs.flatMap(log => [log.userEmail]));
      const resolvedAuditLogs = auditLogs.map(log => ({ ...log, actor: actorNames.get(log.userId || '') || actorNames.get(log.userEmail?.toLowerCase() || '') || log.userEmail || log.userRole || 'System' }));
      return NextResponse.json({ scope, evidence: { item: { ...item, actor: actorNames.get(item.postedBy) || 'Unknown actor' }, auditLogs: resolvedAuditLogs, financialLogs, journalLines } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const [items, journals, logs] = await Promise.all([
      prisma.folioItem.findMany({ where: { folio: { propertyId }, businessDate: { gte: start, lt: end }, ...(q ? { OR: [{ description: text }, { type: text }, ...(isUuid ? [{ id: q }] : [])] } : {}) }, select: { id: true, businessDate: true, type: true, amount: true, currency: true, description: true, postedBy: true, voidedAt: true, isLatePosting: true }, orderBy: { businessDate: 'desc' }, take: 500 }),
      prisma.journalEntry.findMany({ where: { propertyId, entryDate: { gte: start, lt: end }, ...(q ? { OR: [{ description: text }, { entryNumber: q }] } : {}) }, select: { id: true, entryNumber: true, entryDate: true, description: true, totalDebit: true, totalCredit: true, source: true, status: true }, orderBy: { entryDate: 'desc' }, take: 500 }),
        prisma.auditLog.findMany({ where: { propertyId, createdAt: { gte: start, lt: end }, ...(q ? { OR: [{ action: text }, { resource: text }, { resourceId: text }] } : {}) }, select: { id: true, createdAt: true, action: true, resource: true, resourceId: true, userId: true, userEmail: true, userRole: true, requestId: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
      ]);
    const actorNames = await resolveActors([...items.map(item => item.postedBy), ...logs.map(item => item.userId || '')], logs.map(item => item.userEmail));
    return NextResponse.json({ scope, items: [
      ...items.map(item => ({ id: item.id, date: item.businessDate, type: item.type, amount: Number(item.amount), currency: item.currency, description: item.description, actor: actorNames.get(item.postedBy) || 'Unknown actor', status: item.voidedAt ? 'VOIDED' : item.isLatePosting ? 'LATE_POSTING' : 'POSTED', source: 'FOLIO' })),
      ...journals.map(item => ({ id: item.id, reference: item.entryNumber, date: item.entryDate, type: 'JOURNAL', amount: Number(item.totalDebit), currency: scope.currency, description: item.description, actor: item.source, status: item.status, source: 'GENERAL_LEDGER' })),
      ...logs.map(item => ({ id: item.id, reference: item.resourceId, date: item.createdAt, type: item.action, amount: null, currency: scope.currency, description: item.resource, actor: actorNames.get(item.userId || '') || actorNames.get(item.userEmail?.toLowerCase() || '') || item.userEmail || item.userRole || 'SYSTEM', status: 'AUDIT_LOG', source: 'AUDIT_LOG', requestId: item.requestId })),
    ] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('403')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor evidence failed', error);
    return NextResponse.json({ error: 'Unable to load evidence' }, { status: 500 });
  }
}
