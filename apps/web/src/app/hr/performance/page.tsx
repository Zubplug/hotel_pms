'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Star,
  Users,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight,
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

export default function PerformancePage() {
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [disciplinaries, setDisciplinaries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [appraisalModalOpen, setAppraisalModalOpen] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [appraisalForm, setAppraisalForm] = useState({
    staffId: '',
    reviewPeriodStart: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    reviewPeriodEnd: new Date().toISOString().split('T')[0],
    overallScore: '4.0',
    reviewerNotes: '',
  });

  const [trainingForm, setTrainingForm] = useState({
    staffId: '',
    courseName: '',
    provider: '',
    startDate: new Date().toISOString().split('T')[0],
    score: '90',
    expiresAt: '',
    certificateUrl: '',
    isMandatory: false,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [perfRes, empRes] = await Promise.all([
        fetch('/api/hr/performance'),
        fetch('/api/hr/employees?limit=200'),
      ]);

      if (perfRes.ok) {
        const data = await perfRes.json();
        setAppraisals(data.appraisals || []);
        setTrainings(data.trainings || []);
        setDisciplinaries(data.disciplinaries || []);
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      console.error('Failed to load performance data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_APPRAISAL', ...appraisalForm }),
      });
      if (res.ok) {
        setAppraisalModalOpen(false);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_TRAINING', ...trainingForm }),
      });
      if (res.ok) {
        setTrainingModalOpen(false);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-teal-400" />
            Performance Management &amp; Training
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Hospitality KPI appraisals, guest service ratings, staff skills development, and disciplinary tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTrainingModalOpen(true)}
            className="border-slate-800 bg-slate-900/60 text-slate-300 text-xs h-9 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Training
          </Button>
          <Button
            size="sm"
            onClick={() => setAppraisalModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            New Appraisal
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Appraisals</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{appraisals.length}</span>
            <Award className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Completed reviews</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trainings Completed</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{trainings.length}</span>
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Staff certifications</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Disciplinary Records</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{disciplinaries.length}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Incidents on file</span>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="appraisals" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-0.5">
          <TabsTrigger value="appraisals" className="text-xs">KPI Appraisals ({appraisals.length})</TabsTrigger>
          <TabsTrigger value="training" className="text-xs">Training &amp; Skills ({trainings.length})</TabsTrigger>
          <TabsTrigger value="disciplinary" className="text-xs">Disciplinary Cases ({disciplinaries.length})</TabsTrigger>
        </TabsList>

        {/* Tab: Appraisals */}
        <TabsContent value="appraisals">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department &amp; Position</th>
                    <th className="py-3 px-4">Review Period</th>
                    <th className="py-3 px-4">Overall Score</th>
                    <th className="py-3 px-4">Reviewer Remarks</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">Loading appraisals…</td>
                    </tr>
                  ) : appraisals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">No appraisals recorded yet.</td>
                    </tr>
                  ) : (
                    appraisals.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{a.staffName}</td>
                        <td className="py-3 px-4 text-slate-400">{a.department} • {a.position}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(a.reviewPeriodStart).toLocaleDateString()} – {new Date(a.reviewPeriodEnd).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="flex items-center gap-1 font-bold text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400" /> {a.overallScore} / 5.0
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{a.reviewerNotes}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Training */}
        <TabsContent value="training">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Course / Program</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {trainings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">No training records found.</td>
                    </tr>
                  ) : (
                    trainings.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{t.staffName}</td>
                        <td className="py-3 px-4 text-teal-400 font-medium">{t.courseName}</td>
                        <td className="py-3 px-4 text-slate-400">{t.provider}</td>
                        <td className="py-3 px-4 text-slate-300">{new Date(t.startDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-bold text-white">{t.score ? `${t.score}%` : 'Pass'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Disciplinary */}
        <TabsContent value="disciplinary">
          <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Incident Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Incident Description</th>
                    <th className="py-3 px-4">Action Taken</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {disciplinaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">No disciplinary incidents recorded.</td>
                    </tr>
                  ) : (
                    disciplinaries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{d.staffName}</td>
                        <td className="py-3 px-4 text-slate-400">{new Date(d.incidentDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-bold text-amber-400">{d.category}</td>
                        <td className="py-3 px-4 text-slate-300">{d.description}</td>
                        <td className="py-3 px-4 text-rose-400 font-medium">{d.actionTaken}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {d.status}
                          </span>
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

      {/* New Appraisal Modal */}
      <Dialog open={appraisalModalOpen} onOpenChange={setAppraisalModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-400" />
              Record Performance Appraisal
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAppraisal} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={appraisalForm.staffId}
                onChange={(e) => setAppraisalForm({ ...appraisalForm, staffId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Period Start</label>
                <Input
                  type="date"
                  value={appraisalForm.reviewPeriodStart}
                  onChange={(e) => setAppraisalForm({ ...appraisalForm, reviewPeriodStart: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Period End</label>
                <Input
                  type="date"
                  value={appraisalForm.reviewPeriodEnd}
                  onChange={(e) => setAppraisalForm({ ...appraisalForm, reviewPeriodEnd: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Overall Rating Score (1.0 to 5.0)</label>
              <Input
                type="number"
                step="0.1"
                min="1.0"
                max="5.0"
                value={appraisalForm.overallScore}
                onChange={(e) => setAppraisalForm({ ...appraisalForm, overallScore: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Reviewer Remarks / Feedback</label>
              <Input
                placeholder="Exemplary guest hospitality ratings..."
                value={appraisalForm.reviewerNotes}
                onChange={(e) => setAppraisalForm({ ...appraisalForm, reviewerNotes: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAppraisalModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : 'Record Appraisal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Training Modal */}
      <Dialog open={trainingModalOpen} onOpenChange={setTrainingModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-teal-400" />
              Log Training Program
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTraining} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Employee *</label>
              <select
                required
                value={trainingForm.staffId}
                onChange={(e) => setTrainingForm({ ...trainingForm, staffId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Course Name *</label>
              <Input
                required
                placeholder="e.g. HACCP Food Hygiene, Opera/LodgeCore POS Mastery"
                value={trainingForm.courseName}
                onChange={(e) => setTrainingForm({ ...trainingForm, courseName: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Training Provider</label>
              <Input
                value={trainingForm.provider}
                onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Date Completed</label>
                <Input
                  type="date"
                  value={trainingForm.startDate}
                  onChange={(e) => setTrainingForm({ ...trainingForm, startDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Score / Percentage</label>
                <Input
                  type="number"
                  value={trainingForm.score}
                  onChange={(e) => setTrainingForm({ ...trainingForm, score: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-slate-400 block mb-1">Certificate expiry</label><Input type="date" value={trainingForm.expiresAt} onChange={(e) => setTrainingForm({ ...trainingForm, expiresAt: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" /></div>
              <div><label className="text-slate-400 block mb-1">Certificate URL</label><Input placeholder="https://…" value={trainingForm.certificateUrl} onChange={(e) => setTrainingForm({ ...trainingForm, certificateUrl: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" /></div>
            </div>
            <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={trainingForm.isMandatory} onChange={(e) => setTrainingForm({ ...trainingForm, isMandatory: e.target.checked })} /> Mandatory compliance training</label>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setTrainingModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Saving…' : 'Log Training'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
