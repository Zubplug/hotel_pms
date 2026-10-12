'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarRange,
  Clock,
  Plus,
  Users,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  ChevronLeft,
  ChevronRight,
  Sparkles,
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

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShiftPlanningPage() {
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Week offset state (0 = current week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [assignForm, setAssignForm] = useState({
    staffId: '',
    shiftId: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    code: '',
    startTime: '07:00',
    endTime: '15:30',
    crossesMidnight: false,
    unpaidBreakMins: '30',
  });

  // Calculate current week dates
  const weekDates = useMemo(() => {
    const now = new Date();
    // Monday of current week
    const currentDay = now.getDay();
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const startDateStr = weekDates[0].toISOString().split('T')[0];
  const endDateStr = weekDates[6].toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, empRes] = await Promise.all([
        fetch(`/api/hr/shifts?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch('/api/hr/employees?limit=200'),
      ]);

      if (shiftsRes.ok) {
        const shiftsData = await shiftsRes.json();
        setShiftTemplates(shiftsData.shiftTemplates || []);
        setRosters(shiftsData.rosters || []);
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      console.error('Failed to load shift rosters', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [weekOffset]);

  const handleAssignRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ASSIGN_ROSTER', ...assignForm }),
      });
      if (res.ok) {
        setAssignModalOpen(false);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_TEMPLATE', ...templateForm }),
      });
      if (res.ok) {
        setTemplateModalOpen(false);
        setTemplateForm({
          name: '',
          code: '',
          startTime: '07:00',
          endTime: '15:30',
          crossesMidnight: false,
          unpaidBreakMins: '30',
        });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getRosterForCell = (staffId: string, date: Date) => {
    const targetDateStr = date.toISOString().split('T')[0];
    return rosters.find(
      (r) => r.staffId === staffId && new Date(r.date).toISOString().split('T')[0] === targetDateStr
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-teal-400" />
            24/7 Hotel Shift Rosters &amp; Scheduling
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Weekly departmental duty rosters, overnight rotations, shift swaps, and hotel staffing coverage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplateModalOpen(true)}
            className="border-slate-800 bg-slate-900/60 text-slate-300 text-xs h-9 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Shift Template
          </Button>
          <Button
            size="sm"
            onClick={() => setAssignModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Assign Shift Roster
          </Button>
        </div>
      </div>

      {/* Week Navigator & Templates */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setWeekOffset((p) => p - 1)}
            className="border-slate-800 bg-slate-950 text-slate-400 hover:text-white h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-slate-200 px-2">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setWeekOffset((p) => p + 1)}
            className="border-slate-800 bg-slate-950 text-slate-400 hover:text-white h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWeekOffset(0)}
              className="text-xs text-teal-400 hover:text-teal-300 h-8 px-2"
            >
              Current Week
            </Button>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 overflow-x-auto text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/80" /> Morning (M)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/80" /> Afternoon (A)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-indigo-500/80" /> Night (N)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-slate-700" /> Off
          </span>
        </div>
      </div>

      {/* 7-Day Weekly Grid Matrix */}
      <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">Employee / Role</th>
                {weekDates.map((d, i) => (
                  <th key={i} className="py-3 px-3 text-center min-w-[110px]">
                    <div className="font-bold text-white">{DAYS_OF_WEEK[i]}</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading weekly shift schedule…
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No active employees registered.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/20">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{emp.name}</p>
                      <p className="text-[10px] text-slate-500">{emp.department} • {emp.position}</p>
                    </td>

                    {weekDates.map((date, i) => {
                      const roster = getRosterForCell(emp.id, date);

                      return (
                        <td
                          key={i}
                          onClick={() => {
                            setAssignForm({
                              staffId: emp.id,
                              shiftId: shiftTemplates[0]?.id || '',
                              date: date.toISOString().split('T')[0],
                            });
                            setAssignModalOpen(true);
                          }}
                          className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-800/40 transition-colors"
                        >
                          {roster ? (
                            <div
                              className={`p-1.5 rounded-lg border text-[10px] font-bold ${
                                roster.crossesMidnight
                                  ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/60'
                                  : roster.shiftName?.toLowerCase().includes('morning')
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                  : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                              }`}
                            >
                              <div className="truncate">{roster.shiftName}</div>
                              <div className="text-[9px] font-mono opacity-80">
                                {roster.startTime} - {roster.endTime}
                              </div>
                            </div>
                          ) : (
                            <div className="p-1.5 rounded border border-dashed border-slate-800 text-[10px] text-slate-600 hover:border-slate-700 hover:text-slate-400">
                              + Assign
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Shift Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-teal-400" />
              Assign Shift Roster
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignRoster} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={assignForm.staffId}
                onChange={(e) => setAssignForm({ ...assignForm, staffId: e.target.value })}
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
              <label className="text-slate-400 block mb-1">Shift Schedule *</label>
              <select
                required
                value={assignForm.shiftId}
                onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Shift</option>
                {shiftTemplates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime} - {s.endTime} {s.crossesMidnight ? 'Overnight' : ''})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Duty Date *</label>
              <Input
                type="date"
                required
                value={assignForm.date}
                onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Assigning…' : 'Save Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Shift Template Modal */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Define Shift Template
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Shift Name *</label>
              <Input
                required
                placeholder="e.g. Night Audit, Afternoon Kitchen"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Start Time</label>
                <Input
                  type="time"
                  value={templateForm.startTime}
                  onChange={(e) => setTemplateForm({ ...templateForm, startTime: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">End Time</label>
                <Input
                  type="time"
                  value={templateForm.endTime}
                  onChange={(e) => setTemplateForm({ ...templateForm, endTime: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="crossesMidnight"
                checked={templateForm.crossesMidnight}
                onChange={(e) => setTemplateForm({ ...templateForm, crossesMidnight: e.target.checked })}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="crossesMidnight" className="text-slate-300 cursor-pointer">
                Crosses Midnight (Overnight hospitality shift)
              </label>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setTemplateModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
