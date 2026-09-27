import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScopes, isExternalAuditor } from '@/lib/auth/auditor-utils';
import { createHash, randomUUID } from 'crypto';

/* The auth session is augmented at runtime by NextAuth and is intentionally
 * kept compatible with the existing auth boundary used throughout this app. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO']);
const roleOf = (session: any) => String(session?.user?.role || '').toUpperCase();
const isAdmin = (session: any) => Boolean(session?.user?.isSuperAdmin || session?.user?.isLodgeCoreAdmin || ADMIN_ROLES.has(roleOf(session)));

async function context(session: any) {
  const external = isExternalAuditor(session);
  const scopes = external ? await getExternalAuditorScopes(session.user.id) : [];
  const organizationId = String(session.user.organizationId || scopes[0]?.organizationId || '');
  if (!external && !isAdmin(session)) throw new Error('403');
  return { external, scopes, organizationId };
}

function scopedProperty(contextValue: Awaited<ReturnType<typeof context>>, propertyId: string | null) {
  if (contextValue.external) {
    const allowed = contextValue.scopes.map(scope => scope.propertyId);
    if (!propertyId || !allowed.includes(propertyId)) throw new Error('403');
    return propertyId;
  }
  return propertyId;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const ctx = await context(session);
    const resource = request.nextUrl.searchParams.get('resource') || 'overview';
    const propertyId = scopedProperty(ctx, request.nextUrl.searchParams.get('propertyId'));
    const engagementId = request.nextUrl.searchParams.get('engagementId');
    const propertyFilter = propertyId ? { propertyId } : {};
    const organizationFilter = ctx.organizationId ? { organizationId: ctx.organizationId } : {};
    const engagementFilter = engagementId ? { engagementId } : {};
    if (resource === 'engagements') return NextResponse.json({ items: await prisma.auditEngagement.findMany({ where: { ...organizationFilter, ...propertyFilter }, orderBy: { updatedAt: 'desc' }, take: 100 }) });
    if (resource === 'requests') return NextResponse.json({ items: await prisma.auditEvidenceRequest.findMany({ where: { ...organizationFilter, ...propertyFilter, ...engagementFilter }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], take: 250 }) });
    if (resource === 'workpapers') return NextResponse.json({ items: await prisma.auditWorkpaper.findMany({ where: { ...organizationFilter, ...propertyFilter, ...engagementFilter }, orderBy: { updatedAt: 'desc' }, take: 250 }) });
    if (resource === 'findings') return NextResponse.json({ items: await prisma.auditFinding.findMany({ where: { ...organizationFilter, ...propertyFilter, ...engagementFilter }, orderBy: [{ status: 'asc' }, { severity: 'asc' }, { dueDate: 'asc' }], take: 250 }) });
    if (resource === 'action-plans') return NextResponse.json({ items: await prisma.auditActionPlan.findMany({ where: { ...organizationFilter, ...propertyFilter, ...engagementFilter }, orderBy: { dueDate: 'asc' }, take: 250 }) });
    if (resource === 'final-packs') return NextResponse.json({ items: await prisma.auditFinalPack.findMany({ where: { ...organizationFilter, ...propertyFilter, ...engagementFilter }, orderBy: { createdAt: 'desc' }, take: 50 }) });
    const [engagements, requests, workpapers, findings, actionPlans] = await Promise.all([
      prisma.auditEngagement.count({ where: { ...organizationFilter, ...propertyFilter } }),
      prisma.auditEvidenceRequest.count({ where: { ...organizationFilter, ...propertyFilter, status: { not: 'CLOSED' } } }),
      prisma.auditWorkpaper.count({ where: { ...organizationFilter, ...propertyFilter, status: { not: 'LOCKED' } } }),
      prisma.auditFinding.count({ where: { ...organizationFilter, ...propertyFilter, status: { not: 'CLOSED' } } }),
      prisma.auditActionPlan.count({ where: { ...organizationFilter, ...propertyFilter, status: { not: 'CLOSED' } } }),
    ]);
    return NextResponse.json({ counts: { engagements, requests, workpapers, findings, actionPlans }, scopes: ctx.scopes });
  } catch (error) {
    if (error instanceof Error && error.message === '403') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor management read failed', error);
    return NextResponse.json({ error: 'Unable to load audit management data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const ctx = await context(session);
    const body = await request.json();
    const resource = String(body.resource || '');
    const propertyId = scopedProperty(ctx, String(body.propertyId || ''));
    const organizationId = String(body.organizationId || ctx.organizationId || ctx.scopes.find(scope => scope.propertyId === propertyId)?.organizationId || '');
    const engagementId = String(body.engagementId || '');
    if (!propertyId || !organizationId) throw new Error('Invalid audit scope');
    let value: unknown;
    if (resource === 'engagement') {
      if (!isAdmin(session)) throw new Error('403');
      value = await prisma.auditEngagement.create({ data: { organizationId, propertyId, leadAuditorId: String(body.leadAuditorId || session.user.id), createdById: session.user.id, name: String(body.name), auditType: String(body.auditType || 'Financial and operational'), objective: body.objective ? String(body.objective) : null, scope: body.scope ? String(body.scope) : null, exclusions: body.exclusions ? String(body.exclusions) : null, risks: body.risks || null, financialAreas: body.financialAreas || null, managementContacts: body.managementContacts || null, milestones: body.milestones || null, materiality: body.materiality == null ? null : Number(body.materiality), currency: body.currency ? String(body.currency) : null, auditPeriodStart: new Date(body.auditPeriodStart), auditPeriodEnd: new Date(body.auditPeriodEnd), plannedStartAt: body.plannedStartAt ? new Date(body.plannedStartAt) : null, plannedEndAt: body.plannedEndAt ? new Date(body.plannedEndAt) : null } });
    } else if (resource === 'request') {
      value = await prisma.auditEvidenceRequest.create({ data: { organizationId, propertyId, engagementId, requesterId: session.user.id, title: String(body.title), description: String(body.description), category: String(body.category || 'GENERAL'), priority: String(body.priority || 'MEDIUM'), ownerId: body.ownerId ? String(body.ownerId) : null, dueDate: body.dueDate ? new Date(body.dueDate) : null } });
    } else if (resource === 'workpaper') {
      value = await prisma.auditWorkpaper.create({ data: { organizationId, propertyId, engagementId, preparedById: session.user.id, reference: String(body.reference), title: String(body.title), controlArea: String(body.controlArea), objective: body.objective ? String(body.objective) : null, procedure: body.procedure ? String(body.procedure) : null, population: body.population ? String(body.population) : null, sampleSize: body.sampleSize == null ? null : Number(body.sampleSize), sampleSelection: body.sampleSelection ? String(body.sampleSelection) : null, expectedResult: body.expectedResult ? String(body.expectedResult) : null, actualResult: body.actualResult ? String(body.actualResult) : null, result: body.result ? String(body.result) : null } });
    } else if (resource === 'finding') {
      value = await prisma.auditFinding.create({ data: { organizationId, propertyId, engagementId, createdById: session.user.id, reference: String(body.reference), title: String(body.title), description: String(body.description), criteria: body.criteria ? String(body.criteria) : null, condition: body.condition ? String(body.condition) : null, rootCause: body.rootCause ? String(body.rootCause) : null, riskImpact: body.riskImpact ? String(body.riskImpact) : null, recommendation: body.recommendation ? String(body.recommendation) : null, controlArea: body.controlArea ? String(body.controlArea) : null, financialImpact: body.financialImpact == null ? null : Number(body.financialImpact), severity: body.severity || 'MEDIUM', ownerId: body.ownerId ? String(body.ownerId) : null, dueDate: body.dueDate ? new Date(body.dueDate) : null } });
    } else if (resource === 'action-plan') {
      value = await prisma.auditActionPlan.create({ data: { organizationId, propertyId, engagementId, findingId: String(body.findingId), ownerId: body.ownerId ? String(body.ownerId) : session.user.id, action: String(body.action), dueDate: new Date(body.dueDate), progress: body.progress == null ? 0 : Number(body.progress) } });
    } else if (resource === 'final-pack') {
      const [requests, workpapers, findings] = await Promise.all([prisma.auditEvidenceRequest.count({ where: { engagementId } }), prisma.auditWorkpaper.count({ where: { engagementId } }), prisma.auditFinding.count({ where: { engagementId } })]);
      const manifest = { engagementId, propertyId, requests, workpapers, findings, generatedAt: new Date().toISOString() };
      const packageHash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
      value = await prisma.auditFinalPack.create({ data: { organizationId, propertyId, engagementId, packageHash, manifest, createdById: session.user.id } });
    } else throw new Error('Unsupported audit resource');
    await prisma.auditLog.create({ data: { organizationId, propertyId, userId: session.user.id, action: `AUDIT_${resource.toUpperCase()}_CREATED`, resource: `Audit${resource[0].toUpperCase()}${resource.slice(1)}`, resourceId: (value as { id: string }).id, requestId: randomUUID(), newValue: value as object } });
    return NextResponse.json({ value }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === '403') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor management write failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create audit record' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const ctx = await context(session);
    const body = await request.json();
    const resource = String(body.resource || '');
    const id = String(body.id || '');
    const status = String(body.status || '');
    const record = resource === 'request'
      ? await prisma.auditEvidenceRequest.findUnique({ where: { id } })
      : resource === 'workpaper'
        ? await prisma.auditWorkpaper.findUnique({ where: { id } })
        : resource === 'finding'
          ? await prisma.auditFinding.findUnique({ where: { id } })
          : resource === 'action-plan'
            ? await prisma.auditActionPlan.findUnique({ where: { id } })
            : resource === 'engagement'
              ? await prisma.auditEngagement.findUnique({ where: { id } })
              : null;
    if (!record || (ctx.external && !ctx.scopes.some(scope => scope.propertyId === record.propertyId))) throw new Error('403');
    let value: unknown;
    if (resource === 'request') value = await prisma.auditEvidenceRequest.update({ where: { id }, data: { status: status as any, responseNote: body.responseNote ? String(body.responseNote) : undefined, submittedAt: status === 'SUBMITTED' ? new Date() : undefined, acceptedAt: status === 'ACCEPTED' ? new Date() : undefined } });
    else if (resource === 'workpaper') value = await prisma.auditWorkpaper.update({ where: { id }, data: { status: status as any, reviewerNote: body.reviewerNote ? String(body.reviewerNote) : undefined, reviewedById: status === 'APPROVED' ? session.user.id : undefined, signedAt: status === 'APPROVED' || status === 'LOCKED' ? new Date() : undefined } });
    else if (resource === 'finding') value = await prisma.auditFinding.update({ where: { id }, data: { status: status as any, managementResponse: body.managementResponse ? String(body.managementResponse) : undefined, validatedById: status === 'CLOSED' ? session.user.id : undefined, closedAt: status === 'CLOSED' ? new Date() : undefined } });
    else if (resource === 'action-plan') value = await prisma.auditActionPlan.update({ where: { id }, data: { status: status as any, progress: body.progress === undefined ? undefined : Number(body.progress), completionNote: body.completionNote ? String(body.completionNote) : undefined, completedAt: status === 'COMPLETED' ? new Date() : undefined } });
    else if (resource === 'engagement') value = await prisma.auditEngagement.update({ where: { id }, data: { status: status as any, closedAt: status === 'CLOSED' ? new Date() : undefined } });
    return NextResponse.json({ value });
  } catch (error) {
    if (error instanceof Error && error.message === '403') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unable to update audit record' }, { status: 400 });
  }
}
