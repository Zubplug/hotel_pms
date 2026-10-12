'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  Star,
  Mail,
  Phone,
  Building2,
  MoreVertical,
  ChevronRight,
  Calendar,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PIPELINE_STAGES = [
  { id: 'APPLIED', label: 'Applied', color: 'border-slate-700 bg-slate-900/60' },
  { id: 'SCREENING', label: 'Screening', color: 'border-blue-900/50 bg-blue-950/20' },
  { id: 'INTERVIEW', label: 'Interview', color: 'border-amber-900/50 bg-amber-950/20' },
  { id: 'OFFERED', label: 'Offer Sent', color: 'border-indigo-900/50 bg-indigo-950/20' },
  { id: 'HIRED', label: 'Hired', color: 'border-emerald-900/50 bg-emerald-950/20' },
];

export default function RecruitmentPage() {
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedVacancy, setSelectedVacancy] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'vacancies'>('pipeline');

  // Modals
  const [vacancyModalOpen, setVacancyModalOpen] = useState(false);
  const [applicantModalOpen, setApplicantModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [vacancyForm, setVacancyForm] = useState({
    title: '',
    departmentId: '',
    positionsCount: '1',
    description: '',
    closingDate: '',
  });

  const [applicantForm, setApplicantForm] = useState({
    vacancyId: '',
    fullName: '',
    email: '',
    phone: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, orgRes] = await Promise.all([
        fetch('/api/hr/recruitment'),
        fetch('/api/hr/organization'),
      ]);

      if (recRes.ok) {
        const recData = await recRes.json();
        setVacancies(recData.vacancies || []);
        setApplicants(recData.applicants || []);
      }
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setDepartments(orgData.departments || []);
      }
    } catch (err) {
      console.error('Failed to load recruitment data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredApplicants = useMemo(() => {
    if (selectedVacancy === 'ALL') return applicants;
    return applicants.filter((a) => a.vacancyId === selectedVacancy);
  }, [applicants, selectedVacancy]);

  const handleCreateVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_VACANCY', ...vacancyForm }),
      });
      if (res.ok) {
        setVacancyModalOpen(false);
        setVacancyForm({ title: '', departmentId: '', positionsCount: '1', description: '', closingDate: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_APPLICANT', ...applicantForm }),
      });
      if (res.ok) {
        setApplicantModalOpen(false);
        setApplicantForm({ vacancyId: '', fullName: '', email: '', phone: '', notes: '' });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStage = async (applicantId: string, nextStage: string) => {
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STAGE', applicantId, stage: nextStage }),
      });
      if (res.ok) {
        if (selectedCandidate) {
          setSelectedCandidate({ ...selectedCandidate, stage: nextStage });
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertToEmployee = async () => {
    if (!selectedCandidate) return;
    const salary = window.prompt('Approved monthly base salary (NGN):');
    if (!salary || Number(salary) <= 0) return;
    const res = await fetch('/api/hr/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CONVERT_TO_EMPLOYEE', applicantId: selectedCandidate.id, baseSalary: Number(salary) }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Unable to convert candidate');
    alert(`Employee created: ${data.staff.employeeId}`);
    setCandidateModalOpen(false);
    fetchData();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-teal-400" />
            Recruitment &amp; Talent Acquisition (ATS)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Job requisition pipeline, applicant scoring, interview workflows, and seamless conversion to employee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setApplicantModalOpen(true)}
            className="border-slate-800 bg-slate-800/60 text-slate-200 hover:bg-slate-700 text-xs h-9 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Candidate
          </Button>
          <Button
            size="sm"
            onClick={() => setVacancyModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Post Vacancy
          </Button>
        </div>
      </div>

      {/* Controls & Metrics */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <select
            value={selectedVacancy}
            onChange={(e) => setSelectedVacancy(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-3 h-9 outline-none focus:border-teal-500"
          >
            <option value="ALL">All Active Vacancies ({vacancies.length})</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} ({v.applicantsCount} candidates)
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500">
            Total Candidates: <strong className="text-slate-300 font-semibold">{applicants.length}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'pipeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('pipeline')}
            className={`text-xs h-8 ${activeTab === 'pipeline' ? 'bg-teal-600 text-white' : 'border-slate-800 text-slate-400'}`}
          >
            Pipeline Board
          </Button>
          <Button
            variant={activeTab === 'vacancies' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('vacancies')}
            className={`text-xs h-8 ${activeTab === 'vacancies' ? 'bg-teal-600 text-white' : 'border-slate-800 text-slate-400'}`}
          >
            Vacancies Catalog ({vacancies.length})
          </Button>
        </div>
      </div>

      {activeTab === 'pipeline' ? (
        /* Kanban Pipeline Board */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((col) => {
            const colApplicants = filteredApplicants.filter((a) => a.stage === col.id);

            return (
              <div
                key={col.id}
                className="bg-[#090e17] border border-slate-800/80 rounded-xl p-3 min-w-[220px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {col.label}
                  </span>
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 text-[10px] font-bold flex items-center justify-center">
                    {colApplicants.length}
                  </span>
                </div>

                {/* Candidate Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                  {colApplicants.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-600">
                      No candidates in {col.label.toLowerCase()}
                    </div>
                  ) : (
                    colApplicants.map((cand) => (
                      <div
                        key={cand.id}
                        onClick={() => {
                          setSelectedCandidate(cand);
                          setCandidateModalOpen(true);
                        }}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-500/50 cursor-pointer transition-all shadow-sm group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">
                            {cand.fullName}
                          </h4>
                          {cand.rating && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-bold">
                              <Star className="w-3 h-3 fill-amber-400" /> {cand.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mb-2">
                          {cand.vacancyTitle}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[9px] text-slate-500">
                          <span>{new Date(cand.createdAt).toLocaleDateString()}</span>
                          <span className="text-teal-400 font-medium">Review &rarr;</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vacancies List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vacancies.map((v) => (
            <div
              key={v.id}
              className="bg-[#090e17] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {v.status}
                  </span>
                  <span className="text-xs text-slate-400">{v.positionsCount} Openings</span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">{v.title}</h3>
                <p className="text-xs text-slate-400 mb-3">{v.department}</p>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {v.description || 'Full-time hospitality position at LodgeCore.'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{v.applicantsCount} Applicants</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedVacancy(v.id);
                    setActiveTab('pipeline');
                  }}
                  className="text-teal-400 hover:text-teal-300 text-xs h-7"
                >
                  View Pipeline &rarr;
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Candidate Review Modal */}
      <Dialog open={candidateModalOpen} onOpenChange={setCandidateModalOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100">
          {selectedCandidate && (
            <div>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold text-white">
                    {selectedCandidate.fullName}
                  </DialogTitle>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {selectedCandidate.stage}
                  </span>
                </div>
              </DialogHeader>

              <div className="space-y-4 my-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500">Applied Role</span>
                    <p className="text-slate-200 font-medium">{selectedCandidate.vacancyTitle}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Department</span>
                    <p className="text-slate-200 font-medium">{selectedCandidate.department}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Email</span>
                    <p className="text-slate-200 font-medium">{selectedCandidate.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone</span>
                    <p className="text-slate-200 font-medium">{selectedCandidate.phone || 'N/A'}</p>
                  </div>
                </div>

                {selectedCandidate.notes && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Interview &amp; Screening Notes</span>
                    <p className="text-slate-300">{selectedCandidate.notes}</p>
                  </div>
                )}

                {/* Stage Progression Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block font-semibold">Advance Candidate Stage</span>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStage(selectedCandidate.id, 'SCREENING')}
                      className="border-slate-800 text-xs h-7"
                    >
                      Screening
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStage(selectedCandidate.id, 'INTERVIEW')}
                      className="border-slate-800 text-xs h-7"
                    >
                      Interview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStage(selectedCandidate.id, 'OFFER')}
                      className="border-slate-800 text-xs h-7"
                    >
                      Offer
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStage(selectedCandidate.id, 'HIRED')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7"
                    >
                      Hire
                    </Button>
                  </div>
                  {(selectedCandidate.stage === 'OFFER' || selectedCandidate.stage === 'HIRED') && (
                    <Button onClick={handleConvertToEmployee} className="w-full mt-2 bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                      Convert to Employee &amp; Initialize Salary
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Post Vacancy Modal */}
      <Dialog open={vacancyModalOpen} onOpenChange={setVacancyModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-400" />
              Post Job Vacancy
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateVacancy} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Role Title *</label>
              <Input
                required
                placeholder="e.g. Front Desk Lead, Chief Engineer"
                value={vacancyForm.title}
                onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Department</label>
              <select
                value={vacancyForm.departmentId}
                onChange={(e) => setVacancyForm({ ...vacancyForm, departmentId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Number of Openings</label>
              <Input
                type="number"
                min="1"
                value={vacancyForm.positionsCount}
                onChange={(e) => setVacancyForm({ ...vacancyForm, positionsCount: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Target Closing Date</label>
              <Input
                type="date"
                value={vacancyForm.closingDate}
                onChange={(e) => setVacancyForm({ ...vacancyForm, closingDate: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setVacancyModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Publishing…' : 'Publish Vacancy'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Candidate Modal */}
      <Dialog open={applicantModalOpen} onOpenChange={setApplicantModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              Add Candidate to Pipeline
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateApplicant} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Job Vacancy *</label>
              <select
                required
                value={applicantForm.vacancyId}
                onChange={(e) => setApplicantForm({ ...applicantForm, vacancyId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
              >
                <option value="">Select Target Vacancy</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Full Name *</label>
              <Input
                required
                placeholder="Candidate full name"
                value={applicantForm.fullName}
                onChange={(e) => setApplicantForm({ ...applicantForm, fullName: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Email *</label>
              <Input
                required
                type="email"
                placeholder="candidate@example.com"
                value={applicantForm.email}
                onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Phone</label>
              <Input
                placeholder="Candidate phone number"
                value={applicantForm.phone}
                onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setApplicantModalOpen(false)} className="border-slate-800 text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Adding…' : 'Add to Pipeline'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
