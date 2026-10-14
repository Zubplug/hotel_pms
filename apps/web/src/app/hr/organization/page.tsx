'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Plus,
  Briefcase,
  Layers,
  ChevronRight,
  Shield,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Pencil,
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

export default function OrganizationPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [headCandidates, setHeadCandidates] = useState<any[]>([]);
  const [positionChangeRequests, setPositionChangeRequests] = useState<any[]>([]);
  const [canApprovePositionChanges, setCanApprovePositionChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '', headStaffId: '' });
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({ departmentId: '', name: '', code: '', description: '' });
  const [posForm, setPosForm] = useState({
    departmentId: '',
    title: '',
    code: '',
    gradeLevel: 'L1',
    minSalary: '',
    maxSalary: '',
    headcountBudget: '1',
    description: '',
    reason: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/organization');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        setPositions(data.positions || []);
        setHeadCandidates(data.headCandidates || []);
        setPositionChangeRequests(data.positionChangeRequests || []);
        setCanApprovePositionChanges(Boolean(data.canApprovePositionChanges));
      }
    } catch (err) {
      console.error('Failed to load organization data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/organization', {
        method: editingDeptId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingDeptId ? { departmentId: editingDeptId } : { type: 'DEPARTMENT' }),
          ...deptForm,
        }),
      });
      if (res.ok) {
        setDeptModalOpen(false);
        setDeptForm({ name: '', code: '', description: '', headStaffId: '' });
        setEditingDeptId(null);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openNewDepartment = () => {
    setEditingDeptId(null);
    setDeptForm({ name: '', code: '', description: '', headStaffId: '' });
    setDeptModalOpen(true);
  };

  const openEditDepartment = (dept: any) => {
    setEditingDeptId(dept.id);
    setDeptForm({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || '',
      headStaffId: dept.headStaffId || '',
    });
    setDeptModalOpen(true);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SECTION', ...sectionForm }),
      });
      if (res.ok) {
        setSectionModalOpen(false);
        setSectionForm({ departmentId: '', name: '', code: '', description: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/organization', {
        method: editingPositionId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPositionId
          ? { positionId: editingPositionId, minSalary: posForm.minSalary, maxSalary: posForm.maxSalary, headcountBudget: posForm.headcountBudget, reason: posForm.reason }
          : { type: 'POSITION', ...posForm }),
      });
      if (res.ok) {
        setPosModalOpen(false);
        setEditingPositionId(null);
        setPosForm({
          departmentId: '',
          title: '',
          code: '',
          gradeLevel: 'L1',
          minSalary: '',
          maxSalary: '',
          headcountBudget: '1',
          description: '',
          reason: '',
        });
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Unable to save position');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openNewPosition = () => {
    setEditingPositionId(null);
    setPosForm({ departmentId: '', title: '', code: '', gradeLevel: 'L1', minSalary: '', maxSalary: '', headcountBudget: '1', description: '', reason: '' });
    setPosModalOpen(true);
  };

  const openEditPosition = (position: any) => {
    setEditingPositionId(position.id);
    setPosForm({
      departmentId: position.departmentId || '',
      title: position.title || '',
      code: position.code || '',
      gradeLevel: position.gradeLevel || 'L1',
      minSalary: position.minSalary == null ? '' : String(position.minSalary),
      maxSalary: position.maxSalary == null ? '' : String(position.maxSalary),
      headcountBudget: String(position.headcountBudget || 1),
      description: position.description || '',
      reason: '',
    });
    setPosModalOpen(true);
  };

  const reviewPositionChange = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    const reviewNotes = action === 'REJECT' ? window.prompt('Reason for rejecting this position change (optional):') || '' : '';
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeRequestId: requestId, action, reviewNotes }),
      });
      const result = await res.json();
      if (!res.ok) alert(result.error || 'Unable to review position change');
      else fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const totalBudgetedHeadcount = positions.reduce((sum, p) => sum + (p.headcountBudget || 0), 0);
  const totalActualHeadcount = positions.reduce((sum, p) => sum + (p.activeHeadcount || 0), 0);
  const totalVacancies = Math.max(0, totalBudgetedHeadcount - totalActualHeadcount);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-teal-400" />
            Organizational Structure &amp; Headcount
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Department hierarchy, operational sections, job roles, salary bands, and headcount budgeting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={openNewDepartment}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Department
          </Button>
          <Button
            size="sm"
            onClick={openNewPosition}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            New Job Position
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Departments</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{departments.length}</span>
            <Building2 className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Operating hotel divisions</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Budgeted vs Actual Headcount</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {totalActualHeadcount} <span className="text-sm font-normal text-slate-400">/ {totalBudgetedHeadcount}</span>
            </span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {Math.round((totalActualHeadcount / (totalBudgetedHeadcount || 1)) * 100)}% capacity filled
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Open Vacancies</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{totalVacancies}</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Unfilled positions against budget</span>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-0.5">
          <TabsTrigger value="departments" className="text-xs">Departments &amp; Sections</TabsTrigger>
          <TabsTrigger value="positions" className="text-xs">Job Positions &amp; Grades</TabsTrigger>
        </TabsList>

        {/* Tab 1: Departments & Sections */}
        <TabsContent value="departments" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <p className="text-xs text-slate-500 py-10 col-span-full text-center">Loading departments…</p>
            ) : departments.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-300">No departments configured yet.</p>
                <p className="text-xs text-slate-500 mt-1">Create departments like Front Office, Food &amp; Beverage, Housekeeping.</p>
              </div>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept.id}
                  className="bg-[#090e17] border border-slate-800/80 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {dept.code || 'DEPT'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditDepartment(dept)}
                        className="text-xs font-semibold text-slate-400 flex items-center gap-1 hover:text-teal-300"
                        title="Edit department"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-teal-400" />
                        {dept.headcount} staff
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{dept.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                      {dept.description || 'Core hotel operational department.'}
                    </p>

                    {/* Sections */}
                    <div className="border-t border-slate-800/60 pt-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Sections ({dept.sections?.length || 0})
                        </span>
                        <button
                          onClick={() => {
                            setSectionForm({ ...sectionForm, departmentId: dept.id });
                            setSectionModalOpen(true);
                          }}
                          className="text-[10px] text-teal-400 hover:text-teal-300 font-medium"
                        >
                          + Add Section
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {dept.sections?.length > 0 ? (
                          dept.sections.map((sec: any) => (
                            <span
                              key={sec.id}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                            >
                              {sec.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-600">No sections defined</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>HOD: <strong className="text-slate-300 font-medium">{dept.headOfDept || 'Unassigned'}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Job Positions & Grades */}
        <TabsContent value="positions">
          {positionChangeRequests.length > 0 && <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-amber-200">Pending position changes</h3>
                <p className="mt-1 text-[11px] text-slate-400">Salary bands and budgeted headcount remain unchanged until a General Manager approves them.</p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">{positionChangeRequests.length} pending</span>
            </div>
            <div className="space-y-2">
              {positionChangeRequests.map((request) => <div key={request.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center">
                <div className="text-xs">
                  <p className="font-semibold text-white">{request.position.title} <span className="font-mono text-[10px] text-teal-400">{request.position.code}</span></p>
                  <p className="mt-1 text-[11px] text-slate-400">₦{Number(request.proposedMinSalary || 0).toLocaleString()} - ₦{Number(request.proposedMaxSalary || 0).toLocaleString()} · Headcount budget: {request.proposedHeadcount} · Requested by {request.requestedByName}</p>
                  {request.reason && <p className="mt-1 text-[11px] text-slate-500">Reason: {request.reason}</p>}
                </div>
                {canApprovePositionChanges && <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" disabled={submitting} onClick={() => reviewPositionChange(request.id, 'REJECT')} variant="outline" className="h-7 border-rose-500/30 text-[10px] text-rose-300">Reject</Button>
                  <Button type="button" size="sm" disabled={submitting} onClick={() => reviewPositionChange(request.id, 'APPROVE')} className="h-7 bg-emerald-600 text-[10px] text-white hover:bg-emerald-500">Approve</Button>
                </div>}
              </div>)}
            </div>
          </div>}
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Position Title</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4">Salary Band (NGN)</th>
                    <th className="py-3 px-4">Headcount (Actual / Budget)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        Loading job positions…
                      </td>
                    </tr>
                  ) : positions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        No job positions defined yet.
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => {
                      const isOverBudget = pos.activeHeadcount > pos.headcountBudget;
                      const isFilled = pos.activeHeadcount === pos.headcountBudget;

                      return (
                        <tr key={pos.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-semibold text-white">{pos.title}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-teal-400">{pos.code}</td>
                          <td className="py-3 px-4 text-slate-300">{pos.department}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                              {pos.gradeLevel || 'L1'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            ₦{pos.minSalary.toLocaleString()} - ₦{pos.maxSalary.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white">{pos.activeHeadcount}</span>
                            <span className="text-slate-500"> / {pos.headcountBudget}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isFilled
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isOverBudget
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {isFilled ? 'Filled' : isOverBudget ? 'Over Budget' : 'Open'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEditPosition(pos)} className="h-7 border-slate-700 text-[10px] text-slate-300 hover:text-white">
                              <Pencil className="mr-1 h-3 w-3" /> Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: New Department */}
      <Dialog open={deptModalOpen} onOpenChange={setDeptModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-400" />
              {editingDeptId ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDept} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Department Name *</label>
              <Input
                required
                placeholder="e.g. Front Office, Food & Beverage"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Code</label>
              <Input
                placeholder="e.g. FO, FNB, HK"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Description</label>
              <Input
                placeholder="Department mandate & overview"
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Department Head</label>
              <select
                value={deptForm.headStaffId}
                onChange={(e) => setDeptForm({ ...deptForm, headStaffId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Unassigned</option>
                {headCandidates.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName} · {staff.position || staff.department || staff.email}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Only active employees assigned to this property are listed.</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setDeptModalOpen(false); setEditingDeptId(null); }} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : editingDeptId ? 'Save Changes' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: New Section */}
      <Dialog open={sectionModalOpen} onOpenChange={setSectionModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" />
              Add Department Section
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSection} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Parent Department *</label>
              <select
                required
                value={sectionForm.departmentId}
                onChange={(e) => setSectionForm({ ...sectionForm, departmentId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Section Name *</label>
              <Input
                required
                placeholder="e.g. Concierge, Pastry Kitchen, Linen Room"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Code</label>
              <Input
                placeholder="e.g. SEC-01"
                value={sectionForm.code}
                onChange={(e) => setSectionForm({ ...sectionForm, code: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSectionModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : 'Create Section'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: New Position */}
      <Dialog open={posModalOpen} onOpenChange={setPosModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-400" />
              {editingPositionId ? 'Request Position Change' : 'Define Job Position'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePosition} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Department</label>
              <select
                value={posForm.departmentId}
                disabled={Boolean(editingPositionId)}
                onChange={(e) => setPosForm({ ...posForm, departmentId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">General / All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Position Title *</label>
              <Input
                required
                placeholder="e.g. Front Desk Officer, Sous Chef"
                value={posForm.title}
                disabled={Boolean(editingPositionId)}
                onChange={(e) => setPosForm({ ...posForm, title: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Grade Level</label>
                <Input
                  placeholder="e.g. L1, L2, Senior"
                  value={posForm.gradeLevel}
                  disabled={Boolean(editingPositionId)}
                  onChange={(e) => setPosForm({ ...posForm, gradeLevel: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Budgeted Headcount</label>
                <Input
                  type="number"
                  min="1"
                  value={posForm.headcountBudget}
                  onChange={(e) => setPosForm({ ...posForm, headcountBudget: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Min Salary (NGN)</label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={posForm.minSalary}
                  onChange={(e) => setPosForm({ ...posForm, minSalary: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Max Salary (NGN)</label>
                <Input
                  type="number"
                  placeholder="250000"
                  value={posForm.maxSalary}
                  onChange={(e) => setPosForm({ ...posForm, maxSalary: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            {editingPositionId && <div>
              <label className="text-slate-400 mb-1 block">Reason for change</label>
              <Input
                placeholder="e.g. Approved annual salary review"
                value={posForm.reason}
                onChange={(e) => setPosForm({ ...posForm, reason: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <p className="mt-1 text-[10px] text-slate-500">A General Manager must approve this change before it becomes active.</p>
            </div>}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setPosModalOpen(false); setEditingPositionId(null); }} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : editingPositionId ? 'Submit for GM Approval' : 'Define Position'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
