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

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

  // Drawer & Modal States
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);

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
    selfServicePassword: '',
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/employees?limit=200');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
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
        setAddModalOpen(false);
        setEditingEmployeeId(null);
        fetchEmployees();
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
          selfServicePassword: '',
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
    }));
    setDrawerOpen(false);
    setAddModalOpen(true);
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
            <option value="TERMINATED">Terminated</option>
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

      {/* Add Employee Dialog Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
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
                {!editingEmployeeId && <div className="col-span-2">
                  <label className="text-slate-400 mb-1 block">Self-service password *</label>
                  <Input
                    required={!editingEmployeeId}
                    minLength={8}
                    type="password"
                    placeholder="At least 8 characters"
                    value={form.selfServicePassword}
                    onChange={(e) => setForm({ ...form, selfServicePassword: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">The employee uses this password together with their Employer ID.</p>
                </div>}
              </div>
            </div>

            {/* Section 2: Department & Role */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400">2. Job &amp; Organizational Placement</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 mb-1 block">Department</label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => {
                      const dept = departments.find((d) => d.id === e.target.value);
                      setForm({
                        ...form,
                        departmentId: e.target.value,
                        departmentName: dept?.name || '',
                        jobPositionId: '',
                        positionTitle: '',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Job Position</label>
                  <select
                    value={form.jobPositionId}
                    onChange={(e) => {
                      const pos = positions.find((p) => p.id === e.target.value);
                      setForm({
                        ...form,
                        jobPositionId: e.target.value,
                        positionTitle: pos?.title || '',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
                  >
                    <option value="">Select Position</option>
                    {positions.filter((p) => !form.departmentId || p.departmentId === form.departmentId).map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Employment Type</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="CASUAL">Casual</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Employment Status</label>
                  <select
                    value={form.employmentStatus}
                    onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs px-2.5 h-8 outline-none"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PROBATION">Probation</option>
                    <option value="ON_LEAVE">On leave</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
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
                  <select value={form.bankSortCode} onChange={(e) => { const bank = banks.find(item => item.code === e.target.value); setForm({ ...form, bankSortCode: e.target.value, bankName: bank?.name || '' }); }} className="w-full rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-xs h-8 px-2">
                    <option value="">Select bank from Flutterwave</option>
                    {banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name} ({bank.code})</option>)}
                  </select>
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
