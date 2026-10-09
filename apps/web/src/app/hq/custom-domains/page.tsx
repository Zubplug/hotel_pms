import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { activateCustomDomainRequest } from './actions';

export default async function HQCustomDomainsPage() {
  await requireHQAdmin();
  const requests = await prisma.customDomainRequest.findMany({ 
    where: { status: { notIn: ['REJECTED', 'CANCELLED'] } }, 
    orderBy: { createdAt: 'desc' }, 
    include: { organization: { select: { name: true } }, property: { select: { name: true } } } 
  });

  return (
    <main className="min-h-screen bg-[#0B0F19] p-6 lg:p-12 relative overflow-hidden">
      {/* Decorative gradient background elements */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-emerald-600/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-row {
          opacity: 0;
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .glass-header {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-10 animate-row" style={{ animationDelay: '0s' }}>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Custom Domains</h1>
          <p className="mt-3 text-base text-slate-400 max-w-2xl leading-relaxed">
            Manage and activate branded guest experiences. Customers pay for available domains first; HQ configuration staff provisions and activates them here.
          </p>
        </header>

        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-700/50 overflow-hidden animate-row" style={{ animationDelay: '0.1s' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="glass-header border-b border-slate-700/80 text-xs uppercase tracking-wider text-slate-400 font-semibold sticky top-0 z-10">
                  <th className="px-6 py-5">Customer Details</th>
                  <th className="px-6 py-5">Domain</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Amount</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <p>No active domain requests found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  requests.map((request, idx) => (
                    <tr 
                      key={request.id} 
                      className="animate-row group hover:bg-slate-800/60 transition-colors duration-200"
                      style={{ animationDelay: `${0.15 + (idx * 0.05)}s` }}
                    >
                      <td className="px-6 py-5">
                        <div className="font-medium text-slate-200">{request.organization.name}</div>
                        <div className="text-sm text-slate-400 mt-1">{request.property.name}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center px-3 py-1 rounded-md bg-slate-800/80 text-slate-300 font-mono text-sm border border-slate-700/60 shadow-sm">
                          {request.domain}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          {request.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 text-emerald-400 text-xs font-semibold ring-1 ring-inset ring-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Awaiting Config
                            </span>
                          ) : request.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/50 text-blue-400 text-xs font-semibold ring-1 ring-inset ring-blue-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold ring-1 ring-inset ring-slate-600/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              {request.status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-medium text-slate-300">
                          {request.currency.toUpperCase()} {(request.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {request.status === 'PAID' ? (
                          <form action={async () => { 
                            'use server'; 
                            await activateCustomDomainRequest(request.id); 
                          }}>
                            <button className="relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-all duration-200 bg-indigo-600 border border-transparent rounded-lg shadow-sm hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 active:translate-y-0">
                              Configure &amp; Activate
                            </button>
                          </form>
                        ) : (
                          <span className="text-sm text-slate-500 italic">No action needed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
