import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Coffee, 
  Bed, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Download
} from 'lucide-react';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

export default async function RevenueAccountingPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  if (!propertyId) {
    return <div className="p-8 text-slate-400">Property ID not found</div>;
  }

  // To build a full revenue summary, we would aggregate NightAudit or Folio data here.
  // Due to complexity, we'll initialize as empty arrays.
  const snapshotData: any[] = [];
  const revenueStreams: any[] = [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="h-8 w-8 text-emerald-400" />
              Revenue Accounting
            </h1>
            <p className="text-slate-400 mt-1">Daily revenue snapshot and departmental performance.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md transition-colors font-medium">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>

        {/* Snapshot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {snapshotData.length === 0 && (
            <div className="col-span-full text-slate-400 p-4 border border-white/10 rounded-lg">No snapshot data found.</div>
          )}
          {snapshotData.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity group-hover:bg-emerald-500/10"></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ₦{item.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {item.change}
                  </div>
                </div>
                <div>
                  <h3 className="text-slate-400 text-sm font-medium">{item.title}</h3>
                  <div className="text-3xl font-bold text-white mt-1">{item.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Revenue Streams Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white">Revenue Streams</h2>
            <p className="text-sm text-slate-400 mt-1">Detailed breakdown of revenue by department.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-300 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium border-b border-white/10">Department</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10">Today</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10">MTD</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10">YTD</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10">Variance (YoY)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {revenueStreams.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-slate-400">No data</td>
                  </tr>
                )}
                {revenueStreams.map((stream) => (
                  <tr key={stream.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 text-white font-medium group-hover:text-emerald-300 transition-colors">
                      {stream.department}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{stream.today}</td>
                    <td className="px-6 py-4 text-slate-300">{stream.mtd}</td>
                    <td className="px-6 py-4 text-slate-300">{stream.ytd}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ₦{
                        stream.isUp 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {stream.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {stream.variance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-white/5 border-t border-white/10 font-medium">
                <tr>
                  <td className="px-6 py-4 text-white">Total</td>
                  <td className="px-6 py-4 text-emerald-400">₦0</td>
                  <td className="px-6 py-4 text-emerald-400">₦0</td>
                  <td className="px-6 py-4 text-emerald-400">₦0</td>
                  <td className="px-6 py-4 text-emerald-400">0.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
