import React from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  ArrowUpRight,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Wallet
} from 'lucide-react';

const AP_AGING_SUMMARY = [
  { label: 'Current (0-30 Days)', amount: '₦28,450.00', count: 18, status: 'healthy' },
  { label: '31-60 Days', amount: '₦5,210.00', count: 4, status: 'warning' },
  { label: '61-90 Days', amount: '₦1,150.00', count: 1, status: 'danger' },
  { label: '90+ Days', amount: '₦0.00', count: 0, status: 'healthy' },
];

const SUPPLIER_INVOICES = [
  { id: 'PINV-8820', supplier: 'Sysco Foods', category: 'F&B', amount: '₦4,250.00', dueDate: '2026-09-12', status: 'Pending Approval' },
  { id: 'PINV-8821', supplier: 'Ecolab', category: 'Housekeeping', amount: '₦1,820.50', dueDate: '2026-09-15', status: 'Approved' },
  { id: 'PINV-8822', supplier: 'Otis Elevators', category: 'Maintenance', amount: '₦3,500.00', dueDate: '2026-08-30', status: 'Overdue' },
  { id: 'PINV-8823', supplier: 'Guest Supply', category: 'Amenities', amount: '₦2,100.00', dueDate: '2026-09-20', status: 'Pending Approval' },
  { id: 'PINV-8824', supplier: 'Comcast Business', category: 'IT/Telecom', amount: '₦850.00', dueDate: '2026-09-05', status: 'Processing Payment' },
];

export default function PayablesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-emerald-400" />
              Accounts Payable
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Manage supplier invoices, approvals, and AP aging
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Run AP Report
            </button>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              Record Bill
            </button>
          </div>
        </div>

        {/* AP Aging Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AP_AGING_SUMMARY.map((item, idx) => (
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
                    className={`h-full rounded-full ₦{
                      item.status === 'healthy' ? 'bg-emerald-400' :
                      item.status === 'warning' ? 'bg-amber-400' :
                      item.status === 'danger' ? 'bg-orange-500' :
                      'bg-slate-700'
                    }`} 
                    style={{ width: item.count === 0 ? '0%' : `${Math.max(10, 100 - (idx * 25))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Payables Outstanding</p>
              <h2 className="text-4xl font-bold text-white mt-1">₦34,810.00</h2>
              <div className="flex items-center gap-2 mt-2 text-sm">
                <span className="flex items-center text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-xs font-medium">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  5.1%
                </span>
                <span className="text-slate-500">vs last month</span>
              </div>
            </div>
            
            <div className="h-full w-[1px] bg-white/10 hidden md:block"></div>
            
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button className="w-full md:w-48 px-4 py-2.5 bg-slate-900 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 hover:border-emerald-500/50 transition-all flex items-center justify-between group">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 group-hover:text-emerald-300" /> Pending Approval</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs">12</span>
              </button>
              <button className="w-full md:w-48 px-4 py-2.5 bg-slate-900 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 hover:border-emerald-500/50 transition-all flex items-center justify-between group">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-400 group-hover:text-emerald-300" /> Ready to Pay</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs">8</span>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl" />
            <h3 className="text-lg font-semibold text-white mb-2">Payment Run</h3>
            <p className="text-sm text-slate-400 mb-6 relative z-10">
              You have 8 approved invoices scheduled for payment this week.
            </p>
            <button className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] relative z-10">
              Review Payment Run
            </button>
          </div>
        </div>

        {/* Supplier Invoices Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Recent Supplier Invoices</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search supplier or ID..." 
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
                  <th className="px-6 py-4 font-medium">Supplier</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Due Date</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {SUPPLIER_INVOICES.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-300 group-hover:text-emerald-400 transition-colors">
                      {invoice.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {invoice.supplier}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-800 rounded text-xs font-medium text-slate-300 border border-white/5">
                        {invoice.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {invoice.dueDate}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-white">
                      {invoice.amount}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ₦{
                        invoice.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        invoice.status === 'Pending Approval' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        invoice.status === 'Processing Payment' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {invoice.status === 'Approved' && <CheckCircle2 className="h-3 w-3" />}
                        {invoice.status === 'Pending Approval' && <Clock className="h-3 w-3" />}
                        {invoice.status === 'Processing Payment' && <Clock className="h-3 w-3" />}
                        {invoice.status === 'Overdue' && <AlertCircle className="h-3 w-3" />}
                        {invoice.status}
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
            Showing 5 of 23 invoices
          </div>
        </div>

      </div>
    </div>
  );
}
