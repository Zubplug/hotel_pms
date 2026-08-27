import React from "react";
import prisma from "@hotel-pms/db";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Receipt, History, AlertCircle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function GeneralCashierDashboardPage() {
  // We fetch PosSessions to find active Till Drops from Outlet Cashiers
  const activeOutletShifts = await prisma.posSession.findMany({
    where: { status: 'OPEN' },
    include: {
      outlet: true,
      staff: true
    }
  });

  // Example placeholders for central cashier operations
  const todayRevenue = 1450000;
  const cashInDrawer = 350000;
  const pendingDrops = activeOutletShifts.length;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">General Cashier</h1>
          <p className="text-slate-500">Manage central hotel finances, folios, till drops, and payouts.</p>
        </div>
        <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">Open Main Shift</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><Wallet className="w-4 h-4" /> Current Float</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(cashInDrawer, 'NGN')}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><Receipt className="w-4 h-4" /> Today's Consolidated Revenue</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(todayRevenue, 'NGN')}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><ArrowDownToLine className="w-4 h-4" /> Pending Till Drops</h3>
          <div className="text-3xl font-black text-amber-600 mt-2">{pendingDrops} Outlets</div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2"><ArrowUpFromLine className="w-4 h-4" /> Petty Cash Payouts</h3>
          <div className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(45000, 'NGN')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Till Drops Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Outlet Shifts & Till Drops</h2>
            <Button variant="outline" size="sm" className="text-indigo-600">View History</Button>
          </div>
          
          <div className="grid gap-4">
            {activeOutletShifts.map(shift => (
              <div key={shift.id} className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{shift.outlet.name}</h3>
                  <div className="text-sm text-slate-500 mt-1">Cashier: {shift.staff?.firstName || 'System'} • Opened: {shift.openedAt.toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-2">Status: <span className="text-emerald-600 font-medium">Active</span></div>
                  <Button variant="outline" size="sm" disabled>Receive Drop</Button>
                </div>
              </div>
            ))}
            
            {activeOutletShifts.length === 0 && (
              <div className="p-12 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-400" />
                <p>All outlets are closed and reconciled.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Central Operations Section */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-lg font-medium text-slate-300">Folio Settlements</h2>
              <div className="mt-4 space-y-2">
                <Button className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 border-none">Settle Guest Folio</Button>
                <Button className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white border-slate-700">Receive Advance Deposit</Button>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900">General Operations</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">Foreign Exchange (FX)</Button>
              <Button variant="outline" className="w-full justify-start">Petty Cash Payout</Button>
              <Button variant="outline" className="w-full justify-start">Process Refund</Button>
            </div>
          </div>
          
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm space-y-2">
            <div className="flex gap-2 items-center text-amber-800 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>Pending Approvals</span>
            </div>
            <p className="text-sm text-amber-700">2 void requests require manager approval before dropping till.</p>
            <Button variant="link" className="text-amber-800 p-0 h-auto font-bold">Review Requests &rarr;</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
