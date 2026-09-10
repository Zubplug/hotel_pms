import React from 'react';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, BookOpen, Calendar, Calculator, ShieldCheck } from 'lucide-react';
import { AddAccountModal } from '@/components/accountant/AddAccountModal';
import { NewPeriodModal } from '@/components/accountant/NewPeriodModal';

export default async function SettingsPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;

  const accounts = propertyId ? await prisma.chartOfAccount.findMany({ 
    where: { propertyId },
    orderBy: { code: 'asc' }
  }) : [];

  const periods = propertyId ? await prisma.accountingPeriod.findMany({
    where: { propertyId },
    orderBy: { periodStart: 'desc' }
  }) : [];

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center gap-3">
            <Settings className="w-8 h-8 text-emerald-500" />
            Enterprise Settings
          </h1>
          <p className="text-slate-400 mt-1">Configure global accounting rules, charts, and fiscal periods.</p>
        </div>
      </div>

      <Tabs defaultValue="coa" className="w-full">
        <TabsList className="bg-slate-900 border-white/10 p-1 rounded-xl gap-2 overflow-x-auto w-full justify-start h-14">
          <TabsTrigger value="coa" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 rounded-lg h-10 px-4 flex gap-2">
            <BookOpen className="w-4 h-4" /> Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 rounded-lg h-10 px-4 flex gap-2">
            <Calendar className="w-4 h-4" /> Fiscal Periods
          </TabsTrigger>
          <TabsTrigger value="taxes" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 rounded-lg h-10 px-4 flex gap-2">
            <Calculator className="w-4 h-4" /> Taxes & Compliance
          </TabsTrigger>
          <TabsTrigger value="approval" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 rounded-lg h-10 px-4 flex gap-2">
            <ShieldCheck className="w-4 h-4" /> Approval Workflows
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coa" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Chart of Accounts</h2>
              <p className="text-sm text-slate-400">Manage all master ledger accounts.</p>
            </div>
            <AddAccountModal />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-white/10 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Account Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No accounts found. Add one above.</td>
                  </tr>
                ) : accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-emerald-400">{acc.code}</td>
                    <td className="px-6 py-4 text-white">{acc.name}</td>
                    <td className="px-6 py-4 text-slate-300">{acc.type}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                        {acc.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="fiscal" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Fiscal Periods</h2>
              <p className="text-sm text-slate-400">Manage accounting cycles and period locks.</p>
            </div>
            <NewPeriodModal />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-white/10 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Period Name</th>
                  <th className="px-6 py-4 font-medium">Start Date</th>
                  <th className="px-6 py-4 font-medium">End Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No periods found.</td>
                  </tr>
                ) : periods.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-6 py-4 text-slate-300">{p.periodStart.toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-slate-300">{p.periodEnd.toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs border ${
                        p.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="taxes" className="mt-6">
          <div className="p-12 text-center border border-white/10 rounded-xl bg-slate-900/50">
            <Calculator className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">Tax Configurations</h3>
            <p className="text-slate-500 max-w-md mx-auto mt-2">Global VAT and Service Charge settings are currently managed via the main Property Settings dashboard.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="approval" className="mt-6">
          <div className="p-12 text-center border border-white/10 rounded-xl bg-slate-900/50">
            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">Workflow Routing</h3>
            <p className="text-slate-500 max-w-md mx-auto mt-2">Expense and Payroll approval hierarchies are locked and controlled by the Super Admin.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
