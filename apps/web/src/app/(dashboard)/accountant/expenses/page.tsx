import React from 'react';
import {
  FileText,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Building,
  ArrowRight,
  Receipt,
  PlusCircle,
  Filter
} from 'lucide-react';

const ExpenseControlPage = () => {
  const pettyCashVouchers = [
    { id: 'PCV-1029', date: '2026-09-10', department: 'Housekeeping', amount: 150.00, status: 'Pending Approval', description: 'Cleaning supplies restock' },
    { id: 'PCV-1028', date: '2026-09-09', department: 'Front Desk', amount: 45.50, status: 'Approved', description: 'Office stationery' },
    { id: 'PCV-1027', date: '2026-09-08', department: 'Maintenance', amount: 220.00, status: 'Approved', description: 'Emergency plumbing parts' },
    { id: 'PCV-1026', date: '2026-09-07', department: 'F&B', amount: 85.00, status: 'Rejected', description: 'Staff meal extras' },
  ];

  const departmentalAlerts = [
    { department: 'F&B', budget: 15000, currentSpend: 14800, variance: '+12%', alertLevel: 'critical', trend: 'up' },
    { department: 'Maintenance', budget: 8000, currentSpend: 7500, variance: '+5%', alertLevel: 'warning', trend: 'up' },
    { department: 'Marketing', budget: 5000, currentSpend: 4200, variance: '-16%', alertLevel: 'normal', trend: 'down' },
    { department: 'Housekeeping', budget: 6000, currentSpend: 6100, variance: '+1.6%', alertLevel: 'warning', trend: 'up' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-amber-400">
              Expense Control
            </h1>
            <p className="text-slate-400 mt-1">Manage petty cash and monitor departmental budgets</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-amber-500 text-white rounded-lg hover:from-rose-600 hover:to-amber-600 transition-colors text-sm font-medium shadow-lg shadow-rose-500/20">
              <PlusCircle className="w-4 h-4" />
              New Voucher
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Receipt className="w-16 h-16 text-rose-400" />
            </div>
            <div className="flex items-center gap-3 text-rose-400 mb-2">
              <div className="p-2 bg-rose-400/10 rounded-lg">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-300">Pending Vouchers</h3>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-white">12</span>
              <span className="text-slate-400 ml-2 text-sm">awaiting approval</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertTriangle className="w-16 h-16 text-amber-400" />
            </div>
            <div className="flex items-center gap-3 text-amber-400 mb-2">
              <div className="p-2 bg-amber-400/10 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-300">Budget Alerts</h3>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-white">3</span>
              <span className="text-slate-400 ml-2 text-sm">departments over budget</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-16 h-16 text-emerald-400" />
            </div>
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <div className="p-2 bg-emerald-400/10 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-300">Total YTD Spend</h3>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-white">₦142,500</span>
              <span className="text-emerald-400 ml-2 text-sm">↓ 2.4% vs LY</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Petty Cash Vouchers */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-lg border border-rose-500/30">
                  <CreditCard className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Recent Petty Cash</h2>
              </div>
              <button className="text-sm text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-sm">
                    <th className="pb-3 font-medium">Voucher ID</th>
                    <th className="pb-3 font-medium">Dept & Desc</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pettyCashVouchers.map((voucher) => (
                    <tr key={voucher.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4">
                        <span className="text-sm font-medium text-slate-200">{voucher.id}</span>
                        <div className="text-xs text-slate-500 mt-1">{voucher.date}</div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-300">{voucher.department}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate max-w-[150px]" title={voucher.description}>
                          {voucher.description}
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-sm font-medium text-white">₦{voucher.amount.toFixed(2)}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ₦{
                          voucher.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          voucher.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {voucher.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Departmental Spend Alerts */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Departmental Spend Alerts</h2>
              </div>
            </div>
            
            <div className="space-y-4">
              {departmentalAlerts.map((dept, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-200">{dept.department}</h3>
                      {dept.alertLevel === 'critical' && (
                        <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </div>
                    <div className={`text-sm font-medium flex items-center gap-1 ₦{
                      dept.alertLevel === 'critical' ? 'text-rose-400' :
                      dept.alertLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {dept.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                      {dept.variance}
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-sm text-slate-400 mb-2">
                    <span>Spend: <span className="text-slate-200">₦{dept.currentSpend.toLocaleString()}</span></span>
                    <span>Budget: ₦{dept.budget.toLocaleString()}</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ₦{
                        dept.alertLevel === 'critical' ? 'bg-gradient-to-r from-rose-500 to-rose-400' :
                        dept.alertLevel === 'warning' ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 
                        'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      }`}
                      style={{ width: `${Math.min((dept.currentSpend / dept.budget) * 100, 100)}%` }}
                    ></div>
                  </div>
                  {dept.alertLevel === 'critical' && (
                    <div className="mt-2 text-xs text-rose-400">
                      Warning: Department has consumed 98% of monthly budget.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExpenseControlPage;
