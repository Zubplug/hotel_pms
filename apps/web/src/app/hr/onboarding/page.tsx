'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Shield,
  FileCheck,
  Briefcase,
  Users,
  Search,
  Filter,
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

export default function OnboardingPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksRes, empRes] = await Promise.all([
        fetch('/api/hr/onboarding'),
        fetch('/api/hr/employees?limit=200'),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Failed to load onboarding data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !currentStatus } : t))
      );

      await fetch('/api/hr/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_TASK', taskId, isCompleted: !currentStatus }),
      });
    } catch (err) {
      console.error('Failed to toggle task', err);
      fetchData();
    }
  };

  const handleAssignChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_CHECKLIST', staffId: selectedStaffId }),
      });
      if (res.ok) {
        setAssignModalOpen(false);
        setSelectedStaffId('');
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Group tasks by staff
  const staffTaskGroups = useMemo(() => {
    const groups: Record<string, { staffName: string; department: string; position: string; tasks: any[] }> = {};
    for (const t of tasks) {
      if (!groups[t.staffId]) {
        groups[t.staffId] = {
          staffName: t.staffName,
          department: t.department,
          position: t.position,
          tasks: [],
        };
      }
      groups[t.staffId].tasks.push(t);
    }
    return Object.entries(groups).map(([staffId, data]) => ({
      staffId,
      ...data,
      total: data.tasks.length,
      completed: data.tasks.filter((t) => t.isCompleted).length,
    }));
  }, [tasks]);

  const filteredGroups = useMemo(() => {
    return staffTaskGroups.filter((g) => {
      const matchesSearch =
        !search ||
        g.staffName.toLowerCase().includes(search.toLowerCase()) ||
        g.department.toLowerCase().includes(search.toLowerCase());
      const matchesStaff = selectedStaff === 'ALL' || g.staffId === selectedStaff;
      return matchesSearch && matchesStaff;
    });
  }, [staffTaskGroups, search, selectedStaff]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.isCompleted).length;
  const pendingTasks = totalTasks - completedTasks;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-teal-400" />
            Employee Onboarding &amp; Offboarding Checklists
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Uniform issuance, health clearances, IT credentials, statutory document filings, and exit handovers.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setAssignModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
        >
          <Plus className="w-3.5 h-3.5" />
          Assign Onboarding Plan
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Tasks Tracked</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{totalTasks}</span>
            <FileCheck className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Across active new hires</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Completed Clearances</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{completedTasks}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% completion rate
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending Actions</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{pendingTasks}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Awaiting compliance verification</span>
        </div>
      </div>

      {/* Employee Onboarding Cards */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-xs text-slate-500 py-10 text-center">Loading checklists…</p>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
            <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No active onboarding checklists found.</p>
            <p className="text-xs text-slate-500 mt-1">Click &ldquo;Assign Onboarding Plan&rdquo; to launch standard hospitality clearance for a staff member.</p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const pct = Math.round((group.completed / (group.total || 1)) * 100);

            return (
              <div
                key={group.staffId}
                className="bg-[#090e17] border border-slate-800/80 rounded-xl p-5 space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                      {group.staffName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{group.staffName}</h3>
                      <p className="text-xs text-slate-400">
                        {group.position} • {group.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-200">
                        {group.completed} / {group.total} Tasks
                      </span>
                      <p className="text-[10px] text-teal-400 font-semibold">{pct}% Complete</p>
                    </div>
                    <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Task Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {group.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task.id, task.isCompleted)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        task.isCompleted
                          ? 'bg-slate-950/60 border-slate-800/50 text-slate-500'
                          : 'bg-slate-900/80 border-slate-800 hover:border-teal-500/40 text-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.isCompleted}
                        onChange={() => {}} // Handled by div click
                        className="mt-0.5 rounded border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium leading-snug ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{task.description}</p>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {task.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assign Plan Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-teal-400" />
              Assign Onboarding Plan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignChecklist} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Select Employee *</label>
              <select
                required
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Staff Member</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.department} - {e.position})
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-slate-400">
              <span className="text-[11px] font-bold text-teal-400 block">Includes 6 Standard Hospitality Tasks:</span>
              <p>• Submit NIN, BVN &amp; State Tax ID</p>
              <p>• Sign Employment Contract &amp; Handbook</p>
              <p>• Uniform &amp; Name Badge Issuance</p>
              <p>• Food Handler Health Check &amp; Certificate</p>
              <p>• LodgeCore POS &amp; PMS Credentials Setup</p>
              <p>• Bank Details &amp; Emergency Contacts</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Assigning…' : 'Assign Standard Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
