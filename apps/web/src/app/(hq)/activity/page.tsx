import prisma from '@hotel-pms/db';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { requireHQAdmin } from '@/lib/auth/hq';

export default async function HQActivityPage() {
  await requireHQAdmin();
  // Fetch the latest 100 audit logs across the entire system
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { organization: { select: { name: true, slug: true } } }
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Global Activity Feed</h1>
        <p className="text-zinc-500 mt-1">Real-time audit log of all system actions across all tenants.</p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-medium text-zinc-500">Timestamp</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Tenant</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Actor</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Action</th>
              <th className="px-6 py-4 font-medium text-zinc-500">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                  {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-zinc-900 dark:text-white">{log.organization.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium">{log.userEmail || 'System'}</div>
                  {log.impersonatorUserId && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-1">
                      (Impersonated by HQ Admin)
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {log.resource} <span className="opacity-50">#{log.resourceId.slice(0,8)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
