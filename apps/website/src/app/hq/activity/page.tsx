import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';

export default async function HQActivityPage() {
  await requireHQAdmin();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { organization: { select: { name: true, slug: true } } },
  });

  return (
    <div className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10">
      <div className="mx-auto max-w-[1500px] space-y-8">

        {/* Page header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-[.18em] text-indigo-300">Platform monitoring</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Global activity feed</h1>
          <p className="mt-2 text-sm text-slate-400">
            Real-time audit log of all system actions across all tenants.
          </p>
        </header>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101b2f]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.15em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Timestamp</th>
                <th className="px-5 py-4 font-medium">Tenant</th>
                <th className="px-5 py-4 font-medium">Actor</th>
                <th className="px-5 py-4 font-medium">Action</th>
                <th className="px-5 py-4 font-medium">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {logs.map((log) => (
                <tr key={log.id} className="transition hover:bg-white/[.025]">
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
                      : 'Unknown'}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-200">{log.organization?.name ?? 'Unknown tenant'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{log.organization?.slug ?? '—'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-300">{log.userEmail || 'System'}</p>
                    {log.impersonatorUserId && (
                      <p className="mt-1 text-xs font-semibold text-amber-300">Impersonated by HQ</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-md bg-indigo-400/10 px-2 py-1 font-mono text-xs font-semibold text-indigo-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {log.resource}{' '}
                    <span className="opacity-50">#{log.resourceId.slice(0, 8)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <p className="p-12 text-center text-sm text-slate-500">No audit activity has been recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
