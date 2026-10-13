'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  CalendarCheck2,
  CalendarRange,
  Clock,
  Download,
  Receipt,
  Printer,
  ShieldCheck,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Bell,
  ClipboardCheck,
  MessageSquare,
  WalletCards,
  Timer,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeePortalFeedbackDialog, type EmployeePortalFeedback } from '@/components/hr/EmployeePortalFeedbackDialog';

export default function EmployeeSelfServicePage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Selected Payslip for printable view
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  // Leave Request Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fieldName: 'phone', proposedValue: '', reason: '' });
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportForm, setSupportForm] = useState({ category: 'PROFILE_UPDATE', subject: '', description: '' });
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyTicket, setReplyTicket] = useState<any | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({ date: '', requestedIn: '', requestedOut: '', reason: '' });
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({ principalAmount: '', tenorMonths: '6', reason: '' });
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState<EmployeePortalFeedback | null>(null);

  const showFeedback = (type: EmployeePortalFeedback['type'], title: string, message: string) => setFeedback({ type, title, message });

  const fetchSelfServiceData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/hr/self-service');
      if (res.ok) {
        const json = await res.json();
        setData(json.staff);
      } else {
        setLoadError('We could not load your employee records. Please try again.');
      }
    } catch (err) {
      console.error('Failed to load ESS data', err);
      setLoadError('We could not connect to the employee portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelfServiceData();
  }, []);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.id) return;
    setSubmitting(true);
    try {
      // Fetch a default leave type
      const ltRes = await fetch('/api/hr/leave');
      const ltJson = await ltRes.json();
      const firstType = ltJson.leaveTypes?.[0]?.id;

      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY_LEAVE',
          staffId: data.id,
          leaveTypeId: firstType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason,
        }),
      });

      if (res.ok) {
        setLeaveModalOpen(false);
        await fetchSelfServiceData();
        showFeedback('success', 'Leave request submitted', 'Your leave application has been sent to the configured approval workflow.');
      } else {
        showFeedback('error', 'Leave request was not submitted', (await res.json()).error || 'Please review the dates and try again.');
      }
    } catch (error: any) {
      showFeedback('error', 'Leave request was not submitted', error.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setActionError('');
    try {
      const res = await fetch('/api/hr/self-service/profile-changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit profile change');
      setProfileModalOpen(false); setProfileForm({ ...profileForm, proposedValue: '', reason: '' }); await fetchSelfServiceData(); showFeedback('success', 'Change request submitted', 'HR will review your update and notify you when a decision is made.');
    } catch (error: any) { setActionError(error.message); showFeedback('error', 'Could not submit change request', error.message); } finally { setSubmitting(false); }
  };

  const handleSupportRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setActionError('');
    try {
      const res = await fetch('/api/hr/service-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supportForm) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit HR request');
      setSupportModalOpen(false); setSupportForm({ ...supportForm, subject: '', description: '' }); await fetchSelfServiceData(); showFeedback('success', 'Request sent to HR', 'Your request has been created. You can track replies from your dashboard.');
    } catch (error: any) { setActionError(error.message); showFeedback('error', 'Could not contact HR', error.message); } finally { setSubmitting(false); }
  };

  const handleSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTicket || !replyBody.trim()) return;
    setSubmitting(true); setActionError('');
    try {
      const res = await fetch('/api/hr/service-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'REPLY', ticketId: replyTicket.id, body: replyBody }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to send reply');
      setReplyModalOpen(false); setReplyTicket(null); setReplyBody(''); await fetchSelfServiceData(); showFeedback('success', 'Reply sent', 'Your message has been added to the HR request.');
    } catch (error: any) { setActionError(error.message); showFeedback('error', 'Could not send reply', error.message); } finally { setSubmitting(false); }
  };

  const handleAttendanceCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setActionError('');
    try {
      const res = await fetch('/api/hr/attendance/missed-punch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attendanceForm) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit attendance correction');
      setAttendanceModalOpen(false); setAttendanceForm({ date: '', requestedIn: '', requestedOut: '', reason: '' }); await fetchSelfServiceData(); showFeedback('success', 'Attendance issue reported', 'Your correction request has been sent for supervisor review.');
    } catch (error: any) { setActionError(error.message); showFeedback('error', 'Could not report attendance issue', error.message); } finally { setSubmitting(false); }
  };

  const handleCancelLeave = async (applicationId: string) => {
    setActionError('');
    try {
      const res = await fetch('/api/hr/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CANCEL_APPLICATION', applicationId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to withdraw leave');
      await fetchSelfServiceData(); showFeedback('success', 'Leave request withdrawn', 'The pending leave application has been withdrawn.');
    } catch (error: any) { setActionError(error.message); showFeedback('error', 'Could not withdraw leave', error.message); }
  };

  const handleLoanRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setActionError('');
    try {
      const res = await fetch('/api/hr/benefits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CREATE_LOAN', ...loanForm }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit loan request');
      setLoanModalOpen(false); setLoanForm({ principalAmount: '', tenorMonths: '6', reason: '' }); await fetchSelfServiceData(); showFeedback('success', 'Loan application submitted', 'Your application is pending HR review and approval.');
    } catch (error: any) { setActionError(error.message); showFeedback('error', 'Could not submit loan application', error.message); } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Loading your employee portal…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="mb-3 h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Employee portal unavailable</h2>
        <p className="mt-2 text-xs text-slate-400">{loadError}</p>
        <Button onClick={fetchSelfServiceData} className="mt-5 bg-teal-600 text-xs hover:bg-teal-500">Try again</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">No Linked Employee Record</h2>
        <p className="text-xs text-slate-400 mt-1">
          Your user login is not yet linked to an active employee profile in LodgeCore HR. Contact your HR Manager to configure your staff profile.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-800/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-teal-950">
              {data.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{data.name}</h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {data.employeeCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.position} • {data.department}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Member of staff since {new Date(data.hireDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setProfileModalOpen(true)} className="h-9 !border-slate-700 !bg-slate-900 text-xs !text-slate-100 hover:!bg-slate-800">Update details</Button>
            <Button size="sm" variant="outline" onClick={() => setSupportModalOpen(true)} className="h-9 !border-slate-700 !bg-slate-900 text-xs !text-slate-100 hover:!bg-slate-800">Contact HR</Button>
            <Button size="sm" variant="outline" onClick={() => setAttendanceModalOpen(true)} className="h-9 !border-slate-700 !bg-slate-900 text-xs !text-slate-100 hover:!bg-slate-800">Report attendance issue</Button>
            <Button
              size="sm"
              onClick={() => setLeaveModalOpen(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              Request Leave
            </Button>
          </div>
        </div>
      </div>

      {/* Employee overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-teal-800/30 bg-teal-950/20 p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">Next shift</span><Timer className="h-4 w-4 text-teal-400" /></div>
          <p className="mt-3 truncate text-sm font-bold text-white">{data.upcomingShifts?.[0]?.shiftName || 'Not scheduled'}</p>
          <p className="mt-1 text-[11px] text-slate-400">{data.upcomingShifts?.[0] ? `${new Date(data.upcomingShifts[0].date).toLocaleDateString()} · ${data.upcomingShifts[0].times}` : 'Check with your supervisor'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#090e17] p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance</span><ClipboardCheck className="h-4 w-4 text-emerald-400" /></div>
          <p className="mt-3 text-sm font-bold text-white">{data.attendance?.filter((a: any) => ['PRESENT', 'LATE'].includes(a.status)).length || 0} days present</p>
          <p className="mt-1 text-[11px] text-slate-400">Last 31 days</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#090e17] p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last pay</span><WalletCards className="h-4 w-4 text-emerald-400" /></div>
          <p className="mt-3 text-sm font-bold text-emerald-300">{data.payslips?.[0] ? `₦${data.payslips[0].netPay?.toLocaleString()}` : 'Not available'}</p>
          <p className="mt-1 text-[11px] text-slate-400">{data.payslips?.[0]?.paymentStatus || 'Awaiting payroll'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#090e17] p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open requests</span><MessageSquare className="h-4 w-4 text-cyan-400" /></div>
          <p className="mt-3 text-sm font-bold text-white">{data.serviceRequests?.filter((r: any) => !['CLOSED', 'RESOLVED'].includes(r.status)).length || 0}</p>
          <p className="mt-1 text-[11px] text-slate-400">HR support requests</p>
        </div>
      </div>

      {(data.notifications?.length > 0 || data.missedPunchRequests?.length > 0 || data.serviceRequests?.length > 0) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#090e17] p-5 lg:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300"><Bell className="h-4 w-4" /> Recent notifications</h3>
            <div className="space-y-2">
              {(data.notifications || []).slice(0, 4).map((notification: any) => (
                <button type="button" key={notification.id} onClick={async () => { if (!notification.isRead) { await fetch('/api/hr/self-service/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: notification.id }) }); fetchSelfServiceData(); } }} className={`block w-full rounded-lg border p-3 text-left ${notification.isRead ? 'border-slate-800 bg-slate-950/40' : 'border-cyan-800/40 bg-cyan-950/20'}`}>
                  <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-white">{notification.subject || 'LodgeCore update'}</p><span className="text-[10px] text-slate-500">{new Date(notification.createdAt).toLocaleDateString()}</span></div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{notification.body}</p>
                </button>
              ))}
              {!data.notifications?.length && <p className="py-4 text-center text-xs text-slate-500">You have no new notifications.</p>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#090e17] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300"><AlertCircle className="h-4 w-4" /> Pending actions</h3>
            <div className="space-y-3 text-xs">
              {(data.missedPunchRequests || []).filter((r: any) => r.status === 'PENDING').slice(0, 3).map((request: any) => <div key={request.id} className="rounded-lg bg-slate-950 p-3 text-slate-300">Attendance correction for {new Date(request.date).toLocaleDateString()}<span className="mt-1 block text-[10px] text-amber-400">Awaiting review</span></div>)}
              {(data.serviceRequests || []).filter((r: any) => !['CLOSED', 'RESOLVED'].includes(r.status)).slice(0, 3).map((request: any) => <div key={request.id} className="rounded-lg bg-slate-950 p-3 text-slate-300"><div className="flex items-start justify-between gap-2"><span>{request.subject}</span><button type="button" onClick={() => { setReplyTicket(request); setReplyModalOpen(true); }} className="text-[10px] text-teal-300 hover:text-teal-200">Reply</button></div><span className="mt-1 block text-[10px] text-cyan-400">{request.status}</span></div>)}
              {!data.missedPunchRequests?.some((r: any) => r.status === 'PENDING') && !data.serviceRequests?.some((r: any) => !['CLOSED', 'RESOLVED'].includes(r.status)) && <p className="py-4 text-center text-slate-500">Nothing requires your attention.</p>}
            </div>
          </div>
        </div>
      )}

      {data.profileChangeRequests?.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#090e17] p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-300">Profile change requests</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.profileChangeRequests.slice(0, 6).map((request: any) => (
              <div key={request.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"><div className="flex justify-between gap-2"><span className="font-semibold text-white">{request.fieldName}</span><span className="text-violet-300">{request.status}</span></div><p className="mt-1 truncate text-slate-400">{request.proposedValue}</p></div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#090e17] p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300"><WalletCards className="h-4 w-4" /> My loans and deductions</h3><Button size="sm" onClick={() => setLoanModalOpen(true)} className="h-7 bg-emerald-700 px-2 text-[10px] hover:bg-emerald-600">Apply for loan</Button></div>
          {data.activeLoans?.length ? <div className="space-y-2">{data.activeLoans.map((loan: any) => <div key={loan.id} className="flex items-center justify-between rounded-lg bg-slate-950 p-3 text-xs"><div><p className="font-semibold text-white">Outstanding loan</p><p className="mt-1 text-slate-500">Monthly deduction ₦{loan.monthly?.toLocaleString()}</p></div><span className="font-mono font-bold text-amber-300">₦{loan.balance?.toLocaleString()}</span></div>)}</div> : <p className="py-6 text-center text-xs text-slate-500">No active loans or salary advances.</p>}
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#090e17] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300"><Building2 className="h-4 w-4" /> My documents</h3>
          {data.documents?.length ? <div className="space-y-2">{data.documents.slice(0, 5).map((document: any) => <a key={document.id} href={document.downloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-slate-950 p-3 text-xs hover:bg-slate-900"><div><p className="font-semibold text-white">{document.title}</p><p className="mt-1 text-slate-500">{document.category}{document.expiresAt ? ` · Expires ${new Date(document.expiresAt).toLocaleDateString()}` : ''}</p></div><span className="text-teal-300">Open →</span></a>)}</div> : <p className="py-6 text-center text-xs text-slate-500">No employee documents are available.</p>}
        </div>
      </div>

      {/* Grid: Shifts, Leave Balances, Statutory Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Upcoming Duty Shifts */}
        <div className="bg-[#090e17] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <CalendarRange className="w-4 h-4" />
            My Upcoming Shifts
          </h3>
          {data.upcomingShifts?.length > 0 ? (
            <div className="space-y-2">
              {data.upcomingShifts.map((s: any) => (
                <div key={s.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-[10px] text-slate-400">{s.shiftName}</p>
                  </div>
                  <span className="font-mono text-[10px] text-teal-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    {s.times}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">No shifts scheduled for this week.</p>
          )}
        </div>

        {/* Leave Balances */}
        <div className="bg-[#090e17] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <CalendarCheck2 className="w-4 h-4" />
            My Leave Balances
          </h3>
          {data.leaveBalances?.length > 0 ? (
            <div className="space-y-3">
              {data.leaveBalances.map((lb: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{lb.leaveType}</span>
                  <div className="text-right">
                    <span className="text-base font-bold text-emerald-400">{lb.remaining} days</span>
                    <span className="text-[10px] text-slate-500 block">of {lb.allocated} allocated</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Annual Statutory Leave</span>
              <div className="text-right">
                <span className="text-base font-bold text-emerald-400">20 days</span>
                <span className="text-[10px] text-slate-500 block">Annual entitlement</span>
              </div>
            </div>
          )}
          <div className="border-t border-slate-800 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent applications</p>
            <div className="space-y-2">{(data.leaves || []).slice(0, 3).map((leave: any) => <div key={leave.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 p-2 text-[11px]"><div><p className="font-medium text-slate-200">{leave.leaveType}</p><p className="text-slate-500">{new Date(leave.startDate).toLocaleDateString()} · {leave.days} day(s)</p></div><div className="text-right"><span className="text-amber-300">{leave.status}</span>{['PENDING_HOD', 'PENDING_HR'].includes(leave.status) && <button type="button" onClick={() => handleCancelLeave(leave.id)} className="mt-1 block text-[10px] text-rose-300 hover:text-rose-200">Withdraw</button>}</div></div>)}{!data.leaves?.length && <p className="text-[11px] text-slate-500">No recent applications.</p>}</div>
          </div>
        </div>

        {/* Statutory & Bank IDs */}
        <div className="bg-[#090e17] border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            Disbursement &amp; Pension IDs
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">BANK ACCOUNT</span>
              <p className="font-semibold text-white">{data.bankName}</p>
              <p className="font-mono text-slate-400 text-[11px]">{data.bankAccountNumber || 'Not configured'}</p>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">PENSION RSA PIN</span>
              <p className="font-semibold text-white">{data.pfaName}</p>
              <p className="font-mono text-slate-400 text-[11px]">{data.rsaPin || 'Not registered'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payslips Section */}
      <div className="bg-[#090e17] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal-400" />
            My Recent Payslips &amp; Salary History
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#060a12] border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Gross Earnings</th>
                <th className="py-3 px-4">Deductions (PAYE/Pension)</th>
                <th className="py-3 px-4">Net Salary Paid</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.payslips?.length > 0 ? (
                data.payslips.map((ps: any) => (
                  <tr key={ps.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-white">{ps.periodName}</td>
                    <td className="py-3 px-4 font-mono">₦{ps.grossPay?.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-amber-400">-₦{ps.deductions?.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">₦{ps.netPay?.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {ps.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPayslip({ ...ps, name: data.name, employeeCode: data.employeeCode, department: data.department, position: data.position, bankName: data.bankName });
                          setPayslipModalOpen(true);
                        }}
                        className="text-teal-400 hover:text-teal-300 text-xs h-7 px-2"
                      >
                        View &amp; Print Payslip &rarr;
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No historical payslips generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Payslip Modal */}
      <Dialog open={payslipModalOpen} onOpenChange={setPayslipModalOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-2xl border-slate-800 bg-[#0b1624] p-0 text-slate-100 shadow-2xl shadow-black/40">
          {selectedPayslip && (
            <div>
              <div className="p-6 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">LODGECORE PMS</h2>
                    <p className="text-[10px] text-teal-400 uppercase tracking-widest font-semibold">Official Payslip</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{selectedPayslip.periodName}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EMPLOYEE NAME</span>
                    <p className="font-bold text-white">{selectedPayslip.name}</p>
                    <p className="text-[10px] text-slate-400">{selectedPayslip.employeeCode}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">DEPARTMENT / ROLE</span>
                    <p className="font-medium text-slate-200">{selectedPayslip.position}</p>
                    <p className="text-[10px] text-slate-400">{selectedPayslip.department}</p>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-400 mb-2">Earnings</h4>
                  <div className="space-y-1.5 border-b border-slate-800 pb-3">
                    {selectedPayslip.components?.filter((c: any) => c.type === 'EARNING').map((c: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-300">{c.name}</span>
                        <span className="font-mono text-white">₦{c.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 font-bold">
                      <span className="text-slate-200">Gross Earnings</span>
                      <span className="font-mono text-white">₦{selectedPayslip.grossPay?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Deductions</h4>
                  <div className="space-y-1.5 border-b border-slate-800 pb-3">
                    {selectedPayslip.components?.filter((c: any) => c.type === 'DEDUCTION').map((c: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-300">{c.name}</span>
                        <span className="font-mono text-amber-400">-₦{c.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 font-bold">
                      <span className="text-slate-200">Total Deductions</span>
                      <span className="font-mono text-amber-400">-₦{selectedPayslip.deductions?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Net Salary Paid</span>
                    <p className="text-[10px] text-slate-400">Account: {selectedPayslip.bankName}</p>
                  </div>
                  <span className="text-xl font-bold font-mono text-emerald-300">
                    ₦{selectedPayslip.netPay?.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8 gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Payslip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Application Modal */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-teal-400" />
              Submit Leave Application
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Start Date *</label>
                <Input
                  type="date"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">End Date *</label>
                <Input
                  type="date"
                  required
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Reason / Handover Note</label>
              <Input
                placeholder="Reason for absence and relief handover"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setLeaveModalOpen(false)} className="h-8 !border-slate-800 !bg-slate-900 text-xs !text-slate-100 hover:!bg-slate-800">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">
                {submitting ? 'Submitting…' : 'Submit Application'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Request profile update</DialogTitle></DialogHeader>
          <form onSubmit={handleProfileChange} className="space-y-4 text-xs">
            <Select value={profileForm.fieldName} onValueChange={(fieldName) => setProfileForm({ ...profileForm, fieldName })}><SelectTrigger className="h-10 w-full !border-slate-700 !bg-slate-950 text-xs !text-slate-100"><SelectValue placeholder="Select a field to update" /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="phone">Phone number</SelectItem><SelectItem value="residentialAddress">Residential address</SelectItem><SelectItem value="maritalStatus">Marital status</SelectItem><SelectItem value="emergencyContacts">Emergency contacts</SelectItem><SelectItem value="nextOfKin">Next of kin</SelectItem><SelectItem value="bankName">Bank name</SelectItem><SelectItem value="bankAccountNumber">Bank account number</SelectItem><SelectItem value="bankSortCode">Bank sort code</SelectItem><SelectItem value="tin">Tax ID</SelectItem><SelectItem value="pfaName">Pension administrator</SelectItem><SelectItem value="rsaPin">Pension RSA PIN</SelectItem></SelectContent></Select>
            <Input required placeholder="Proposed value" value={profileForm.proposedValue} onChange={(e) => setProfileForm({ ...profileForm, proposedValue: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" />
            <Input placeholder="Reason (optional)" value={profileForm.reason} onChange={(e) => setProfileForm({ ...profileForm, reason: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" />
            {actionError && <p className="text-xs text-rose-400">{actionError}</p>}
            <DialogFooter><Button type="submit" disabled={submitting} className="bg-teal-600 text-xs hover:bg-teal-500">{submitting ? 'Submitting…' : 'Submit for review'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={supportModalOpen} onOpenChange={setSupportModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Contact HR</DialogTitle></DialogHeader>
          <form onSubmit={handleSupportRequest} className="space-y-4 text-xs">
            <Select value={supportForm.category} onValueChange={(category) => setSupportForm({ ...supportForm, category })}><SelectTrigger className="h-10 w-full !border-slate-700 !bg-slate-950 text-xs !text-slate-100"><SelectValue placeholder="Choose a request category" /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="PROFILE_UPDATE">Profile update</SelectItem><SelectItem value="SALARY_INQUIRY">Salary inquiry</SelectItem><SelectItem value="LEAVE_INQUIRY">Leave inquiry</SelectItem><SelectItem value="BENEFIT">Benefits</SelectItem><SelectItem value="EMPLOYMENT_LETTER">Employment letter</SelectItem><SelectItem value="GRIEVANCE">Confidential concern</SelectItem></SelectContent></Select>
            <Input required placeholder="Subject" value={supportForm.subject} onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" />
            <textarea required placeholder="Describe your request" value={supportForm.description} onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })} className="min-h-28 w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100" />
            {actionError && <p className="text-xs text-rose-400">{actionError}</p>}
            <DialogFooter><Button type="submit" disabled={submitting} className="bg-teal-600 text-xs hover:bg-teal-500">{submitting ? 'Submitting…' : 'Submit request'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Reply to HR request</DialogTitle></DialogHeader>
          <div className="mb-2 rounded-lg bg-slate-950 p-3 text-xs text-slate-400">{replyTicket?.subject}</div>
          {replyTicket?.messages?.length > 0 && <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg border border-slate-800 p-3 text-xs">{replyTicket.messages.map((message: any) => <div key={message.id}><p className="text-slate-300">{message.body}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(message.createdAt).toLocaleString()}</p></div>)}</div>}
          <form onSubmit={handleSupportReply} className="space-y-4 text-xs"><textarea required placeholder="Write a reply or provide additional information" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} className="min-h-24 w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100" />{actionError && <p className="text-xs text-rose-400">{actionError}</p>}<DialogFooter><Button type="submit" disabled={submitting} className="bg-teal-600 text-xs hover:bg-teal-500">{submitting ? 'Sending…' : 'Send reply'}</Button></DialogFooter></form>
        </DialogContent>
      </Dialog>

      <Dialog open={attendanceModalOpen} onOpenChange={setAttendanceModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Report attendance issue</DialogTitle></DialogHeader>
          <form onSubmit={handleAttendanceCorrection} className="space-y-4 text-xs">
            <Input required type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" />
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-slate-400">Requested clock-in</label><Input type="datetime-local" value={attendanceForm.requestedIn} onChange={(e) => setAttendanceForm({ ...attendanceForm, requestedIn: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" /></div><div><label className="mb-1 block text-slate-400">Requested clock-out</label><Input type="datetime-local" value={attendanceForm.requestedOut} onChange={(e) => setAttendanceForm({ ...attendanceForm, requestedOut: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" /></div></div>
            <textarea required placeholder="Explain what happened" value={attendanceForm.reason} onChange={(e) => setAttendanceForm({ ...attendanceForm, reason: e.target.value })} className="min-h-24 w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100" />
            {actionError && <p className="text-xs text-rose-400">{actionError}</p>}
            <DialogFooter><Button type="submit" disabled={submitting} className="bg-teal-600 text-xs hover:bg-teal-500">{submitting ? 'Submitting…' : 'Submit for review'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={loanModalOpen} onOpenChange={setLoanModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40"><DialogHeader><DialogTitle className="text-sm font-bold text-white">Apply for employee loan</DialogTitle></DialogHeader><form onSubmit={handleLoanRequest} className="space-y-4 text-xs"><Input required type="number" min="1" placeholder="Requested amount" value={loanForm.principalAmount} onChange={(e) => setLoanForm({ ...loanForm, principalAmount: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" /><Input required type="number" min="1" max="60" placeholder="Repayment term in months" value={loanForm.tenorMonths} onChange={(e) => setLoanForm({ ...loanForm, tenorMonths: e.target.value })} className="border-slate-800 bg-slate-950 text-xs" /><textarea required placeholder="Reason for request" value={loanForm.reason} onChange={(e) => setLoanForm({ ...loanForm, reason: e.target.value })} className="min-h-24 w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100" />{actionError && <p className="text-xs text-rose-400">{actionError}</p>}<DialogFooter><Button type="submit" disabled={submitting} className="bg-emerald-700 text-xs hover:bg-emerald-600">{submitting ? 'Submitting…' : 'Submit application'}</Button></DialogFooter></form></DialogContent>
      </Dialog>
      <EmployeePortalFeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </div>
  );
}
