'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  DollarSign,
  FileText,
  CreditCard,
  Building2,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Receipt,
  Printer,
  Sparkles,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PayrollPage() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Batch for Drawer
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<any | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Payslip Modal
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  // Launch Batch Modal
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchMonth, setLaunchMonth] = useState(String(new Date().getMonth() + 1));
  const [launchYear, setLaunchYear] = useState(String(new Date().getFullYear()));
  const [submitting, setSubmitting] = useState(false);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/payroll');
      if (res.ok) {
        const data = await res.json();
        setPeriods(data.periods || []);
      }
    } catch (err) {
      console.error('Failed to load payroll periods', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const openBatchDetails = async (id: string) => {
    setSelectedPeriodId(id);
    setDrawerOpen(true);
    setBatchLoading(true);
    try {
      const res = await fetch(`/api/hr/payroll/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBatchDetail(data.period);
      }
    } catch (err) {
      console.error('Failed to fetch batch detail', err);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleLaunchPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: launchMonth, year: launchYear }),
      });
      if (res.ok) {
        setLaunchModalOpen(false);
        fetchPeriods();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to calculate payroll');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveBatch = async () => {
    if (!selectedPeriodId) return;
    try {
      const res = await fetch(`/api/hr/payroll/${selectedPeriodId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (res.ok) {
        openBatchDetails(selectedPeriodId);
        fetchPeriods();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisburseAndPostGL = async () => {
    if (!selectedPeriodId) return;
    if (!confirm('Are you sure you want to post the payroll accrual to the General Ledger and create an internal payment instruction? Bank settlement is a separate step.')) {
      return;
    }
    try {
      const res = await fetch(`/api/hr/payroll/${selectedPeriodId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DISBURSE_AND_POST_GL' }),
      });
      if (res.ok) {
        alert('Payroll posted to the General Ledger. Bank settlement is still required.');
        openBatchDetails(selectedPeriodId);
        fetchPeriods();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to post to General Ledger');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReconcileProvider = async () => {
    if (!selectedPeriodId) return;
    try {
      const res = await fetch(`/api/hr/payroll/${selectedPeriodId}/flutterwave/reconcile`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to reconcile provider payouts');
      alert(`Reconciled ${data.reconciled || 0} provider payout(s).`);
      openBatchDetails(selectedPeriodId);
      fetchPeriods();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to reconcile provider payouts');
    }
  };

  const handleRecordSettlement = async () => {
    if (!selectedPeriodId) return;
    const settlementRef = window.prompt('Enter the bank settlement reference:');
    if (!settlementRef?.trim()) return;
    const notes = window.prompt('Settlement notes (optional):') || undefined;
    try {
      const res = await fetch(`/api/hr/payroll/${selectedPeriodId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RECORD_PAYMENT_SETTLEMENT', settlementRef: settlementRef.trim(), notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to record settlement');
      alert('Bank settlement recorded and payslips marked paid.');
      openBatchDetails(selectedPeriodId);
      fetchPeriods();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to record settlement');
    }
  };

  const handleReversePayroll = async () => {
    if (!selectedPeriodId) return;
    const reason = window.prompt('Enter a detailed reason for reversing this posted payroll (minimum 10 characters):');
    if (!reason?.trim() || reason.trim().length < 10) return;
    if (!confirm('This will create a reversing GL journal and cancel the payroll batch. Continue?')) return;
    try {
      const res = await fetch(`/api/hr/payroll/${selectedPeriodId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to reverse payroll');
      alert('Payroll reversed with a compensating GL journal.');
      openBatchDetails(selectedPeriodId);
      fetchPeriods();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to reverse payroll');
    }
  };

  // Grand stats from latest batch
  const latestBatch = periods[0] || null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-teal-400" />
            Statutory Payroll &amp; Compensation Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic Nigerian tax engine (PITA/CRA), Pension Reform 2014, NHF, NSITF, ITF, and automated GL journals.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setLaunchModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Run Monthly Payroll Batch
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Gross Payroll</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white truncate">
              ₦{latestBatch ? Number(latestBatch.totalGross).toLocaleString('en-NG') : '0'}
            </span>
            <DollarSign className="w-4 h-4 text-teal-400 shrink-0" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Latest period gross sum</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Net Disbursable</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-400 truncate">
              ₦{latestBatch ? Number(latestBatch.totalNet).toLocaleString('en-NG') : '0'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Take-home salary transfer</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Statutory Deductions</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-amber-400 truncate">
              ₦{latestBatch ? Number(latestBatch.totalDeductions).toLocaleString('en-NG') : '0'}
            </span>
            <Receipt className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">PAYE + Pension + NHF</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Employer On-Cost</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-cyan-300 truncate">
              ₦{latestBatch ? Number(latestBatch.totalEmployerCost).toLocaleString('en-NG') : '0'}
            </span>
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Gross + Pension 10% + NSITF + ITF</span>
        </div>
      </div>

      {/* Payroll Batches Table */}
      <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal-400" />
            Payroll Batch History
          </h3>
          <span className="text-xs text-slate-500">{periods.length} Payroll Runs Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Staff Count</th>
                <th className="py-3 px-4">Gross Salaries</th>
                <th className="py-3 px-4">Total Deductions</th>
                <th className="py-3 px-4">Net Payout</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading payroll history…
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No payroll batches created yet. Click &ldquo;Run Monthly Payroll Batch&rdquo; to start.
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openBatchDetails(p.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-white">{p.name}</td>
                    <td className="py-3.5 px-4 text-slate-400">{p.propertyName}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{p.employeeCount} staff</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                      ₦{Number(p.totalGross).toLocaleString('en-NG')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-amber-400">
                      ₦{Number(p.totalDeductions).toLocaleString('en-NG')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      ₦{Number(p.totalNet).toLocaleString('en-NG')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          p.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : p.status === 'APPROVED'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-teal-400 hover:text-teal-300 text-xs h-7 px-2"
                      >
                        Inspect &rarr;
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Details Slideout Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-3xl bg-[#080d16] border-slate-800 text-slate-100 p-0 overflow-y-auto">
          {batchLoading || !batchDetail ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading batch details…</div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 bg-[#060a12]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {batchDetail.status}
                    </span>
                    <h2 className="text-lg font-bold text-white mt-2">{batchDetail.name}</h2>
                    <p className="text-xs text-slate-400">{batchDetail.propertyName}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-slate-800 text-slate-300 hover:text-white text-xs h-8 gap-1.5"
                    >
                      <a href={`/api/hr/payroll/${batchDetail.id}/export`} download>
                        <Download className="w-3.5 h-3.5" />
                        NIP Bank CSV
                      </a>
                    </Button>

                    {batchDetail.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        onClick={handleApproveBatch}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8"
                      >
                        Approve Batch
                      </Button>
                    )}

                    {batchDetail.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        onClick={handleDisburseAndPostGL}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                      >
                        Disburse &amp; Post to GL
                      </Button>
                    )}

                    {batchDetail.status === 'PROCESSING' && batchDetail.paymentStatus !== 'SETTLED' && (
                      <>
                        <Button size="sm" variant="outline" onClick={handleReconcileProvider} className="border-slate-800 text-slate-300 hover:text-white text-xs h-8">
                          Reconcile payouts
                        </Button>
                        <Button size="sm" onClick={handleRecordSettlement} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                          Record bank settlement
                        </Button>
                      </>
                    )}

                    {['PROCESSING', 'PAID'].includes(batchDetail.status) && (
                      <Button size="sm" variant="outline" onClick={handleReversePayroll} className="border-rose-400/30 text-rose-300 hover:text-rose-200 text-xs h-8">
                        Reverse payroll
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="p-6 space-y-6 flex-1">
                {/* Financial Summary Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500">Total Gross</span>
                    <p className="text-base font-bold text-white">₦{batchDetail.totalGross?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Net Payout</span>
                    <p className="text-base font-bold text-emerald-400">₦{batchDetail.totalNet?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">PAYE Tax Liability</span>
                    <p className="text-base font-bold text-amber-400">₦{batchDetail.totalPaye?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Pension (18%)</span>
                    <p className="text-base font-bold text-cyan-300">
                      ₦{((batchDetail.totalEmployeePension || 0) + (batchDetail.totalEmployerPension || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Statutory Remittance Breakdown */}
                <div className="bg-[#090e17] border border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                    Statutory Remittance Schedule (Nigeria)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500">State Internal Revenue (PAYE)</span>
                      <p className="font-bold text-white mt-1">₦{batchDetail.totalPaye?.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500">PFA Pension (Employee 8% + Employer 10%)</span>
                      <p className="font-bold text-white mt-1">
                        ₦{((batchDetail.totalEmployeePension || 0) + (batchDetail.totalEmployerPension || 0)).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500">Federal Mortgage Bank (NHF 2.5%)</span>
                      <p className="font-bold text-white mt-1">₦{batchDetail.totalNhf?.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500">NSITF (1% Employer Cost)</span>
                      <p className="font-bold text-white mt-1">₦{batchDetail.totalNsitf?.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500">ITF (1% Employer Cost)</span>
                      <p className="font-bold text-white mt-1">₦{batchDetail.totalItf?.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500">Total Employer Real Cost</span>
                      <p className="font-bold text-cyan-400 mt-1">₦{batchDetail.totalEmployerCost?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Payslips Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Staff Payslips Breakdown ({batchDetail.payslips?.length || 0})
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#060a12] border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Gross</th>
                          <th className="py-2.5 px-3">Deductions</th>
                          <th className="py-2.5 px-3">Net Pay</th>
                          <th className="py-2.5 px-3 text-right">Payslip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {batchDetail.payslips?.map((ps: any) => (
                          <tr key={ps.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-white">{ps.name}</p>
                              <p className="text-[10px] text-slate-500">{ps.employeeCode} • {ps.position}</p>
                            </td>
                            <td className="py-2.5 px-3 font-mono">₦{ps.grossPay?.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono text-amber-400">₦{ps.deductions?.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">₦{ps.netPay?.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedPayslip({ ...ps, periodName: batchDetail.name });
                                  setPayslipModalOpen(true);
                                }}
                                className="text-teal-400 hover:text-teal-300 text-xs h-6 px-2"
                              >
                                View Payslip
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Printable Individual Payslip Modal */}
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

              {/* Earnings & Deductions Breakdown */}
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

                {/* Net Pay Box */}
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Net Salary Payable</span>
                    <p className="text-[10px] text-slate-400">Transferred to {selectedPayslip.bankName}</p>
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

      {/* Launch Payroll Batch Modal */}
      <Dialog open={launchModalOpen} onOpenChange={setLaunchModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-400" />
              Launch Monthly Payroll Batch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLaunchPayroll} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Payroll Month *</label>
                <select
                  value={launchMonth}
                  onChange={(e) => setLaunchMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Payroll Year *</label>
                <Input
                  type="number"
                  value={launchYear}
                  onChange={(e) => setLaunchYear(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-slate-400 text-[11px]">
              <span className="font-bold text-teal-400 block">Automatic Compliance Computations:</span>
              <p>• PITA Consolidated Relief Allowance (CRA ₦200k/1% + 20%)</p>
              <p>• Graduated Personal Income Tax Brackets (7% to 24%)</p>
              <p>• Pension Reform Act 2014 (8% Employee / 10% Employer)</p>
              <p>• National Housing Fund (2.5% Basic)</p>
              <p>• NSITF &amp; Industrial Training Fund (1% + 1% Employer)</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setLaunchModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Calculating Batch…' : 'Execute Payroll Calculation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
