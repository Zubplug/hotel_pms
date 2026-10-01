import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { LeadsCommandCenter } from './LeadsCommandCenter';

const DAY = 24 * 60 * 60 * 1000;

export default async function HQLeadsPage() {
  await requireHQAdmin();
  const now = new Date();
  const since = new Date(now.getTime() - 5 * 30 * DAY);

  const [leads, proposals, implementationProjects] = await Promise.all([
    prisma.salesLead.findMany({ orderBy: { createdAt: 'desc' }, take: 250, include: { organization: { select: { id: true, name: true, slug: true } }, proposals: { select: { id: true, number: true, status: true, total: true, currency: true, validUntil: true, createdAt: true } } } }),
    prisma.proposal.findMany({ where: { createdAt: { gte: since } }, select: { id: true, leadId: true, organizationId: true, status: true, total: true, currency: true, validUntil: true, createdAt: true } }),
    prisma.implementationProject.findMany({ where: { createdAt: { gte: since } }, select: { id: true, organizationId: true, status: true, targetGoLiveAt: true, createdAt: true } }),
  ]);

  const pipelineStages = ['NEW', 'QUALIFIED', 'INVITE_PENDING', 'CONVERTED'];
  const stageLabels: Record<string, string> = { NEW: 'New', QUALIFIED: 'Qualified', INVITE_PENDING: 'Invite pending', CONVERTED: 'Converted' };
  const stageProbability: Record<string, number> = { NEW: 0.1, QUALIFIED: 0.4, INVITE_PENDING: 0.75, CONVERTED: 1 };
  const stageCounts = pipelineStages.map((status) => ({ status, label: stageLabels[status], count: leads.filter((lead) => lead.status === status).length, probability: stageProbability[status] }));
  const sourceCounts = Object.entries(leads.reduce<Record<string, number>>((acc, lead) => { const source = lead.source || 'UNKNOWN'; acc[source] = (acc[source] ?? 0) + 1; return acc; }, {})).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  const monthly = Array.from({ length: 6 }, (_, index) => { const date = new Date(since); date.setMonth(since.getMonth() + index); return { label: date.toLocaleDateString('en-US', { month: 'short' }), leads: leads.filter((lead) => lead.createdAt.getFullYear() === date.getFullYear() && lead.createdAt.getMonth() === date.getMonth()).length, converted: leads.filter((lead) => lead.convertedAt && lead.convertedAt.getFullYear() === date.getFullYear() && lead.convertedAt.getMonth() === date.getMonth()).length }; });
  const openLeads = leads.filter((lead) => !['CONVERTED', 'LOST', 'DISQUALIFIED'].includes(lead.status));
  const staleLeads = openLeads.filter((lead) => now.getTime() - lead.updatedAt.getTime() > 7 * DAY);
  const qualified = leads.filter((lead) => ['QUALIFIED', 'INVITE_PENDING', 'CONVERTED'].includes(lead.status)).length;
  const converted = leads.filter((lead) => lead.status === 'CONVERTED').length;
  const proposalValue = proposals.filter((proposal) => !['DECLINED', 'EXPIRED', 'DRAFT'].includes(proposal.status)).reduce((sum, proposal) => sum + proposal.total, 0);
  const leadRows = leads.map((lead) => ({ id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, propertyName: lead.propertyName, location: lead.location, roomCount: lead.roomCount, message: lead.message, source: lead.source, campaign: lead.sourceCampaign, status: lead.status, assignedTo: lead.assignedTo, organization: lead.organization, createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString(), convertedAt: lead.convertedAt?.toISOString() ?? null, proposals: lead.proposals.map((proposal) => ({ id: proposal.id, number: proposal.number, status: proposal.status, total: proposal.total, currency: proposal.currency, validUntil: proposal.validUntil?.toISOString() ?? null, createdAt: proposal.createdAt.toISOString() })) }));

  return <LeadsCommandCenter data={{ generatedAt: now.toISOString(), leads: leadRows, stageCounts, sourceCounts, monthly, implementationProjects: implementationProjects.map((project) => ({ id: project.id, organizationId: project.organizationId, status: project.status, targetGoLiveAt: project.targetGoLiveAt?.toISOString() ?? null, createdAt: project.createdAt.toISOString() })), metrics: { total: leads.length, open: openLeads.length, stale: staleLeads.length, qualified, converted, qualificationRate: leads.length ? Math.round((qualified / leads.length) * 100) : 0, conversionRate: leads.length ? Math.round((converted / leads.length) * 100) : 0, proposalCount: proposals.length, proposalValue } }} />;
}
