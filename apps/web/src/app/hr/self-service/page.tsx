'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  CalendarCheck2,
  CalendarRange,
  Clock,
  Download,
  Receipt,
  Printer,
  ShieldCheck,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
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

export default function EmployeeSelfServicePage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected Payslip for printable view
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  // Leave Request Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    daysRequested: '1',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchSelfServiceData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/self-service');
      if (res.ok) {
        const json = await res.json();
        setData(json.staff);
      }
    } catch (err) {
      console.error('Failed to load ESS data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelfServiceData();
  }, []);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.id) return;
    setSubmitting(true);
    try {
      // Fetch a default leave type
      const ltRes = await fetch('/api/hr/leave');
      const ltJson = await ltRes.json();
      const firstType = ltJson.leaveTypes?.[0]?.id;

      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY_LEAVE',
          staffId: data.id,
          leaveTypeId: firstType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          daysRequested: leaveForm.daysRequested,
          reason: leaveForm.reason,
        }),
      });

      if (res.ok) {
        setLeaveModalOpen(false);
        fetchSelfServiceData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Loading your employee portal…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">No Linked Employee Record</h2>
        <p className="text-xs text-slate-400 mt-1">
          Your user login is not yet linked to an active employee profile in LodgeCore HR. Contact your HR Manager to configure your staff profile.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-800/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-teal-950">
              {data.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{data.name}</h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {data.employeeCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.position} • {data.department}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Member of staff since {new Date(data.hireDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setLeaveModalOpen(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              Request Leave
            </Button>
          </div>
        </div>
      </div>

      {/* Grid: Shifts, Leave Balances, Statutory Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Upcoming Duty Shifts */}
        <div className="bg-[#090e17] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <CalendarRange className="w-4 h-4" />
            My Upcoming Shifts
          </h3>
          {data.upcomingShifts?.length > 0 ? (
            <div className="space-y-2">
              {data.upcomingShifts.map((s: any) => (
                <div key={s.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-[10px] text-slate-400">{s.shiftName}</p>
                  </div>
                  <span className="font-mono text-[10px] text-teal-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    {s.times}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">No shifts scheduled for this week.</p>
          )}
        </div>

        {/* Leave Balances */}
        <div className="bg-[#090e17] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <CalendarCheck2 className="w-4 h-4" />
            My Leave Balances
          </h3>
          {data.leaveBalances?.length > 0 ? (
            <div className="space-y-3">
              {data.leaveBalances.map((lb: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{lb.leaveType}</span>
                  <div className="text-right">
                    <span className="text-base font-bold text-emerald-400">{lb.remaining} days</span>
                    <span className="text-[10px] text-slate-500 block">of {lb.allocated} allocated</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Annual Statutory Leave</span>
              <div className="text-right">
                <span className="text-base font-bold text-emerald-400">20 days</span>
                <span className="text-[10px] text-slate-500 block">Annual entitlement</span>
              </div>
            </div>
          )}
        </div>

        {/* Statutory & Bank IDs */}
        <div className="bg-[#090e17] border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            Disbursement &amp; Pension IDs
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">BANK ACCOUNT</span>
              <p className="font-semibold text-white">{data.bankName}</p>
              <p className="font-mono text-slate-400 text-[11px]">{data.bankAccountNumber || 'Not configured'}</p>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">PENSION RSA PIN</span>
              <p className="font-semibold text-white">{data.pfaName}</p>
              <p className="font-mono text-slate-400 text-[11px]">{data.rsaPin || 'Not registered'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payslips Section */}
      <div className="bg-[#090e17] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal-400" />
            My Recent Payslips &amp; Salary History
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Gross Earnings</th>
                <th className="py-3 px-4">Deductions (PAYE/Pension)</th>
                <th className="py-3 px-4">Net Salary Paid</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.payslips?.length > 0 ? (
                data.payslips.map((ps: any) => (
                  <tr key={ps.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-white">{ps.periodName}</td>
                    <td className="py-3 px-4 font-mono">₦{ps.grossPay?.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-amber-400">-₦{ps.deductions?.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">₦{ps.netPay?.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {ps.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPayslip({ ...ps, name: data.name, employeeCode: data.employeeCode, department: data.department, position: data.position, bankName: data.bankName });
                          setPayslipModalOpen(true);
                        }}
                        className="text-teal-400 hover:text-teal-300 text-xs h-7 px-2"
                      >
                        View &amp; Print Payslip &rarr;
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No historical payslips generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Payslip Modal */}
      <Dialog open={payslipModalOpen} onOpenChange={setPayslipModalOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden">
          {selectedPayslip && (
            <div>
              <div className="p-6 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">LODGECORE PMS</h2>
                    <p className="text-[10px] text-teal-400 uppercase tracking-widest font-semibold">Official Payslip</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{selectedPayslip.periodName}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EMPLOYEE NAME</span>
                    <p className="font-bold text-white">{selectedPayslip.name}</p>
                    <p className="text-[10px] text-slate-400">{selectedPayslip.employeeCode}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">DEPARTMENT / ROLE</span>
                    <p className="font-medium text-slate-200">{selectedPayslip.position}</p>
                    <p className="text-[10px] text-slate-400">{selectedPayslip.department}</p>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400 mb-2">Earnings</h4>
                  <div className="space-y-1.5 border-b border-slate-800 pb-3">
                    {selectedPayslip.components?.filter((c: any) => c.type === 'EARNING').map((c: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-300">{c.name}</span>
                        <span className="font-mono text-white">₦{c.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 font-bold">
                      <span className="text-slate-200">Gross Earnings</span>
                      <span className="font-mono text-white">₦{selectedPayslip.grossPay?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Deductions</h4>
                  <div className="space-y-1.5 border-b border-slate-800 pb-3">
                    {selectedPayslip.components?.filter((c: any) => c.type === 'DEDUCTION').map((c: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-300">{c.name}</span>
                        <span className="font-mono text-amber-400">-₦{c.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 font-bold">
                      <span className="text-slate-200">Total Deductions</span>
                      <span className="font-mono text-amber-400">-₦{selectedPayslip.deductions?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Net Salary Paid</span>
                    <p className="text-[10px] text-slate-400">Account: {selectedPayslip.bankName}</p>
                  </div>
                  <span className="text-xl font-bold font-mono text-emerald-300">
                    ₦{selectedPayslip.netPay?.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8 gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Payslip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Application Modal */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-teal-400" />
              Submit Leave Application
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Start Date *</label>
                <Input
                  type="date"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">End Date *</label>
                <Input
                  type="date"
                  required
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Days Requested</label>
              <Input
                type="number"
                min="1"
                value={leaveForm.daysRequested}
                onChange={(e) => setLeaveForm({ ...leaveForm, daysRequested: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Reason / Handover Note</label>
              <Input
                placeholder="Reason for absence and relief handover"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setLeaveModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Submitting…' : 'Submit Application'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
