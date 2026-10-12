'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck2,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Users,
  Search,
  Filter,
  AlertTriangle,
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

export default function LeaveManagementPage() {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [applyForm, setApplyForm] = useState({
    staffId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    daysRequested: '1',
    reason: '',
  });

  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    daysPerYear: '20',
    isPaid: true,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leaveRes, empRes] = await Promise.all([
        fetch('/api/hr/leave'),
        fetch('/api/hr/employees?limit=200'),
      ]);

      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        setLeaveTypes(leaveData.leaveTypes || []);
        setApplications(leaveData.applications || []);
        setAllocations(leaveData.allocations || []);
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      console.error('Failed to load leave data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPLY_LEAVE', ...applyForm }),
      });
      if (res.ok) {
        setApplyModalOpen(false);
        setApplyForm({ staffId: '', leaveTypeId: '', startDate: '', endDate: '', daysRequested: '1', reason: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessLeave = async (applicationId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PROCESS_APPLICATION', applicationId, status }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_LEAVE_TYPE', ...typeForm }),
      });
      if (res.ok) {
        setTypeModalOpen(false);
        setTypeForm({ name: '', code: '', daysPerYear: '20', isPaid: true });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const pendingApps = applications.filter((a) => a.status === 'PENDING');
  const approvedApps = applications.filter((a) => a.status === 'APPROVED');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-teal-400" />
            Leave Policies &amp; Absence Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Annual statutory leave, sick days, maternity/paternity tracking, and multi-tier approval workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTypeModalOpen(true)}
            className="border-slate-800 bg-slate-900/60 text-slate-300 text-xs h-9 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Leave Policy
          </Button>
          <Button
            size="sm"
            onClick={() => setApplyModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Submit Leave Request
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending Approvals</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{pendingApps.length}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Requests requiring action</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Approved Leaves</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{approvedApps.length}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Granted time off</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Policy Categories</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-teal-400">{leaveTypes.length}</span>
            <Calendar className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Configured leave types</span>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-0.5">
          <TabsTrigger value="requests" className="text-xs">
            Leave Requests Queue ({pendingApps.length} pending)
          </TabsTrigger>
          <TabsTrigger value="balances" className="text-xs">
            Employee Leave Balances
          </TabsTrigger>
          <TabsTrigger value="policies" className="text-xs">
            Leave Policy Types
          </TabsTrigger>
        </TabsList>

        {/* Requests Table */}
        <TabsContent value="requests">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Loading requests…
                      </td>
                    </tr>
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        No leave applications submitted.
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{app.staffName}</p>
                          <p className="text-[10px] text-slate-500">{app.department} • {app.position}</p>
                        </td>
                        <td className="py-3 px-4 font-medium text-teal-400">{app.leaveTypeName}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {new Date(app.startDate).toLocaleDateString()} – {new Date(app.endDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{app.daysRequested}d</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{app.reason || 'None specified'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              app.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : app.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {app.status === 'PENDING' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleProcessLeave(app.id, 'APPROVED')}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] h-6 px-2"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleProcessLeave(app.id, 'REJECTED')}
                                className="border-slate-800 hover:bg-rose-950/40 text-rose-400 text-[10px] h-6 px-2"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Balances Table */}
        <TabsContent value="balances">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Policy</th>
                    <th className="py-3 px-4">Year</th>
                    <th className="py-3 px-4">Allocated</th>
                    <th className="py-3 px-4">Used</th>
                    <th className="py-3 px-4">Remaining Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        No balances recorded for current cycle.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((al) => (
                      <tr key={al.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{al.staffName}</td>
                        <td className="py-3 px-4 text-teal-400">{al.leaveTypeName}</td>
                        <td className="py-3 px-4 font-mono">{al.year}</td>
                        <td className="py-3 px-4 font-semibold">{al.allocatedDays}d</td>
                        <td className="py-3 px-4 text-slate-400">{al.usedDays}d</td>
                        <td className="py-3 px-4 font-bold text-emerald-400">{al.remainingDays}d</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Policies Catalog */}
        <TabsContent value="policies">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leaveTypes.map((lt) => (
              <div key={lt.id} className="bg-[#090e17] border border-slate-800/80 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    {lt.code}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400">
                    {lt.isPaid ? 'Paid Leave' : 'Unpaid Leave'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{lt.name}</h3>
                <p className="text-2xl font-bold text-slate-200">
                  {lt.daysPerYear} <span className="text-xs font-normal text-slate-400">days / year</span>
                </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                  Carry forward limit: {lt.carryForwardLimit || 0} days
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Leave Modal */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-teal-400" />
              Submit Leave Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={applyForm.staffId}
                onChange={(e) => setApplyForm({ ...applyForm, staffId: e.target.value })}
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
              <label className="text-slate-400 block mb-1">Leave Policy Type *</label>
              <select
                required
                value={applyForm.leaveTypeId}
                onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Leave Type</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.daysPerYear} days/yr)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Start Date *</label>
                <Input
                  type="date"
                  required
                  value={applyForm.startDate}
                  onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">End Date *</label>
                <Input
                  type="date"
                  required
                  value={applyForm.endDate}
                  onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Days Requested</label>
              <Input
                type="number"
                min="1"
                value={applyForm.daysRequested}
                onChange={(e) => setApplyForm({ ...applyForm, daysRequested: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Reason / Notes</label>
              <Input
                placeholder="Brief explanation for leave request"
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setApplyModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Submitting…' : 'Submit Leave'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Policy Modal */}
      <Dialog open={typeModalOpen} onOpenChange={setTypeModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400" />
              Configure Leave Policy
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateType} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Policy Name *</label>
              <Input
                required
                placeholder="e.g. Annual Leave, Casual Leave, Study Leave"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Code</label>
              <Input
                placeholder="e.g. AL, SL, ML"
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Annual Allocation (Days)</label>
              <Input
                type="number"
                min="1"
                value={typeForm.daysPerYear}
                onChange={(e) => setTypeForm({ ...typeForm, daysPerYear: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPaid"
                checked={typeForm.isPaid}
                onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="isPaid" className="text-slate-300 cursor-pointer">
                Paid Leave (Compensated at standard base salary)
              </label>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setTypeModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : 'Create Policy'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
