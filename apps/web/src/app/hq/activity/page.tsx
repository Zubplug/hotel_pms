import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { ActivityCommandCenter } from './ActivityCommandCenter';

const DAY = 24 * 60 * 60 * 1000;
const SENSITIVE_ACTIONS = ['ROLE_CHANGED', 'PERMISSION_CHANGED', 'FINANCIAL_OVERRIDE', 'UNAUTHORIZED_DISCOUNT', 'USER_DEACTIVATED', 'IMPERSONATION_STARTED', 'IMPERSONATION_ENDED'];

export default async function HQActivityPage() {
  await requireHQAdmin();
  const now = new Date();
  const since = new Date(now.getTime() - 29 * DAY);
  const logs = await prisma.auditLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 1000, include: { organization: { select: { id: true, name: true, slug: true } } } });
  const daily = Array.from({ length: 14 }, (_, index) => { const date = new Date(now.getTime() - (13 - index) * DAY); return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), events: 0, sensitive: 0 }; });
  const actionCounts = new Map<string, number>();
  const resourceCounts = new Map<string, number>();
  const actorCounts = new Map<string, { label: string; count: number }>();
  const organizationCounts = new Map<string, { name: string; count: number }>();
  let impersonated = 0;
  let sensitive = 0;
  for (const log of logs) {
    const action = log.action.toUpperCase();
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    resourceCounts.set(log.resource, (resourceCounts.get(log.resource) ?? 0) + 1);
    const actorLabel = log.userEmail || 'System';
    const actor = actorCounts.get(actorLabel) ?? { label: actorLabel, count: 0 };
    actor.count += 1; actorCounts.set(actorLabel, actor);
    const organization = organizationCounts.get(log.organizationId) ?? { name: log.organization.name, count: 0 };
    organization.count += 1; organizationCounts.set(log.organizationId, organization);
    if (log.impersonatorUserId) impersonated += 1;
    if (SENSITIVE_ACTIONS.includes(action)) sensitive += 1;
    const point = daily.find((item) => item.key === log.createdAt.toISOString().slice(0, 10));
    if (point) { point.events += 1; if (SENSITIVE_ACTIONS.includes(action)) point.sensitive += 1; }
  }
  const logsForClient = logs.map((log) => ({ id: log.id, organizationId: log.organizationId, organizationName: log.organization.name, organizationSlug: log.organization.slug, propertyId: log.propertyId, userId: log.userId, userEmail: log.userEmail, userRole: log.userRole, impersonatorUserId: log.impersonatorUserId, action: log.action, resource: log.resource, resourceId: log.resourceId, previousValue: log.previousValue, newValue: log.newValue, ipAddress: log.ipAddress, userAgent: log.userAgent, requestId: log.requestId, createdAt: log.createdAt.toISOString(), sensitive: SENSITIVE_ACTIONS.includes(log.action.toUpperCase()) }));
  return <ActivityCommandCenter data={{ generatedAt: now.toISOString(), logs: logsForClient, daily: daily.map(({ key, ...point }) => point), actions: [...actionCounts.entries()].map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count), resources: [...resourceCounts.entries()].map(([resource, count]) => ({ resource, count })).sort((a, b) => b.count - a.count), actors: [...actorCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8), organizations: [...organizationCounts.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.count - a.count).slice(0, 8), metrics: { total: logs.length, sensitive, impersonated, organizations: organizationCounts.size, actors: actorCounts.size, failedSignals: logs.filter((log) => /FAIL|ERROR|DENIED|REJECT/i.test(log.action)).length } }} />;
}
