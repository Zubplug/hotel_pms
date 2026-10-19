'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ChevronRight,
  ChevronDown,
  Check,
  Shield,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  X,
  CreditCard,
  UserCheck,
  Award,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type BankOption = { code: string; name: string };

function SearchableBankSelect({
  banks,
  value,
  onChange,
}: {
  banks: BankOption[];
  value: string;
  onChange: (bank: BankOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedBank = banks.find((bank) => bank.code === value);
  const filteredBanks = banks.filter((bank) => bank.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(''); }}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-left text-xs text-slate-300 outline-none transition hover:border-slate-700 focus-visible:ring-2 focus-visible:ring-teal-500/40"
            aria-label="Select bank"
          />
        }
      >
        <span className={selectedBank ? 'truncate text-slate-100' : 'truncate text-slate-500'}>
          {selectedBank?.name || 'Select bank from Flutterwave'}
        </span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-500" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-xl border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl">
        <div className="border-b border-slate-800 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search banks..."
              className="h-8 w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1.5" role="listbox" aria-label="Banks">
          {filteredBanks.length > 0 ? filteredBanks.map((bank) => (
            <button
              key={bank.code}
              type="button"
              role="option"
              aria-selected={bank.code === value}
              onClick={() => { onChange(bank); setOpen(false); setQuery(''); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <span className="truncate">{bank.name}</span>
              {bank.code === value && <Check className="h-3.5 w-3.5 shrink-0 text-teal-400" />}
            </button>
          )) : (
            <p className="px-2.5 py-3 text-xs text-slate-500">No matching banks found.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(''); }}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-left text-xs text-slate-300 outline-none transition hover:border-slate-700 focus-visible:ring-2 focus-visible:ring-teal-500/40"
            aria-label={placeholder}
          />
        }
      >
        <span className={selectedOption ? 'truncate text-slate-100' : 'truncate text-slate-500'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-500" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-xl border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl">
        <div className="border-b border-slate-800 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="h-8 w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1.5" role="listbox" aria-label={placeholder}>
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => { onChange(option.value); setOpen(false); setQuery(''); }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-teal-400" />}
            </button>
          )) : (
            <p className="px-2.5 py-3 text-xs text-slate-500">No matching options found.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [separationRequests, setSeparationRequests] = useState<any[]>([]);
  const [canApproveSeparations, setCanApproveSeparations] = useState(false);
  const [profileChangeRequests, setProfileChangeRequests] = useState<any[]>([]);
  const [canApproveProfileChanges, setCanApproveProfileChanges] = useState(false);

  // Drawer & Modal States
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [separationModalOpen, setSeparationModalOpen] = useState(false);
  const [separationEmployee, setSeparationEmployee] = useState<any | null>(null);
  const [separationForm, setSeparationForm] = useState({ separationType: 'TERMINATED', effectiveDate: new Date().toISOString().split('T')[0], reason: '' });

  // New Employee Form
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentId: '',
    departmentName: '',
    jobPositionId: '',
    positionTitle: '',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalary: '',
    transportAllowance: '',
    housingAllowance: '',
    nin: '',
    bvn: '',
    taxId: '',
    pfaName: '',
    rsaPin: '',
    nhfNumber: '',
    bankName: '',
    bankAccountNumber: '',
    bankSortCode: '',
    bankAccountName: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    posPin: '',
    changeReason: '',
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/employees?limit=200');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        setSeparationRequests(data.separationRequests || []);
        setCanApproveSeparations(Boolean(data.canApproveSeparations));
        setProfileChangeRequests(data.profileChangeRequests || []);
        setCanApproveProfileChanges(Boolean(data.canApproveProfileChanges));
      }
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgData = async () => {
    try {
      const res = await fetch('/api/hr/organization');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        setPositions(data.positions || []);
      }
    } catch (err) {
      console.error('Failed to load org data', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOrgData();
    fetch('/api/hr/employees/bank-account/banks').then(response => response.ok ? response.json() : null).then(data => setBanks(data?.banks ?? [])).catch(() => setBanks([]));
  }, []);

  const openEmployeeDrawer = async (emp: any) => {
    setSelectedEmployee(emp);
    setDrawerOpen(true);
    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmployee(data.employee);
      }
    } catch (err) {
      console.error('Failed to fetch detailed employee', err);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        !search ||
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.email.toLowerCase().includes(search.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        emp.department.toLowerCase().includes(search.toLowerCase());

      const matchesDept =
        selectedDept === 'ALL' ||
        emp.department === selectedDept ||
        emp.departmentId === selectedDept;

      const matchesStatus =
        selectedStatus === 'ALL' || emp.status === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, search, selectedDept, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const probation = employees.filter((e) => e.status === 'PROBATION').length;
    const onLeave = employees.filter((e) => e.status === 'ON_LEAVE').length;
    const totalGross = employees.reduce((sum, e) => sum + (Number(e.baseSalary) || 0), 0);
    return { total, active, probation, onLeave, totalGross };
  }, [employees]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEditing = Boolean(editingEmployeeId);
      const res = await fetch(isEditing ? `/api/hr/employees/${editingEmployeeId}` : '/api/hr/employees', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEditing ? {
          ...form,
          employmentStatus: form.employmentStatus,
          emergencyContact: form.emergencyContactName,
          emergencyRelation: form.emergencyContactRelationship,
          emergencyPhone: form.emergencyContactPhone,
        } : form),
      });
      if (res.ok) {
        const result = await res.json();
        setAddModalOpen(false);
        setEditingEmployeeId(null);
        fetchEmployees();
        if (!isEditing) {
          alert(result.invitationSent
            ? 'Employee created. An activation link was sent to their email and expires in 72 hours.'
            : `Employee created, but the activation email could not be sent. ${result.invitationWarning || 'Please verify email configuration.'}`);
        } else if (result.pendingApproval) {
          alert('Staff profile changes submitted for General Manager approval. The live profile remains unchanged until approval.');
        }
        // Reset form
        setForm({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          departmentId: '',
          departmentName: '',
          jobPositionId: '',
          positionTitle: '',
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          hireDate: new Date().toISOString().split('T')[0],
          baseSalary: '',
          transportAllowance: '',
          housingAllowance: '',
          nin: '',
          bvn: '',
          taxId: '',
          pfaName: '',
          rsaPin: '',
          nhfNumber: '',
          bankName: '',
          bankAccountNumber: '',
          bankSortCode: '',
          bankAccountName: '',
          emergencyContactName: '',
          emergencyContactRelationship: '',
          emergencyContactPhone: '',
          posPin: '',
          changeReason: '',
        });
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to create employee');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating employee');
    } finally {
      setSubmitting(false);
    }
  };

  const openEmployeeEditor = (employee: any) => {
    setEditingEmployeeId(employee.id);
    const departmentName = employee.department || employee.departmentRef?.name || '';
    const positionTitle = employee.position || employee.jobPosition?.title || '';
    const department = departments.find((item) => item.name?.trim().toLowerCase() === departmentName.trim().toLowerCase());
    const position = positions.find((item) =>
      item.title?.trim().toLowerCase() === positionTitle.trim().toLowerCase() &&
      (!department || item.departmentId === department.id),
    );
    setForm((current) => ({
      ...current,
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      email: employee.email || '',
      phone: employee.phone || '',
      departmentId: department?.id || '',
      departmentName,
      jobPositionId: position?.id || '',
      positionTitle,
      employmentType: employee.employeeProfile?.employmentType || employee.profile?.employmentType || employee.employmentType || 'FULL_TIME',
      employmentStatus: employee.employeeProfile?.status || employee.profile?.employmentStatus || employee.status || 'ACTIVE',
      baseSalary: String(employee.salaryStructure?.basicSalary ?? employee.profile?.baseSalary ?? employee.baseSalary ?? ''),
      nin: employee.employeeProfile?.nin || employee.profile?.nin || '',
      bvn: employee.employeeProfile?.bvn || employee.profile?.bvn || '',
      taxId: employee.employeeProfile?.tin || employee.profile?.taxId || '',
      pfaName: employee.salaryStructure?.pensionFundAdmin || employee.profile?.pfaName || '',
      rsaPin: employee.salaryStructure?.pensionNumber || employee.profile?.rsaPin || '',
      bankName: employee.salaryStructure?.bankName || employee.profile?.bankName || '',
      bankAccountNumber: employee.salaryStructure?.bankAccountNumber || employee.profile?.bankAccountNumber || '',
      bankSortCode: employee.salaryStructure?.bankSortCode || employee.profile?.bankSortCode || '',
      bankAccountName: employee.salaryStructure?.bankAccountName || employee.profile?.bankAccountName || '',
      emergencyContactName: employee.profile?.emergencyContact || '',
      emergencyContactRelationship: employee.profile?.emergencyRelation || '',
      emergencyContactPhone: employee.profile?.emergencyPhone || '',
      changeReason: '',
    }));
    setDrawerOpen(false);
    setAddModalOpen(true);
  };

  const openSeparationModal = (employee: any) => {
    setSeparationEmployee(employee);
    setSeparationForm({ separationType: 'TERMINATED', effectiveDate: new Date().toISOString().split('T')[0], reason: '' });
    setDrawerOpen(false);
    setSeparationModalOpen(true);
  };

  const submitSeparation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!separationEmployee) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/hr/employees/${separationEmployee.id}/separation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(separationForm),
      });
      const result = await response.json();
      if (!response.ok) return alert(result.error || 'Unable to submit separation request');
      setSeparationModalOpen(false);
      setSeparationEmployee(null);
      await fetchEmployees();
      alert('Separation request submitted for General Manager approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSeparation = async (request: any, action: 'APPROVE' | 'REJECT') => {
    const reviewNotes = action === 'REJECT' ? window.prompt('Reason for rejecting this separation (optional):') || '' : '';
    setSubmitting(true);
    try {
      const response = await fetch(`/api/hr/employees/${request.id}/separation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNotes }),
      });
      const result = await response.json();
      if (!response.ok) alert(result.error || 'Unable to review separation request');
      else await fetchEmployees();
    } finally {
      setSubmitting(false);
    }
  };

  const reviewProfileChange = async (request: any, status: 'APPROVED' | 'REJECTED' | 'CLARIFICATION') => {
    const reviewerNotes = status === 'APPROVED' ? '' : window.prompt(status === 'REJECTED' ? 'Reason for rejecting this profile change:' : 'What clarification is required?') || '';
    setSubmitting(true);
    try {
      const response = await fetch('/api/hr/profile-change-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: request.id, status, reviewerNotes }) });
      const result = await response.json();
      if (!response.ok) alert(result.error || 'Unable to review profile change');
      else await fetchEmployees();
    } finally {
      setSubmitting(false);
    }
  };

  const verifyBankAccount = async () => {
    const response = await fetch('/api/hr/employees/bank-account/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber: form.bankAccountNumber, bankSortCode: form.bankSortCode }),
    });
    const result = await response.json();
    if (!response.ok) return alert(result.error || 'Bank account verification failed');
    setForm(current => ({ ...current, bankAccountNumber: result.accountNumber, bankAccountName: result.accountName }));
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'Full Name',
      'Email',
      'Phone',
      'Department',
      'Position',
      'Status',
      'Base Salary (NGN)',
      'Hire Date',
    ];
    const rows = filteredEmployees.map((e) => [
      e.employeeCode,
      `"${e.name}"`,
      e.email,
      e.phone || '',
      `"${e.department}"`,
      `"${e.position}"`,
      e.status,
      e.baseSalary,
      e.hireDate ? new Date(e.hireDate).toLocaleDateString() : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `employees_master_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-400" />
            Employee Master Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete employee lifecycle records, biometric profiles, statutory IDs, and compensation structures.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white text-xs h-9 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditingEmployeeId(null); setAddModalOpen(true); }}
            className="bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Workforce</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Across all properties</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Staff</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{stats.active}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Active in service</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Probationary</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{stats.probation}</span>
            <UserCheck className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Under review</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">On Leave</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-400">{stats.onLeave}</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Approved absences</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Base Payroll Exposure</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-cyan-300 truncate">
              ₦{stats.totalGross.toLocaleString('en-NG')}
            </span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Monthly gross sum</span>
        </div>
      </div>

      {profileChangeRequests.length > 0 && <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-amber-200">Pending staff profile changes</h2><p className="mt-1 text-[11px] text-slate-400">Review the complete proposed profile before approving the update.</p></div><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">{profileChangeRequests.length} pending</span></div>
        <div className="space-y-2">{profileChangeRequests.map((request) => <div key={request.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center"><div className="text-xs"><p className="font-semibold text-white">{request.staff.firstName} {request.staff.lastName} <span className="text-[10px] uppercase text-amber-300">Profile update</span></p><p className="mt-1 text-[11px] text-slate-400">Submitted {new Date(request.createdAt).toLocaleDateString()}</p><p className="mt-1 text-[11px] text-slate-500">Reason: {request.reason || 'Not provided'}</p><details className="mt-2 text-[11px] text-slate-400"><summary className="cursor-pointer text-amber-200">View proposed profile</summary><pre className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[10px]">{request.proposedValue}</pre></details></div>{canApproveProfileChanges && <div className="flex shrink-0 gap-2"><Button type="button" size="sm" disabled={submitting} onClick={() => reviewProfileChange(request, 'CLARIFICATION')} variant="outline" className="h-7 border-sky-800 text-[10px] text-sky-300">Clarify</Button><Button type="button" size="sm" disabled={submitting} onClick={() => reviewProfileChange(request, 'REJECTED')} variant="outline" className="h-7 border-rose-800 text-[10px] text-rose-300">Reject</Button><Button type="button" size="sm" disabled={submitting} onClick={() => reviewProfileChange(request, 'APPROVED')} className="h-7 bg-amber-600 text-[10px] text-white hover:bg-amber-500">Approve profile</Button></div>}</div>)}</div>
      </section>}

      {separationRequests.length > 0 && <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-rose-200">Pending staff separations</h2>
            <p className="mt-1 text-[11px] text-slate-400">Review the documented reason and effective date before access is revoked.</p>
          </div>
          <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300">{separationRequests.length} pending</span>
        </div>
        <div className="space-y-2">
          {separationRequests.map((request) => <div key={request.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center">
            <div className="text-xs">
              <p className="font-semibold text-white">{request.staff.firstName} {request.staff.lastName} <span className="text-[10px] uppercase text-rose-300">{request.separationType}</span></p>
              <p className="mt-1 text-[11px] text-slate-400">Effective {new Date(request.effectiveDate).toLocaleDateString()} · Requested by {request.requestedBy.email}</p>
              <p className="mt-1 text-[11px] text-slate-500">{request.reason}</p>
            </div>
            {canApproveSeparations && <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" disabled={submitting} onClick={() => reviewSeparation(request, 'REJECT')} variant="outline" className="h-7 border-slate-700 text-[10px] text-slate-300">Reject</Button>
              <Button type="button" size="sm" disabled={submitting} onClick={() => reviewSeparation(request, 'APPROVE')} className="h-7 bg-rose-600 text-[10px] text-white hover:bg-rose-500">Approve separation</Button>
            </div>}
          </div>)}
        </div>
      </section>}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by name, code, email, or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-500 text-xs h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-3 h-9 outline-none focus:border-teal-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-3 h-9 outline-none focus:border-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Department &amp; Role</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Base Salary</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mr-2" />
                    Loading employee directory…
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No employees matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => openEmployeeDrawer(emp)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-[11px]">
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-teal-300 transition-colors">
                            {emp.name}
                          </p>
                          <p className="text-[10px] text-slate-500">{emp.employmentType.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-teal-400">
                      {emp.employeeCode}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-200">{emp.position}</p>
                      <p className="text-[10px] text-slate-500">{emp.department}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300">{emp.email}</p>
                      <p className="text-[10px] text-slate-500">{emp.phone || 'No phone'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : emp.status === 'PROBATION'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : emp.status === 'ON_LEAVE'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      ₦{Number(emp.baseSalary).toLocaleString('en-NG')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-teal-300 text-xs h-7 px-2"
                      >
                        Profile <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Detail Slideout Sheet */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-[#080d16] border-slate-800 text-slate-100 p-0 overflow-y-auto">
          {selectedEmployee && (
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800/80 bg-[#060a12]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-950">
                    {selectedEmployee.firstName?.[0] || 'E'}
                    {selectedEmployee.lastName?.[0] || 'M'}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {selectedEmployee.profile?.employeeCode || 'EMP'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedEmployee.jobPosition?.title || selectedEmployee.position} • {selectedEmployee.departmentRef?.name || selectedEmployee.department}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Hired {selectedEmployee.profile?.hireDate ? new Date(selectedEmployee.profile.hireDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => openEmployeeEditor(selectedEmployee)} className="ml-auto border-teal-500/30 text-teal-300 hover:bg-teal-500/10">
                    Edit staff
                  </Button>
                  {selectedEmployee.isActive && <Button type="button" variant="outline" onClick={() => openSeparationModal(selectedEmployee)} className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                    Start separation
                  </Button>}
                </div>
              </div>

              {/* Drawer Content Tabs */}
              <Tabs defaultValue="overview" className="flex-1 p-6">
                <TabsList className="bg-slate-900 border border-slate-800 p-0.5 mb-5 w-full grid grid-cols-4">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="compensation" className="text-xs">Pay &amp; Tax</TabsTrigger>
                  <TabsTrigger value="attendance" className="text-xs">Timesheet</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Docs</TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Details</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Email</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.email}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Phone</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.phone || 'None'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Emergency Contact</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Name</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.profile?.emergencyContact || 'None'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Relationship</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.profile?.emergencyRelation || 'None'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">Emergency Phone</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.profile?.emergencyPhone || 'None'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Hospitality Shifts &amp; Status</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Status</span>
                        <p className="text-emerald-400 font-semibold">{selectedEmployee.profile?.employmentStatus || 'ACTIVE'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Employment Type</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.profile?.employmentType || 'FULL_TIME'}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Compensation & Tax */}
                <TabsContent value="compensation" className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">Compensation Package</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Base Salary</span>
                        <p className="text-base font-bold text-white">
                          ₦{Number(selectedEmployee.salaryStructure?.baseSalary || selectedEmployee.profile?.baseSalary || 0).toLocaleString('en-NG')}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Allowances</span>
                        <p className="text-base font-bold text-slate-200">
                          ₦{Number(selectedEmployee.salaryStructure?.allowances || 0).toLocaleString('en-NG')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Nigerian Statutory Compliance</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">NIN</span>
                        <p className="font-mono text-slate-200">{selectedEmployee.profile?.nin || 'Not set'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">BVN</span>
                        <p className="font-mono text-slate-200">{selectedEmployee.profile?.bvn || 'Not set'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">State Tax ID</span>
                        <p className="font-mono text-slate-200">{selectedEmployee.profile?.taxId || 'Not set'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">NHF Number</span>
                        <p className="font-mono text-slate-200">{selectedEmployee.profile?.nhfNumber || 'Not set'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Pension PFA</span>
                        <p className="text-slate-200">{selectedEmployee.profile?.pfaName || 'Not set'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">RSA PIN</span>
                        <p className="font-mono text-slate-200">{selectedEmployee.profile?.rsaPin || 'Not set'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bank Disbursement Account</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Bank Name</span>
                        <p className="text-slate-200 font-medium">{selectedEmployee.profile?.bankName || 'Not configured'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Account Number</span>
                        <p className="font-mono text-slate-200">{selectedEmployee.profile?.bankAccountNumber || 'Not configured'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">Account Name</span>
                        <p className="text-slate-200">{selectedEmployee.profile?.bankAccountName || selectedEmployee.name}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Attendance */}
                <TabsContent value="attendance" className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent Attendance Punches</h3>
                    {selectedEmployee.attendance?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEmployee.attendance.map((att: any) => (
                          <div key={att.id} className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                            <div>
                              <p className="font-medium text-slate-200">{new Date(att.date).toLocaleDateString()}</p>
                              <p className="text-[10px] text-slate-500">
                                In: {att.clockIn ? new Date(att.clockIn).toLocaleTimeString() : '--'} | Out: {att.clockOut ? new Date(att.clockOut).toLocaleTimeString() : '--'}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-400">{att.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-4 text-center">No recent clock-in records.</p>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Documents */}
                <TabsContent value="documents" className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Employee File &amp; Credentials</h3>
                    {selectedEmployee.documents?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEmployee.documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-teal-400" />
                              <div>
                                <p className="font-medium text-slate-200">{doc.title}</p>
                                <p className="text-[10px] text-slate-500">{doc.type}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-4 text-center">No uploaded contracts or certifications.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={separationModalOpen} onOpenChange={setSeparationModalOpen}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-white"><XCircle className="h-4 w-4 text-rose-400" /> Start staff separation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSeparation} className="space-y-4 text-xs">
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-5 text-amber-100">This submits a formal request. The employee remains active until a General Manager approves it.</p>
            <div><label className="mb-1 block text-slate-400">Employee</label><p className="font-semibold text-white">{separationEmployee?.name}</p><p className="text-[11px] text-slate-500">{separationEmployee?.department} · {separationEmployee?.position}</p></div>
            <div><label className="mb-1 block text-slate-400">Separation type</label><SearchableSelect options={[{ value: 'TERMINATED', label: 'Termination / dismissal' }, { value: 'RESIGNED', label: 'Resignation' }, { value: 'RETIRED', label: 'Retirement' }]} value={separationForm.separationType} onChange={(separationType) => setSeparationForm({ ...separationForm, separationType })} placeholder="Select separation type" /></div>
            <div><label className="mb-1 block text-slate-400">Effective date</label><Input required type="date" value={separationForm.effectiveDate} onChange={(e) => setSeparationForm({ ...separationForm, effectiveDate: e.target.value })} className="h-8 border-slate-800 bg-slate-950 text-xs text-slate-100" /></div>
            <div><label className="mb-1 block text-slate-400">Reason and supporting record *</label><textarea required minLength={10} value={separationForm.reason} onChange={(e) => setSeparationForm({ ...separationForm, reason: e.target.value })} placeholder="Document the factual reason, prior warnings or resignation notice, and any relevant handover details." className="min-h-24 w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 outline-none focus:border-rose-500" /></div>
            <DialogFooter className="pt-2"><Button type="button" variant="outline" onClick={() => setSeparationModalOpen(false)} className="border-slate-800 text-xs">Cancel</Button><Button type="submit" disabled={submitting || separationForm.reason.trim().length < 10} className="bg-rose-600 text-xs text-white hover:bg-rose-500">{submitting ? 'Submitting…' : 'Submit for GM approval'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Employee Dialog Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-[min(1100px,calc(100vw-2rem))] max-w-6xl sm:max-w-6xl bg-slate-900 border-slate-800 text-slate-100 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-400" />
              Register New Employee
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateEmployee} className="space-y-5 text-xs">
            {/* Section 1: Personal */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400">1. Personal &amp; Account Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 mb-1 block">First Name *</label>
                  <Input
                    required={!editingEmployeeId}
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Last Name *</label>
                  <Input
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Work Email *</label>
                  <Input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Phone Number</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                {!editingEmployeeId && <div className="col-span-2 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-[10px] text-teal-200">
                  An activation link will be sent to the employee&apos;s email after the record is created. They will create their own password from that link.
                </div>}
              </div>
            </div>

            {/* Section 2: Department & Role */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400">2. Job &amp; Organizational Placement</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 mb-1 block">Department</label>
                  <SearchableSelect
                    value={form.departmentId}
                    onChange={(departmentId) => {
                      const dept = departments.find((d) => d.id === departmentId);
                      setForm({
                        ...form,
                        departmentId,
                        departmentName: dept?.name || '',
                        jobPositionId: '',
                        positionTitle: '',
                      });
                    }}
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    placeholder="Select department"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Job Position</label>
                  <SearchableSelect
                    value={form.jobPositionId}
                    onChange={(jobPositionId) => {
                      const pos = positions.find((p) => p.id === jobPositionId);
                      setForm({
                        ...form,
                        jobPositionId,
                        positionTitle: pos?.title || '',
                      });
                    }}
                    options={positions.filter((p) => !form.departmentId || p.departmentId === form.departmentId).map((p) => ({ value: p.id, label: p.title }))}
                    placeholder="Select position"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Employment Type</label>
                  <SearchableSelect
                    value={form.employmentType}
                    onChange={(employmentType) => setForm({ ...form, employmentType })}
                    options={[{ value: 'FULL_TIME', label: 'Full Time' }, { value: 'PART_TIME', label: 'Part Time' }, { value: 'CONTRACT', label: 'Contract' }, { value: 'CASUAL', label: 'Casual' }, { value: 'INTERN', label: 'Intern' }]}
                    placeholder="Select employment type"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Employment Status</label>
                  <SearchableSelect
                    value={form.employmentStatus}
                    onChange={(employmentStatus) => setForm({ ...form, employmentStatus })}
                    options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'PROBATION', label: 'Probation' }, { value: 'ON_LEAVE', label: 'On leave' }, { value: 'SUSPENDED', label: 'Suspended' }]}
                    placeholder="Select employment status"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Hire Date</label>
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                {editingEmployeeId && <div className="col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <label className="mb-1 block text-slate-300">Reason for profile change *</label>
                  <Input required minLength={10} placeholder="Explain the business reason and supporting record" value={form.changeReason} onChange={(e) => setForm({ ...form, changeReason: e.target.value })} className="h-8 border-slate-800 bg-slate-950 text-xs text-slate-100" />
                  <p className="mt-1 text-[10px] text-amber-100/70">All staff edits are submitted to the General Manager and do not change the live profile immediately.</p>
                </div>}
              </div>
            </div>

            {/* Section 3: Compensation & Statutory */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400">3. Compensation &amp; Statutory IDs (Nigeria)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 mb-1 block">Monthly Base Salary (NGN)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 150000"
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Transport Allowance (NGN)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 25000"
                    value={form.transportAllowance}
                    onChange={(e) => setForm({ ...form, transportAllowance: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">National Identity No (NIN)</label>
                  <Input
                    placeholder="11 digits"
                    value={form.nin}
                    onChange={(e) => setForm({ ...form, nin: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Bank Verification No (BVN)</label>
                  <Input
                    placeholder="11 digits"
                    value={form.bvn}
                    onChange={(e) => setForm({ ...form, bvn: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Pension PFA Name</label>
                  <Input
                    placeholder="e.g. Stanbic IBTC Pension"
                    value={form.pfaName}
                    onChange={(e) => setForm({ ...form, pfaName: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">RSA PIN</label>
                  <Input
                    placeholder="PEN..."
                    value={form.rsaPin}
                    onChange={(e) => setForm({ ...form, rsaPin: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Bank Details */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400">4. Bank Disbursement Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 mb-1 block">Bank Name</label>
                  <SearchableBankSelect
                    banks={banks}
                    value={form.bankSortCode}
                    onChange={(bank) => setForm({ ...form, bankSortCode: bank.code, bankName: bank.name })}
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Account Number</label>
                  <Input
                    placeholder="10 digits"
                    value={form.bankAccountNumber}
                    onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={verifyBankAccount} disabled={!form.bankAccountNumber || !form.bankSortCode} className="border-teal-700 text-teal-300 text-xs h-8">Verify account with Flutterwave</Button>
                  {form.bankAccountName && <span className="text-xs text-emerald-300">{form.bankAccountName}</span>}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="border-slate-800 text-slate-400 hover:text-white text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8"
              >
                {submitting ? (editingEmployeeId ? 'Saving changes…' : 'Creating Employee…') : (editingEmployeeId ? 'Save staff changes' : 'Save & Register Employee')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
