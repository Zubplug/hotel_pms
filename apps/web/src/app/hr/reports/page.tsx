'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileText,
  DollarSign,
  Users,
  ShieldCheck,
  Building2,
  Clock,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HrReportsPage() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      fetch('/api/hr/payroll').then((r) => r.json()),
      fetch('/api/hr/employees?limit=200').then((r) => r.json()),
      fetch(`/api/hr/attendance?date=${today}`).then((r) => r.json()),
      fetch('/api/hr/leave').then((r) => r.json()),
    ]).then(([payData, empData, attendanceData, leaveData]) => {
      setPeriods(payData.periods || []);
      setEmployees(empData.employees || []);
      setAttendance(attendanceData.records || []);
      setLeaveApplications(leaveData.applications || []);
      if (payData.periods?.length > 0) {
        setSelectedPeriod(payData.periods[0].id);
      }
    });
  }, []);

  const handleDownloadCsv = (reportName: string, headers: string[], rows: any[][]) => {
    const csvCell = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportStatutorySchedule = async () => {
    if (!selectedPeriod) return;
    const response = await fetch(`/api/hr/payroll/${selectedPeriod}/statutory-export`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to export statutory schedule' }));
      alert(error.error || 'Failed to export statutory schedule');
      return;
    }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Statutory_Remittances_${selectedPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportHeadcountReport = () => {
    const headers = ['Employee Code', 'Full Name', 'Department', 'Position', 'Status', 'Employment Type', 'Hire Date'];
    const rows = employees.map((e) => [
      e.employeeCode,
      e.name,
      e.department,
      e.position,
      e.status,
      e.employmentType,
      e.hireDate ? new Date(e.hireDate).toLocaleDateString() : '',
    ]);
    handleDownloadCsv('Headcount_Staff_Report', headers, rows);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            HR &amp; Statutory Compliance Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Official monthly tax schedules, pension remittance summaries, payroll reconciliations, and workforce analytics.
          </p>
        </div>
      </div>

      {/* Reports Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Report 1: Statutory Remittance Schedule */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Statutory Remittance Schedule</h3>
            <p className="text-xs text-slate-400">
              State Internal Revenue (PAYE), Pension PFA contributions (8% + 10%), NHF, NSITF, and ITF liabilities.
            </p>
          </div>
          <Button
            size="sm"
            onClick={exportStatutorySchedule}
            className="w-full bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs h-8 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Statutory CSV
          </Button>
        </div>

        {/* Report 2: Headcount & Organization Directory */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Workforce Headcount Master</h3>
            <p className="text-xs text-slate-400">
              Full employee audit across all hotel departments, job positions, employment status, and hire dates.
            </p>
          </div>
          <Button
            size="sm"
            onClick={exportHeadcountReport}
            className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs h-8 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Headcount CSV
          </Button>
        </div>

        {/* Report 3: Monthly Bank Payment Schedule */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">NIP Bank Payment Schedule</h3>
            <p className="text-xs text-slate-400">
              CBN-compliant electronic disbursement schedule formatted for corporate internet banking bulk upload.
            </p>
          </div>
          {periods.length > 0 ? (
            <Button
              size="sm"
              asChild
              className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs h-8 gap-1.5"
            >
              <a href={`/api/hr/payroll/${periods[0].id}/export`} download>
                <Download className="w-3.5 h-3.5" />
                Download NIP Schedule
              </a>
            </Button>
          ) : (
            <p className="text-xs text-slate-500 text-center py-1">No payroll batch available</p>
          )}
        </div>

        {/* Report 4: Attendance & Overtime Register */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Timesheet &amp; Overtime Log</h3>
            <p className="text-xs text-slate-400">
              Punch-in records, night audit shifts, late exceptions, and total overtime hours accrued for payroll.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const headers = ['Staff Name', 'Department', 'Date', 'Clock In', 'Clock Out', 'Status', 'Overtime Hours'];
              const rows = attendance.map((record) => [
                record.staffName,
                record.department,
                record.date ? new Date(record.date).toLocaleDateString() : '',
                record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '',
                record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '',
                record.status,
                record.overtimeHours ?? 0,
              ]);
              handleDownloadCsv('Attendance_Overtime_Log', headers, rows);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs h-8 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Timesheet CSV
          </Button>
        </div>

        {/* Report 5: Leave Balances & Liability */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Leave Liability &amp; Accrual</h3>
            <p className="text-xs text-slate-400">
              Annual leave entitlements, days utilized, pending balances, and monetary liability valuation.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const headers = ['Staff Name', 'Leave Type', 'Start Date', 'End Date', 'Total Days', 'Status'];
              const rows = leaveApplications.map((application) => [
                application.staffName,
                application.leaveTypeName,
                application.startDate ? new Date(application.startDate).toLocaleDateString() : '',
                application.endDate ? new Date(application.endDate).toLocaleDateString() : '',
                application.daysRequested,
                application.status,
              ]);
              handleDownloadCsv('Leave_Liability_Statement', headers, rows);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs h-8 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Leave CSV
          </Button>
        </div>

        {/* Report 6: General Ledger Payroll Reconciliation */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">General Ledger Payroll Journal</h3>
            <p className="text-xs text-slate-400">
              Balanced double-entry journal lines (Expense Accounts 6000-6030 vs Liability Accounts 2100-2150).
            </p>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              if (!selectedPeriod) return;
              const response = await fetch(`/api/hr/payroll/${selectedPeriod}`);
              if (!response.ok) {
                alert('Unable to retrieve the selected payroll journal data');
                return;
              }
              const data = await response.json();
              const period = data.period || {};
              const headers = ['Metric', 'Amount (NGN)', 'Journal Entry ID', 'Payroll Period'];
              const rows = [
                ['Gross payroll', period.totalGross, period.journalEntryId || '', period.name || ''],
                ['Net salaries payable', period.totalNet, period.journalEntryId || '', period.name || ''],
                ['PAYE payable', period.totalPaye, period.journalEntryId || '', period.name || ''],
                ['Employee pension payable', period.totalEmployeePension, period.journalEntryId || '', period.name || ''],
                ['Employer pension expense', period.totalEmployerPension, period.journalEntryId || '', period.name || ''],
                ['NHF payable', period.totalNhf, period.journalEntryId || '', period.name || ''],
                ['NSITF expense', period.totalNsitf, period.journalEntryId || '', period.name || ''],
                ['ITF expense', period.totalItf, period.journalEntryId || '', period.name || ''],
              ];
              handleDownloadCsv('General_Ledger_Payroll_Reconciliation', headers, rows);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs h-8 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download GL Journal CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
