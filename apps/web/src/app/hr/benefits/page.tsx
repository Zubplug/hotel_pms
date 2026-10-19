'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  DollarSign,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BenefitsPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [canReviewBenefits, setCanReviewBenefits] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [loanForm, setLoanForm] = useState({
    staffId: '',
    principalAmount: '',
    tenorMonths: '6',
    reason: '',
  });

  const [advanceForm, setAdvanceForm] = useState({
    staffId: '',
    amount: '',
    reason: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [benRes, empRes] = await Promise.all([
        fetch('/api/hr/benefits'),
        fetch('/api/hr/employees?limit=200'),
      ]);

      if (benRes.ok) {
        const data = await benRes.json();
        setLoans(data.loans || []);
        setAdvances(data.advances || []);
        setCanReviewBenefits(Boolean(data.canReviewBenefits));
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      console.error('Failed to load benefits', err);
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = async (id: string, action: string) => {
    let reason: string | undefined;
    if (action.startsWith('REJECT')) {
      reason = window.prompt('Enter a detailed rejection reason (minimum 10 characters):') || undefined;
      if (!reason?.trim() || reason.trim().length < 10) return;
    }
    const res = await fetch('/api/hr/benefits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error || 'Unable to update request');
      return;
    }
    fetchData();
  };

  const canReview = canReviewBenefits;
  const reviewAction = (type: 'LOAN' | 'ADVANCE', approved: boolean) => `${approved ? 'HR_APPROVE' : 'HR_REJECT'}_${type}`;

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_LOAN', ...loanForm }),
      });
      if (res.ok) {
        setLoanModalOpen(false);
        setLoanForm({ staffId: '', principalAmount: '', tenorMonths: '6', reason: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_ADVANCE', ...advanceForm }),
      });
      if (res.ok) {
        setAdvanceModalOpen(false);
        setAdvanceForm({ staffId: '', amount: '', reason: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalLoanBalance = loans.reduce((sum, l) => sum + (l.balanceRemaining || 0), 0);
  const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-teal-400" />
            Employee Loans &amp; Salary Advances
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Company loans, repayment installments via monthly payroll deductions, and emergency salary advances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdvanceModalOpen(true)}
            className="border-slate-800 bg-slate-900/60 text-slate-300 text-xs h-9 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Salary Advance
          </Button>
          <Button
            size="sm"
            onClick={() => setLoanModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Issue Employee Loan
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Outstanding Loans</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">₦{totalLoanBalance.toLocaleString()}</span>
            <Receipt className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Recoverable via monthly payroll</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Loan Accounts</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{loans.length}</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Borrowing staff members</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Salary Advances</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">₦{totalAdvances.toLocaleString()}</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Mid-month advances</span>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="loans" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-0.5">
          <TabsTrigger value="loans" className="text-xs">Employee Loans Register ({loans.length})</TabsTrigger>
          <TabsTrigger value="advances" className="text-xs">Salary Advances ({advances.length})</TabsTrigger>
        </TabsList>

        {/* Loans Table */}
        <TabsContent value="loans">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Principal</th>
                    <th className="py-3 px-4">Monthly Deduction</th>
                    <th className="py-3 px-4">Balance Remaining</th>
                    <th className="py-3 px-4">Tenor</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">Loading loan records…</td>
                    </tr>
                  ) : loans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">No loan requests on file.</td>
                    </tr>
                  ) : (
                    loans.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{l.staffName}</p>
                          <p className="text-[10px] text-slate-500">{l.department} • {l.position}</p>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-white">₦{l.principalAmount?.toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono text-amber-400">₦{l.monthlyDeduction?.toLocaleString()} / mo</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">₦{l.balanceRemaining?.toLocaleString()}</td>
                        <td className="py-3 px-4">{l.tenorMonths} months</td>
                        <td className="py-3 px-4 text-slate-400">{l.reason}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${l.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : l.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {canReview && l.status === 'PENDING' && <div className="flex gap-1.5"><Button size="sm" onClick={() => void updateRequest(l.id, reviewAction('LOAN', true))} className="h-7 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-500">HR approve</Button><Button size="sm" variant="outline" onClick={() => void updateRequest(l.id, reviewAction('LOAN', false))} className="h-7 border-rose-400/30 px-2 text-[10px] text-rose-300">Reject</Button></div>}
                          {l.rejectionReason && <p className="mt-1 max-w-40 text-[10px] text-rose-300">{l.rejectionReason}</p>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Advances Table */}
        <TabsContent value="advances">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Advance Amount</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Request Date</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">No salary advances requested.</td>
                    </tr>
                  ) : (
                    advances.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{a.staffName}</td>
                        <td className="py-3 px-4 text-slate-400">{a.department}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">₦{a.amount?.toLocaleString()}</td>
                        <td className="py-3 px-4 text-slate-300">{a.reason}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${a.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : a.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          {canReview && a.status === 'PENDING' && <div className="flex gap-1.5"><Button size="sm" onClick={() => void updateRequest(a.id, reviewAction('ADVANCE', true))} className="h-7 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-500">HR approve</Button><Button size="sm" variant="outline" onClick={() => void updateRequest(a.id, reviewAction('ADVANCE', false))} className="h-7 border-rose-400/30 px-2 text-[10px] text-rose-300">Reject</Button></div>}
                          {a.rejectionReason && <p className="mt-1 max-w-40 text-[10px] text-rose-300">{a.rejectionReason}</p>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Loan Modal */}
      <Dialog open={loanModalOpen} onOpenChange={setLoanModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-teal-400" />
              Issue Employee Loan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLoan} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={loanForm.staffId}
                onChange={(e) => setLoanForm({ ...loanForm, staffId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.department} - {e.position})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Principal Amount (NGN) *</label>
              <Input
                required
                type="number"
                placeholder="e.g. 200000"
                value={loanForm.principalAmount}
                onChange={(e) => setLoanForm({ ...loanForm, principalAmount: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Repayment Tenor (Months)</label>
              <Input
                type="number"
                min="1"
                max="24"
                value={loanForm.tenorMonths}
                onChange={(e) => setLoanForm({ ...loanForm, tenorMonths: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Reason / Purpose</label>
              <Input
                placeholder="Loan purpose / approval justification"
                value={loanForm.reason}
                onChange={(e) => setLoanForm({ ...loanForm, reason: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setLoanModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Issuing…' : 'Issue Loan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Advance Modal */}
      <Dialog open={advanceModalOpen} onOpenChange={setAdvanceModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-400" />
              Request Salary Advance
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAdvance} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={advanceForm.staffId}
                onChange={(e) => setAdvanceForm({ ...advanceForm, staffId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.department} - {e.position})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Advance Amount (NGN) *</label>
              <Input
                required
                type="number"
                placeholder="e.g. 50000"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Reason</label>
              <Input
                placeholder="Urgent family / medical expense"
                value={advanceForm.reason}
                onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAdvanceModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Submitting…' : 'Submit Advance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
