'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  Users,
  Timer,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
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

export default function AttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Manual Punch Modal
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [punchForm, setPunchForm] = useState({
    staffId: '',
    shiftId: '',
    date: new Date().toISOString().split('T')[0],
    clockIn: '08:00',
    clockOut: '17:00',
    status: 'PRESENT',
    totalHours: '8',
    overtimeHours: '0',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, empRes, shiftRes] = await Promise.all([
        fetch(`/api/hr/attendance?date=${selectedDate}`),
        fetch('/api/hr/employees?limit=200'),
        fetch('/api/hr/shifts'),
      ]);

      if (attRes.ok) {
        const attData = await attRes.json();
        setRecords(attData.records || []);
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        setShifts(shiftData.shiftTemplates || []);
      }
    } catch (err) {
      console.error('Failed to load attendance records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleRecordPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const clockInDate = `${punchForm.date}T${punchForm.clockIn}:00`;
      const clockOutDate = punchForm.clockOut ? `${punchForm.date}T${punchForm.clockOut}:00` : null;

      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANUAL_PUNCH',
          staffId: punchForm.staffId,
          shiftId: punchForm.shiftId || null,
          date: punchForm.date,
          clockIn: clockInDate,
          clockOut: clockOutDate,
          status: punchForm.status,
          totalHours: punchForm.totalHours,
          overtimeHours: punchForm.overtimeHours,
          notes: punchForm.notes,
        }),
      });

      if (res.ok) {
        setPunchModalOpen(false);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        !search ||
        r.staffName.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = selectedStatus === 'ALL' || r.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [records, search, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const totalOT = records.reduce((sum, r) => sum + (Number(r.overtimeHours) || 0), 0);
    return { present, late, absent, totalOT };
  }, [records]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-teal-400" />
            24/7 Attendance Register &amp; Timesheets
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time biometric punch logs, overtime hours, hospitality break tracking, and exception regularizations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border-slate-800 text-slate-200 text-xs h-9 w-auto"
          />
          <Button
            size="sm"
            onClick={() => setPunchModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Manual Punch Clock
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">On Duty (Present)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{stats.present}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Clocked in today</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Late Arrivals</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{stats.late}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Past shift grace window</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Absent / Unreported</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">{stats.absent}</span>
            <Users className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">No punch recorded</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accrued Overtime</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-cyan-300">{stats.totalOT} hrs</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Eligible for payroll overtime</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search employee or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-500 text-xs h-9"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-3 h-9 outline-none focus:border-teal-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>
      </div>

      {/* Attendance Register Table */}
      <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department &amp; Position</th>
                <th className="py-3 px-4">Scheduled Shift</th>
                <th className="py-3 px-4">Punch In</th>
                <th className="py-3 px-4">Punch Out</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4">Overtime</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Loading attendance entries…
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No attendance records for {new Date(selectedDate).toLocaleDateString()}. Use &ldquo;Manual Punch Clock&rdquo; to add entries.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-white">{r.staffName}</td>
                    <td className="py-3 px-4">
                      <p className="text-slate-200">{r.position}</p>
                      <p className="text-[10px] text-slate-500">{r.department}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300">{r.shiftName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{r.shiftTimes}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-teal-400">
                      {r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{r.totalHours}h</td>
                    <td className="py-3 px-4 text-cyan-300 font-mono">
                      {r.overtimeHours > 0 ? `+${r.overtimeHours}h` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : r.status === 'LATE'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-slate-400">{r.punchSource}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Punch Modal */}
      <Dialog open={punchModalOpen} onOpenChange={setPunchModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Record Attendance Punch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPunch} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={punchForm.staffId}
                onChange={(e) => setPunchForm({ ...punchForm, staffId: e.target.value })}
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
              <label className="text-slate-400 block mb-1">Shift Template</label>
              <select
                value={punchForm.shiftId}
                onChange={(e) => setPunchForm({ ...punchForm, shiftId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Default Hotel Shift</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime} - {s.endTime})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Clock In Time</label>
                <Input
                  type="time"
                  value={punchForm.clockIn}
                  onChange={(e) => setPunchForm({ ...punchForm, clockIn: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Clock Out Time</label>
                <Input
                  type="time"
                  value={punchForm.clockOut}
                  onChange={(e) => setPunchForm({ ...punchForm, clockOut: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Total Hours</label>
                <Input
                  type="number"
                  value={punchForm.totalHours}
                  onChange={(e) => setPunchForm({ ...punchForm, totalHours: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Overtime Hrs</label>
                <Input
                  type="number"
                  value={punchForm.overtimeHours}
                  onChange={(e) => setPunchForm({ ...punchForm, overtimeHours: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Status</label>
                <select
                  value={punchForm.status}
                  onChange={(e) => setPunchForm({ ...punchForm, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2 h-8 outline-none"
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                </select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPunchModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : 'Record Punch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
