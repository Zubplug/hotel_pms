import React from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText
} from 'lucide-react';

const AR_AGING_SUMMARY = [
  { label: 'Current (0-30 Days)', amount: '$45,231.00', count: 24, status: 'healthy' },
  { label: '31-60 Days', amount: '$12,450.50', count: 8, status: 'warning' },
  { label: '61-90 Days', amount: '$4,120.00', count: 3, status: 'danger' },
  { label: '90+ Days', amount: '$1,850.00', count: 2, status: 'critical' },
];

const UNPAID_ACCOUNTS = [
  { id: 'INV-2026-001', company: 'Acme Corp', type: 'City Ledger', amount: '$4,500.00', dueDate: '2026-09-15', status: 'Pending', daysOverdue: 0 },
  { id: 'INV-2026-042', company: 'Globex Inc', type: 'Corporate', amount: '$12,300.00', dueDate: '2026-08-10', status: 'Overdue', daysOverdue: 31 },
  { id: 'INV-2026-088', company: 'Stark Industries', type: 'City Ledger', amount: '$1,850.00', dueDate: '2026-06-01', status: 'Critical', daysOverdue: 101 },
  { id: 'INV-2026-102', company: 'Wayne Enterprises', type: 'Corporate', amount: '$8,200.00', dueDate: '2026-09-20', status: 'Pending', daysOverdue: 0 },
  { id: 'INV-2026-115', company: 'Initech', type: 'City Ledger', amount: '$2,150.50', dueDate: '2026-07-15', status: 'Overdue', daysOverdue: 57 },
];

export default function ReceivablesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Building2 className="h-8 w-8 text-emerald-400" />
              Accounts Receivable
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Manage city ledger, corporate accounts, and AR aging
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Export Report
            </button>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              New Invoice
            </button>
          </div>
        </div>

        {/* AR Aging Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AR_AGING_SUMMARY.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/50 transition-colors"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <p className="text-slate-400 text-sm font-medium mb-1">{item.label}</p>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-bold text-white">{item.amount}</h3>
                  <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-white/5 border border-white/10">
                    <span>{item.count}</span>
                    <span className="text-slate-400 ml-1">inv</span>
                  </div>
                </div>
                
                <div className="mt-4 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      item.status === 'healthy' ? 'bg-emerald-400' :
                      item.status === 'warning' ? 'bg-amber-400' :
                      item.status === 'danger' ? 'bg-orange-500' :
                      'bg-red-500'
                    }`} 
                    style={{ width: `${Math.max(10, 100 - (idx * 25))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Outstanding & Chart Area (Mockup) */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <p className="text-slate-400 text-sm font-medium">Total Outstanding Receivables</p>
            <h2 className="text-4xl font-bold text-white mt-1">$63,651.50</h2>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className="flex items-center text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs font-medium">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                2.4%
              </span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>
          <div className="h-16 w-full md:w-64 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-transparent rounded-lg border border-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-500/50 text-xs font-medium">[ Sparkline Chart Placeholder ]</span>
          </div>
        </div>

        {/* Unpaid Accounts Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Unpaid Accounts</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search invoices..." 
                  className="bg-slate-900 border border-white/10 text-sm rounded-lg pl-9 pr-4 py-2 w-full sm:w-64 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 placeholder:text-slate-500 transition-all"
                />
              </div>
              <button className="p-2 bg-slate-900 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-white/20 transition-colors">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-white/10 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Invoice ID</th>
                  <th className="px-6 py-4 font-medium">Account / Company</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Due Date</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {UNPAID_ACCOUNTS.map((account) => (
                  <tr key={account.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-300 group-hover:text-emerald-400 transition-colors">
                      {account.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {account.company}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-800 rounded text-xs font-medium text-slate-300 border border-white/5">
                        {account.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      <div className="flex flex-col">
                        <span>{account.dueDate}</span>
                        {account.daysOverdue > 0 && (
                          <span className="text-xs text-red-400 mt-0.5">{account.daysOverdue} days overdue</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-white">
                      {account.amount}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        account.status === 'Pending' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        account.status === 'Overdue' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {account.status === 'Pending' && <Clock className="h-3 w-3" />}
                        {account.status === 'Overdue' && <AlertCircle className="h-3 w-3" />}
                        {account.status === 'Critical' && <AlertCircle className="h-3 w-3" />}
                        {account.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-white/10 text-center text-sm text-slate-500 bg-slate-900/30">
            Showing 5 of 37 unpaid accounts
          </div>
        </div>

      </div>
    </div>
  );
}
