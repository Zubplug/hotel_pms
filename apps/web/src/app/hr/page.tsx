'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Calculator,
  CalendarRange,
  CalendarCheck2,
  Briefcase,
  Award,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Building2,
  DollarSign,
  Download,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HrDashboardPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [empRes, payRes, attRes, leaveRes, recRes] = await Promise.all([
        fetch('/api/hr/employees?limit=200'),
        fetch('/api/hr/payroll'),
        fetch(`/api/hr/attendance?date=${today}`),
        fetch('/api/hr/leave'),
        fetch('/api/hr/recruitment'),
      ]);

      if (empRes.ok) {
        const d = await empRes.json();
        setEmployees(d.employees || []);
      }
      if (payRes.ok) {
        const d = await payRes.json();
        setPeriods(d.periods || []);
      }
      if (attRes.ok) {
        const d = await attRes.json();
        setAttendance(d.records || []);
      }
      if (leaveRes.ok) {
        const d = await leaveRes.json();
        setLeaves(d.applications || []);
      }
      if (recRes.ok) {
        const d = await recRes.json();
        setVacancies(d.vacancies || []);
      }
    } catch (err) {
      console.error('Failed to load HR dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalEmployees = employees.length;
  const activeStaff = employees.filter((e) => e.status === 'ACTIVE').length;
  const onDutyToday = attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING').length;
  const openVacancies = vacancies.filter((v) => v.status === 'OPEN').length;

  const latestBatch = periods[0] || null;
  const currentGross = latestBatch ? Number(latestBatch.totalGross) : 0;
  const currentNet = latestBatch ? Number(latestBatch.totalNet) : 0;

  // Compliance completeness metric (% of employees with NIN, Tax ID, Pension PIN, Bank info)
  const compliantStaff = employees.filter(
    (e) => e.profile?.nin && e.profile?.taxId && e.profile?.bankAccountNumber
  ).length;
  const complianceScore = totalEmployees > 0 ? Math.round((compliantStaff / totalEmployees) * 100) : 100;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Executive Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Executive HR &amp; Payroll Suite
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">Hospitality People Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Human Resources Management Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time workforce intelligence, 24/7 hotel duty rosters, Nigerian statutory payroll compliance, and talent lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            asChild
            className="bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs h-9 gap-1.5 shadow-lg shadow-teal-950"
          >
            <Link href="/hr/payroll">
              <Calculator className="w-3.5 h-3.5" />
              Manage Payroll
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            asChild
            className="border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white text-xs h-9 gap-1.5"
          >
            <Link href="/hr/employees">
              <Users className="w-3.5 h-3.5" />
              Employee Directory
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workforce */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-colors shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Workforce</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white">{totalEmployees}</span>
            <span className="text-xs text-slate-500 ml-2">Employees</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Active on duty:</span>
            <strong className="text-emerald-400 font-semibold">{onDutyToday} staff</strong>
          </div>
        </div>

        {/* Current Monthly Payroll */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-colors shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payroll Gross Sum</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white truncate">
              ₦{currentGross.toLocaleString('en-NG')}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Net Disbursable:</span>
            <strong className="text-emerald-400 font-semibold">₦{currentNet.toLocaleString('en-NG')}</strong>
          </div>
        </div>

        {/* Pending Leave Requests */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-colors shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Leaves</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-400">{pendingLeaves}</span>
            <span className="text-xs text-slate-500 ml-2">Awaiting decision</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Action Required:</span>
            <Link href="/hr/leave" className="text-teal-400 hover:underline font-medium">
              Review queue &rarr;
            </Link>
          </div>
        </div>

        {/* Statutory Compliance Index */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-colors shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compliance Index</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-400">{complianceScore}%</span>
            <span className="text-xs text-slate-500 ml-2">Verified IDs</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Open Job Vacancies:</span>
            <strong className="text-cyan-400 font-semibold">{openVacancies} Openings</strong>
          </div>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Link
          href="/hr/employees?action=new"
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">Add Employee</h4>
            <p className="text-[10px] text-slate-500">Register new hire</p>
          </div>
        </Link>

        <Link
          href="/hr/payroll?action=new"
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">Run Payroll</h4>
            <p className="text-[10px] text-slate-500">Execute monthly run</p>
          </div>
        </Link>

        <Link
          href="/hr/shift-planning"
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">Shift Rosters</h4>
            <p className="text-[10px] text-slate-500">24/7 duty matrix</p>
          </div>
        </Link>

        <Link
          href="/hr/recruitment"
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">Talent ATS</h4>
            <p className="text-[10px] text-slate-500">Recruitment pipeline</p>
          </div>
        </Link>
      </div>

      {/* Two Column Layout: Compliance & Recent Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Statutory Compliance Dashboard (2 cols) */}
        <div className="lg:col-span-2 bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                Nigerian Statutory Compliance Status
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Automated payroll withholding &amp; remittable liability tracker</p>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              PITA &amp; PRA 2014 Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">State IRS (PAYE Tax)</span>
              <p className="text-lg font-bold text-white">7% - 24%</p>
              <p className="text-[10px] text-slate-400">Consolidated Relief (CRA) applied deterministically</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Pension Reform 2014</span>
              <p className="text-lg font-bold text-teal-400">8% / 10%</p>
              <p className="text-[10px] text-slate-400">Employee 8% deduction + Employer 10% on-cost</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Housing (NHF) &amp; NSITF</span>
              <p className="text-lg font-bold text-cyan-400">2.5% / 1.0%</p>
              <p className="text-[10px] text-slate-400">Federal Mortgage Bank &amp; Employees Compensation</p>
            </div>
          </div>

          {/* Quick Table: Active Workforce Sample */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Staff Registry Snapshot</span>
              <Link href="/hr/employees" className="text-xs text-teal-400 hover:underline">
                View all {totalEmployees} &rarr;
              </Link>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Position</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {employees.slice(0, 5).map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-white">{e.name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{e.department}</td>
                      <td className="py-2.5 px-3 text-slate-300">{e.position}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Module Shortcuts & Quick Stats */}
        <div className="space-y-5">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Department Operations
            </h3>
            <div className="space-y-2">
              <Link
                href="/hr/organization"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-white">Org Structure &amp; Sections</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>

              <Link
                href="/hr/attendance"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-white">Punch Clock &amp; Timesheets</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>

              <Link
                href="/hr/benefits"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-white">Staff Loans &amp; Advances</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>

              <Link
                href="/hr/performance"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-white">Performance Appraisals</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>

              <Link
                href="/hr/self-service"
                className="flex items-center justify-between p-3 rounded-xl bg-teal-950/20 border border-teal-800/30 hover:border-teal-700/50 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-teal-400" />
                  <span className="font-semibold text-teal-300">My Self-Service Portal</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
