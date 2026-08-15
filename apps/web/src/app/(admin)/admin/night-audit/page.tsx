import { Metadata } from 'next';
import { CalendarClock, Server, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Night Audit Management | LodgeCore',
};

export default function NightAuditDashboard() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Night Audit & Reconciliations</h2>
          <p className="text-muted-foreground">
            Manage the central business date, run audits, and monitor distributed edge nodes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">View Historical Audits</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <CalendarClock className="mr-2 h-4 w-4" />
            Force Run Night Audit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Current Business Date</h3>
            <CalendarClock className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-indigo-700">August 16, 2026</div>
            <p className="text-xs text-muted-foreground mt-1">
              Authoritative Cloud Ledger Date
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Last Audit Status</h3>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-emerald-600">Completed</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aug 16, 2026 — 02:00 AM
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Pending Sync Events</h3>
            <Server className="h-4 w-4 text-blue-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">14</div>
            <p className="text-xs text-muted-foreground mt-1">
              From disconnected edge nodes
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-8">
        <div className="rounded-xl border bg-card shadow flex flex-col">
          <div className="p-6 pb-4 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              Edge Device Status
            </h3>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-6 py-3">Device ID</th>
                  <th className="px-6 py-3">Connection</th>
                  <th className="px-6 py-3">Local Business Date</th>
                  <th className="px-6 py-3">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-white">
                  <td className="px-6 py-4 font-medium text-slate-900">FD-001</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Online
                    </span>
                  </td>
                  <td className="px-6 py-4">Aug 16, 2026</td>
                  <td className="px-6 py-4 text-muted-foreground">Just now</td>
                </tr>
                <tr className="bg-amber-50/30">
                  <td className="px-6 py-4 font-medium text-slate-900">FD-002</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Offline
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-amber-700">Aug 15, 2026</td>
                  <td className="px-6 py-4 text-muted-foreground">7 hours ago</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-6 py-4 font-medium text-slate-900">FD-003</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Online
                    </span>
                  </td>
                  <td className="px-6 py-4">Aug 16, 2026</td>
                  <td className="px-6 py-4 text-muted-foreground">2 mins ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-red-50/50 shadow flex flex-col border-red-100">
          <div className="p-6 pb-4 border-b border-red-100 bg-white rounded-t-xl">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Audit Exceptions & Late Postings
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="mt-1">
                    <Clock className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-700">FD-002 was offline during Night Audit</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      This edge node failed to receive the date advancement to Aug 16. It is currently posting transactions against the closed Aug 15 ledger.
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-sm font-medium">
                      <span className="text-red-600">3 Late Postings Pending</span>
                      <span className="text-slate-600">₦85,000 Total Activity</span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-red-700 border-red-200 hover:bg-red-50">
                  Review Folios
                </Button>
              </div>
            </div>
            
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm opacity-60">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="font-medium text-slate-700">All room charges posted successfully</span>
                </div>
                <span className="text-xs text-muted-foreground">02:01 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
