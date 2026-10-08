import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { activateCustomDomainRequest } from './actions';

export default async function HQCustomDomainsPage() {
  await requireHQAdmin();
  const requests = await prisma.customDomainRequest.findMany({ orderBy: { createdAt: 'desc' }, include: { organization: { select: { name: true } }, property: { select: { name: true } } } });
  return <main className="p-8"><h1 className="text-2xl font-bold">Custom domain configuration</h1><p className="mt-2 text-sm text-slate-500">Customers pay for available domains first. HQ configuration staff activate them after payment.</p><div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Organization</th><th className="p-4">Property</th><th className="p-4">Domain</th><th className="p-4">Status</th><th className="p-4">Amount</th><th className="p-4">Action</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} className="border-b last:border-0"><td className="p-4">{request.organization.name}</td><td className="p-4">{request.property.name}</td><td className="p-4 font-mono">{request.domain}</td><td className="p-4">{request.status}</td><td className="p-4">{request.currency.toUpperCase()} {(request.amount / 100).toLocaleString()}</td><td className="p-4">{request.status === 'PAID' && <form action={async () => { 'use server'; await activateCustomDomainRequest(request.id); }}><button className="rounded bg-indigo-600 px-3 py-1 text-white">Configure / activate</button></form>}</td></tr>)}</tbody></table></div></main>;
}
