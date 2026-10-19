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
  ChevronRight,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/hr/EmployeePortalDialog';
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
    handover: '',
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
  const [loanForm, setLoanForm] = useState({ principalAmount: '', tenorMonths: '6', purpose: 'PERSONAL_SUPPORT', additionalDetails: '', consent: false });
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState<EmployeePortalFeedback | null>(null);
  const [punching, setPunching] = useState(false);
  const [referralBusy, setReferralBusy] = useState(false);
  const [swapRows, setSwapRows] = useState<any[]>([]);
  const [swapStaff, setSwapStaff] = useState<any[]>([]);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapForm, setSwapForm] = useState({ targetStaffId: '', requesterDate: '', targetDate: '', reason: '' });
  const [penaltyRows, setPenaltyRows] = useState<any[]>([]);

  const showFeedback = (type: EmployeePortalFeedback['type'], title: string, message: string) => setFeedback({ type, title, message });

  const activateReferral = async () => {
    if (!window.confirm('Activate your staff referral account and start earning commission through your personal link?')) return;
    setReferralBusy(true);
    try {
      const response = await fetch('/api/hr/self-service/referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to activate referrals');
      await fetchSelfServiceData();
      showFeedback('success', 'Referral account activated', 'Your personal referral link is ready to share.');
    } catch (error: any) {
      showFeedback('error', 'Unable to activate referrals', error.message || 'Please try again.');
    } finally { setReferralBusy(false); }
  };

  const fetchSelfServiceData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/hr/self-service');
      if (res.ok) {
        const json = await res.json();
        setData(json.staff);
        await fetchSwapData();
        const penaltyResponse = await fetch('/api/hr/attendance/penalties');
        if (penaltyResponse.ok) setPenaltyRows((await penaltyResponse.json()).assessments || []);
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

  const fetchSwapData = async () => {
    try {
      const response = await fetch('/api/hr/shifts/swaps');
      const json = await response.json();
      if (response.ok) {
        setSwapRows(json.swaps || []);
        setSwapStaff(json.availableStaff || []);
      }
    } catch (error) {
      console.error('Failed to load shift swaps', error);
    }
  };

  useEffect(() => {
    fetchSelfServiceData();
  }, []);

  const handleRequestSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/hr/shifts/swaps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(swapForm),
      });
      const json = await response.json();
      if (!response.ok) return showFeedback('error', 'Swap request was not submitted', json.error || 'Please review the selected shifts.');
      setSwapModalOpen(false);
      setSwapForm({ targetStaffId: '', requesterDate: '', targetDate: '', reason: '' });
      await fetchSwapData();
      showFeedback('success', 'Swap request sent', 'The other employee must accept it before HR can acknowledge the change.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwapAction = async (id: string, action: string) => {
    const response = await fetch('/api/hr/shifts/swaps', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action, ...(action === 'PEER_REJECT' ? { reason: 'Target employee declined the request' } : {}) }) });
    const json = await response.json();
    if (!response.ok) return showFeedback('error', 'Unable to update swap', json.error || 'Please try again.');
    await fetchSwapData();
    showFeedback('success', action === 'PEER_APPROVE' ? 'Swap accepted' : action === 'PEER_REJECT' ? 'Swap declined' : 'Swap cancelled', 'The swap status has been updated.');
  };

  const appealPenalty = async (id: string) => {
    const reason = window.prompt('Explain why you are appealing this attendance charge (minimum 10 characters):') || '';
    if (reason.trim().length < 10) return;
    const response = await fetch('/api/hr/attendance/penalties', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'APPEAL', reason }) });
    const json = await response.json();
    if (!response.ok) return showFeedback('error', 'Appeal was not submitted', json.error || 'Please try again.');
    const penaltyResponse = await fetch('/api/hr/attendance/penalties');
    if (penaltyResponse.ok) setPenaltyRows((await penaltyResponse.json()).assessments || []);
    showFeedback('success', 'Appeal submitted', 'HR will review the charge before it can be applied to payroll.');
  };

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
          reason: `${leaveForm.reason.trim()}${leaveForm.handover.trim() ? `\nHandover plan: ${leaveForm.handover.trim()}` : ''}`,
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
      const clarification = data?.profileChangeRequests?.find((request: any) => request.fieldName === profileForm.fieldName && request.status === 'CLARIFICATION');
      const res = await fetch('/api/hr/self-service/profile-changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profileForm, requestId: clarification?.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit profile change');
      setProfileModalOpen(false); setProfileForm({ ...profileForm, proposedValue: '', reason: '' }); await fetchSelfServiceData(); showFeedback('success', clarification ? 'Change request resubmitted' : 'Change request submitted', clarification ? 'Your clarification has been sent back for review.' : 'HR will review your update and notify you when a decision is made.');
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

  const handleAttendancePunch = async (action: 'CLOCK_IN' | 'CLOCK_OUT') => {
    setActionError('');
    setPunching(true);
    try {
      if (!navigator.geolocation) throw new Error('Location services are not available on this device.');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      const res = await fetch('/api/hr/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, punchSource: window.matchMedia('(max-width: 1023px)').matches ? 'MOBILE' : 'WEB', date: new Date().toISOString(), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to record attendance');
      await fetchSelfServiceData();
      showFeedback('success', action === 'CLOCK_IN' ? 'Clocked in' : 'Clocked out', 'Your attendance record has been updated.');
    } catch (error: any) {
      const locationMessage = error?.code === 1 ? 'Location permission was denied. Enable location access for LodgeCore and try again.' : error?.code === 2 ? 'Your device could not determine its location. Move to an open area and try again.' : error?.code === 3 ? 'Location lookup timed out. Try again with GPS enabled.' : error.message;
      setActionError(locationMessage); showFeedback('error', 'Attendance was not recorded', locationMessage);
    } finally { setPunching(false); }
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
    if (!loanForm.consent) { showFeedback('error', 'Confirmation required', 'Please confirm that the information supplied is accurate before submitting your loan application.'); return; }
    setSubmitting(true); setActionError('');
    try {
      const res = await fetch('/api/hr/benefits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CREATE_LOAN', principalAmount: loanForm.principalAmount, tenorMonths: loanForm.tenorMonths, reason: `${loanForm.purpose}: ${loanForm.additionalDetails.trim()}` }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit loan request');
      setLoanModalOpen(false); setLoanForm({ principalAmount: '', tenorMonths: '6', purpose: 'PERSONAL_SUPPORT', additionalDetails: '', consent: false }); await fetchSelfServiceData(); showFeedback('success', 'Loan application submitted', 'Your application is pending HR review and approval. HR will review your eligibility, affordability, and repayment terms.');
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

  const pendingPunches = (data.missedPunchRequests || []).filter((r: any) => r.status === 'PENDING');
  const todayPunch = (data.attendance || []).find((record: any) => new Date(record.date).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));
  const openRequests = (data.serviceRequests || []).filter((r: any) => !['CLOSED', 'RESOLVED'].includes(r.status));
  const openPayslip = (ps: any) => {
    setSelectedPayslip({ ...ps, name: data.name, employeeCode: data.employeeCode, department: data.department, position: data.position, bankName: data.bankName });
    setPayslipModalOpen(true);
  };

  return (
    <div>
      {/* Desktop: original design */}
      <div className="ess-page hidden lg:block p-8 space-y-6 max-w-7xl mx-auto">
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
            <Link href="/hr/self-service/compensation" className="inline-flex h-9 items-center rounded-md border border-emerald-800 bg-emerald-950/40 px-3 text-xs text-emerald-200 hover:bg-emerald-900/50">Compensation</Link>
          <Button size="sm" onClick={() => handleAttendancePunch('CLOCK_IN')} className="h-9 bg-emerald-700 text-xs text-white hover:bg-emerald-600">Clock in</Button><Button size="sm" onClick={() => handleAttendancePunch('CLOCK_OUT')} className="h-9 bg-slate-700 text-xs text-white hover:bg-slate-600">Clock out</Button><Button size="sm" variant="outline" onClick={() => setAttendanceModalOpen(true)} className="h-9 !border-slate-700 !bg-slate-900 text-xs !text-slate-100 hover:!bg-slate-800">Report attendance issue</Button>
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

      <section id="staff-referrals-desktop" className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300"><Share2 className="h-4 w-4" /> Staff referrals</h3><p className="mt-2 text-sm font-semibold text-white">Earn commission automatically through your personal referral link.</p><p className="mt-1 text-xs text-slate-400">Approved commissions are added to your next payslip after the guest completes their stay.</p></div>
          {!data.referral?.programmeEnabled ? <span className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">Not active for this property</span> : !data.referral?.isEnrolled ? <Button type="button" disabled={referralBusy} onClick={() => void activateReferral()} className="bg-purple-500 text-xs font-bold text-white hover:bg-purple-400">{referralBusy ? 'Activating…' : 'Activate referral account'}</Button> : <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg border border-purple-300/20 bg-slate-950/60 px-3 py-2 font-mono text-xs text-purple-200">{data.referral.shareLink || 'Link ready'}</span><Button type="button" onClick={() => { void navigator.clipboard?.writeText(data.referral.shareLink || ''); showFeedback('success', 'Link copied', 'Your referral link is ready to share.'); }} className="bg-purple-500 text-xs font-bold text-white hover:bg-purple-400">Copy link</Button><Button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Book through my LodgeCore referral link: ${data.referral.shareLink || ''}`)}`, '_blank', 'noopener,noreferrer')} className="border border-purple-300/30 bg-transparent text-xs font-bold text-purple-200 hover:bg-purple-400/10">WhatsApp</Button></div>}
        </div>
        {data.referral?.isEnrolled && <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-lg border border-white/10 bg-slate-950/50 p-3"><p className="text-[10px] text-slate-500">Clicks</p><p className="mt-1 text-lg font-bold text-white">{data.referral.totalClicks || 0}</p></div><div className="rounded-lg border border-white/10 bg-slate-950/50 p-3"><p className="text-[10px] text-slate-500">Confirmed stays</p><p className="mt-1 text-lg font-bold text-white">{data.referral.confirmedBookings || 0}</p></div><div className="rounded-lg border border-white/10 bg-slate-950/50 p-3"><p className="text-[10px] text-slate-500">Next payslip</p><p className="mt-1 text-lg font-bold text-amber-300">{naira(data.referral.pendingOnNextPayslip || 0)}</p></div><div className="rounded-lg border border-white/10 bg-slate-950/50 p-3"><p className="text-[10px] text-slate-500">Total earned</p><p className="mt-1 text-lg font-bold text-emerald-300">{naira(data.referral.totalEarned || 0)}</p></div></div>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#090e17] p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300"><CalendarRange className="h-4 w-4" /> Shift swaps</h3>
            <p className="mt-1 text-[11px] text-slate-500">Request a swap with a colleague. They must accept before HR acknowledges it.</p>
          </div>
          <Button type="button" onClick={() => setSwapModalOpen(true)} className="h-8 bg-cyan-700 text-xs text-white hover:bg-cyan-600">Request a shift swap</Button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {swapRows.map((swap) => <div key={swap.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{swap.requesterStaff?.firstName} {swap.requesterStaff?.lastName} ↔ {swap.targetStaff?.firstName} {swap.targetStaff?.lastName}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(swap.requesterDate).toLocaleDateString()} ↔ {new Date(swap.targetDate).toLocaleDateString()}</p></div><span className="text-[10px] text-amber-300">{swap.status}</span></div><p className="mt-2 text-slate-400">{swap.reason}</p><div className="mt-3 flex gap-3">{swap.status === 'PENDING_PEER' && swap.targetStaffId === data?.id && <><button type="button" className="text-emerald-300" onClick={() => void handleSwapAction(swap.id, 'PEER_APPROVE')}>Accept</button><button type="button" className="text-rose-300" onClick={() => void handleSwapAction(swap.id, 'PEER_REJECT')}>Decline</button></>}{swap.requesterStaffId === data?.id && ['PENDING_PEER', 'PENDING_SUPERVISOR'].includes(swap.status) && <button type="button" className="text-slate-400" onClick={() => void handleSwapAction(swap.id, 'CANCEL_REQUEST')}>Cancel</button>}</div></div>)}
          {!swapRows.length && <p className="py-5 text-center text-xs text-slate-500 md:col-span-2">No shift swap requests.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-amber-800/40 bg-amber-950/10 p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300"><AlertCircle className="h-4 w-4" /> Attendance charges</h3><p className="mt-1 text-[11px] text-slate-500">Review charges raised from attendance. You may appeal before payroll application.</p></div><span className="text-[10px] text-amber-300">{penaltyRows.length} record(s)</span></div>
        <div className="mt-3 space-y-2">{penaltyRows.map((penalty) => <div key={penalty.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs sm:flex-row sm:items-center"><div><p className="font-semibold text-white">{penalty.policy?.name || 'Attendance charge'}</p><p className="mt-1 text-slate-400">{new Date(penalty.eventDate).toLocaleDateString()} · {penalty.trigger.replaceAll('_', ' ')} · <span className="font-mono text-amber-300">₦{Number(penalty.assessedAmount).toLocaleString()}</span></p><p className="mt-1 text-[10px] text-slate-500">Status: {penalty.status}{penalty.appealStatus ? ` · Appeal ${penalty.appealStatus}` : ''}</p></div>{['PENDING', 'APPROVED'].includes(penalty.status) && !penalty.appealStatus && !penalty.payrollPeriodId && <Button type="button" size="sm" onClick={() => void appealPenalty(penalty.id)} className="h-7 bg-amber-700 px-2 text-[10px] text-white hover:bg-amber-600">Appeal charge</Button>}</div>)}{!penaltyRows.length && <p className="py-4 text-center text-xs text-slate-500">No attendance charges.</p>}</div>
      </section>

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

      </div>

      {/* Mobile: app-style design */}
      <div className="ess-page mx-auto max-w-2xl space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pt-6 lg:hidden">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-teal-400/20 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.22),transparent_45%),linear-gradient(135deg,#102d39_0%,#0b1725_60%,#08111d_100%)] p-5 sm:p-7">
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-emerald-600 text-lg font-black text-white shadow-xl shadow-teal-950/50 sm:h-16 sm:w-16">{data.name.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">{greeting()}</p>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">{data.status || 'Active'}</span>
            </div>
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{data.name.split(' ')[0]}</h1>
            <p className="mt-0.5 truncate text-sm text-slate-400">{data.position} · {data.department}</p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-mono text-teal-200">{data.employeeCode}</span>
          <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1">Since {fmtDate(data.hireDate)}</span>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-label="Mobile attendance" className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/50 to-slate-950 p-4 shadow-xl shadow-emerald-950/20">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Today&apos;s attendance</p><p className="mt-1 text-sm font-semibold text-white">{todayPunch?.clockIn ? todayPunch.clockOut ? 'Shift completed' : 'Currently clocked in' : 'Not clocked in yet'}</p><p className="mt-1 text-xs text-slate-400">{todayPunch?.clockIn ? `In ${new Date(todayPunch.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${todayPunch.clockOut ? ` · Out ${new Date(todayPunch.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Use your phone to record your shift start.'}</p></div>
          <Clock className="h-7 w-7 shrink-0 text-emerald-300" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" disabled={punching || Boolean(todayPunch?.clockIn)} onClick={() => void handleAttendancePunch('CLOCK_IN')} className="h-11 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{punching ? 'Saving…' : 'Check in'}</Button>
          <Button type="button" disabled={punching || !todayPunch?.clockIn || Boolean(todayPunch?.clockOut)} onClick={() => void handleAttendancePunch('CLOCK_OUT')} className="h-11 bg-slate-700 text-sm font-bold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50">{punching ? 'Saving…' : 'Check out'}</Button>
        </div>
        {actionError && <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{actionError}</p>}
      </section>
      <section aria-label="Quick actions" className="!shadow-none">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Leave', icon: CalendarCheck2, tone: 'text-teal-300 bg-teal-400/10', onClick: () => setLeaveModalOpen(true) },
            { label: 'Time fix', icon: Clock, tone: 'text-amber-300 bg-amber-400/10', onClick: () => setAttendanceModalOpen(true) },
            { label: 'Loan', icon: CreditCard, tone: 'text-emerald-300 bg-emerald-400/10', onClick: () => setLoanModalOpen(true) },
            { label: 'Ask HR', icon: MessageSquare, tone: 'text-cyan-300 bg-cyan-400/10', onClick: () => setSupportModalOpen(true) },
            { label: 'Payslips', icon: Receipt, tone: 'text-sky-300 bg-sky-400/10', href: '/hr/self-service/pay' },
            { label: 'Compensation', icon: WalletCards, tone: 'text-emerald-300 bg-emerald-400/10', href: '/hr/self-service/compensation' },
            { label: 'Security', icon: ShieldCheck, tone: 'text-slate-200 bg-white/10', href: '/hr/self-service/security' },
            { label: 'Referrals', icon: Share2, tone: 'text-purple-300 bg-purple-400/10', href: '/hr/self-service/referrals' },
            { label: 'Shift swaps', icon: CalendarRange, tone: 'text-cyan-300 bg-cyan-400/10', onClick: () => setSwapModalOpen(true) },
          ].map(({ label, icon: Icon, tone, onClick, href }) => {
            const inner = (<><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span><span className="text-[11px] font-semibold text-slate-300">{label}</span></>);
            const cls = 'flex flex-col items-center gap-1.5 rounded-2xl border border-white/5 bg-[#0b1624] py-3 transition active:scale-95 hover:border-white/15';
            return href ? <Link key={label} href={href} className={cls}>{inner}</Link> : <button key={label} type="button" onClick={onClick} className={cls}>{inner}</button>;
          })}
        </div>
      </section>

      <section aria-label="Mobile shift swaps" className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 to-slate-950 p-4 lg:hidden">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Shift swaps</p><p className="mt-1 text-xs text-slate-400">Request, accept, or track a colleague swap.</p></div><Button type="button" onClick={() => setSwapModalOpen(true)} className="h-8 bg-cyan-700 px-3 text-xs text-white hover:bg-cyan-600">Request</Button></div>
        <div className="mt-3 space-y-2">{swapRows.slice(0, 3).map((swap) => <div key={swap.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-white">{swap.requesterStaff?.firstName} ↔ {swap.targetStaff?.firstName}</span><span className="shrink-0 text-[10px] text-amber-300">{swap.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{new Date(swap.requesterDate).toLocaleDateString()} ↔ {new Date(swap.targetDate).toLocaleDateString()}</p>{swap.status === 'PENDING_PEER' && swap.targetStaffId === data?.id && <div className="mt-2 flex gap-3"><button type="button" className="text-emerald-300" onClick={() => void handleSwapAction(swap.id, 'PEER_APPROVE')}>Accept</button><button type="button" className="text-rose-300" onClick={() => void handleSwapAction(swap.id, 'PEER_REJECT')}>Decline</button></div>}</div>)}{!swapRows.length && <p className="py-3 text-center text-xs text-slate-500">No shift swap requests.</p>}</div>
      </section>

      {/* Stats — swipeable on mobile */}
      <section aria-label="Overview" className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden !shadow-none">
        <StatCard label="Next shift" icon={Timer} accent value={data.upcomingShifts?.[0]?.shiftName || 'Not scheduled'} sub={data.upcomingShifts?.[0] ? `${fmtDate(data.upcomingShifts[0].date)} · ${data.upcomingShifts[0].times}` : 'Check with your supervisor'} />
        <StatCard label="Attendance" icon={ClipboardCheck} value={`${data.attendance?.filter((a: any) => ['PRESENT', 'LATE'].includes(a.status)).length || 0} days`} sub="Present · last 31 days" />
        <StatCard label="Last pay" icon={WalletCards} value={data.payslips?.[0] ? naira(data.payslips[0].netPay) : '—'} valueClass="text-emerald-300" sub={data.payslips?.[0]?.paymentStatus || 'Awaiting payroll'} />
        <StatCard label="Open requests" icon={MessageSquare} value={String(openRequests.length)} sub="HR support tickets" />
      </section>

      {/* Action center */}
      <Card title="Needs your attention" eyebrow="Action center" eyebrowClass="text-amber-300" icon={<AlertCircle className="h-5 w-5 text-amber-300" />}>
        <div className="space-y-2">
          {pendingPunches.slice(0, 3).map((request: any) => (
            <ListRow key={request.id} onClick={() => setAttendanceModalOpen(true)} title="Attendance correction" sub={`${fmtDate(request.date)} · Awaiting review`} subClass="text-amber-300" />
          ))}
          {openRequests.slice(0, 3).map((request: any) => (
            <ListRow key={request.id} onClick={() => { setReplyTicket(request); setReplyModalOpen(true); }} title={request.subject} sub={`${String(request.status).replaceAll('_', ' ')} · Tap to reply`} subClass="text-cyan-300" />
          ))}
          {!pendingPunches.length && !openRequests.length && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
              <div><p className="text-sm font-semibold text-emerald-200">You’re all caught up</p><p className="text-xs text-slate-500">No pending actions right now.</p></div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Latest pay */}
        <Card title="Your latest earnings" eyebrow="Payroll" action={<Link href="/hr/self-service/pay" className="text-xs font-semibold text-teal-300">View all →</Link>}>
          {data.payslips?.[0] ? (
            <div className="rounded-2xl border border-teal-400/15 bg-gradient-to-br from-teal-400/[0.10] to-slate-950/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{data.payslips[0].periodName}</p>
                  <p className="mt-1 text-3xl font-black text-white">{naira(data.payslips[0].netPay)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Net salary · {data.payslips[0].paymentStatus}</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{data.payslips[0].status}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-xs">
                <div><p className="text-[10px] text-slate-500">Gross</p><p className="mt-0.5 font-bold text-slate-200">{naira(data.payslips[0].grossPay)}</p></div>
                <div><p className="text-[10px] text-slate-500">Deductions</p><p className="mt-0.5 font-bold text-amber-300">{naira(data.payslips[0].deductions)}</p></div>
                <div><p className="text-[10px] text-slate-500">Paid on</p><p className="mt-0.5 font-bold text-slate-200">{data.payslips[0].paymentDate ? fmtDate(data.payslips[0].paymentDate) : 'Pending'}</p></div>
              </div>
              <Button onClick={() => openPayslip(data.payslips[0])} className="mt-4 h-11 w-full gap-2 bg-teal-500 text-sm font-bold text-slate-950 hover:bg-teal-400"><Receipt className="h-4 w-4" /> View payslip</Button>
            </div>
          ) : (
            <Empty icon={<Receipt className="h-8 w-8 text-slate-700" />} title="No finalized payslip yet" sub="Your payslips will appear here once published." />
          )}
        </Card>

        {/* Shifts */}
        <Card title="Upcoming shifts" eyebrow="Schedule" eyebrowClass="text-cyan-300" icon={<CalendarRange className="h-5 w-5 text-cyan-300" />}>
          {data.upcomingShifts?.length ? (
            <div className="space-y-2">
              {data.upcomingShifts.slice(0, 5).map((s: any) => {
                const d = new Date(s.date);
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-400/10 text-teal-200">
                      <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="text-lg font-black leading-none">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{s.shiftName}</p><p className="text-xs text-slate-500">{d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p></div>
                    <span className="shrink-0 rounded-lg bg-teal-400/10 px-2 py-1 font-mono text-[11px] text-teal-300">{s.times}</span>
                  </div>
                );
              })}
            </div>
          ) : <Empty icon={<CalendarRange className="h-8 w-8 text-slate-700" />} title="No shifts scheduled" sub="Your roster for this week will show here." />}
        </Card>
      </div>

      {/* Leave */}
      <Card title="Leave balance" eyebrow="Time off" eyebrowClass="text-amber-300" action={<button type="button" onClick={() => setLeaveModalOpen(true)} className="flex items-center gap-1 rounded-full bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-300 active:scale-95"><Plus className="h-3.5 w-3.5" /> Request</button>}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data.leaveBalances?.length ? data.leaveBalances : [{ leaveType: 'Annual leave', remaining: 20, allocated: 20 }]).map((lb: any, i: number) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-slate-950/50 p-3">
              <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm text-slate-300">{lb.leaveType}</span><span className="shrink-0 text-lg font-black text-emerald-300">{lb.remaining}<span className="ml-1 text-[10px] font-medium text-slate-500">/ {lb.allocated} days</span></span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{ width: `${Math.min(100, (Number(lb.remaining) / Math.max(1, Number(lb.allocated))) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent applications</p>
        <div className="space-y-2">
          {(data.leaves || []).slice(0, 4).map((leave: any) => (
            <div key={leave.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{leave.leaveType}</p><p className="text-xs text-slate-500">{fmtDate(leave.startDate)} · {leave.days} day(s)</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusPill status={leave.status} />
                {['PENDING_HOD', 'PENDING_HR'].includes(leave.status) && <button type="button" onClick={() => handleCancelLeave(leave.id)} className="py-1 text-[11px] font-semibold text-rose-300">Withdraw</button>}
              </div>
            </div>
          ))}
          {!data.leaves?.length && <p className="text-xs text-slate-500">No recent applications.</p>}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Loans */}
        <Card title="Loans & deductions" eyebrow="Benefits" eyebrowClass="text-emerald-300" action={<button type="button" onClick={() => setLoanModalOpen(true)} className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 active:scale-95">Apply</button>}>
          {data.activeLoans?.length ? (
            <div className="space-y-2">{data.activeLoans.map((loan: any) => (
              <div key={loan.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/50 p-3">
                <div><p className="text-sm font-semibold text-white">Outstanding loan</p><p className="text-xs text-slate-500">{naira(loan.monthly)} / month</p></div>
                <span className="font-mono text-sm font-bold text-amber-300">{naira(loan.balance)}</span>
              </div>
            ))}</div>
          ) : <Empty icon={<CreditCard className="h-8 w-8 text-slate-700" />} title="No active loans" sub="Salary advances and loans will show here." />}
        </Card>

        {/* Documents */}
        <Card title="My documents" eyebrow="Secure records" eyebrowClass="text-violet-300" icon={<Building2 className="h-5 w-5 text-violet-300" />}>
          {data.documents?.length ? (
            <div className="space-y-2">{data.documents.slice(0, 5).map((document: any) => (
              <a key={document.id} href={document.downloadUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3 active:scale-[.99]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><Download className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{document.title}</p><p className="truncate text-xs text-slate-500">{document.category}{document.expiresAt ? ` · Expires ${fmtDate(document.expiresAt)}` : ''}</p></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </a>
            ))}</div>
          ) : <Empty icon={<Building2 className="h-8 w-8 text-slate-700" />} title="No documents yet" sub="Contracts and letters will appear here." />}
        </Card>
      </div>

      <section id="staff-referrals" className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-950/40 to-slate-950 p-5 shadow-xl shadow-purple-950/10">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Staff referrals</p><h2 className="mt-1 text-xl font-black text-white">Earn commission through your personal link</h2><p className="mt-1 max-w-2xl text-sm text-slate-400">When a guest books through your link and completes their stay, the approved commission is added automatically to your next payslip.</p></div><Share2 className="h-7 w-7 shrink-0 text-purple-300" /></div>
        {!data.referral?.programmeEnabled ? <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">Staff referrals are not active for your property yet. Your HR team will notify you when the programme is enabled.</div> : !data.referral?.isEnrolled ? <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl border border-purple-300/20 bg-purple-400/10 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold text-white">Activate your referral account</p><p className="mt-1 text-xs text-slate-400">Current commission rate: {((data.referral?.commissionBps || 0) / 100).toFixed(2)}% of eligible room revenue.</p></div><Button type="button" disabled={referralBusy} onClick={() => void activateReferral()} className="bg-purple-500 font-bold text-white hover:bg-purple-400">{referralBusy ? 'Activating…' : 'Activate my link'}</Button></div> : <div className="mt-5 space-y-4"><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-[10px] text-slate-500">Clicks</p><p className="mt-1 text-xl font-black text-white">{data.referral.totalClicks || 0}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-[10px] text-slate-500">Confirmed stays</p><p className="mt-1 text-xl font-black text-white">{data.referral.confirmedBookings || 0}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-[10px] text-slate-500">Next payslip</p><p className="mt-1 text-xl font-black text-amber-300">{naira(data.referral.pendingOnNextPayslip || 0)}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-[10px] text-slate-500">Total earned</p><p className="mt-1 text-xl font-black text-emerald-300">{naira(data.referral.totalEarned || 0)}</p></div></div><div className="flex flex-col gap-3 rounded-2xl border border-purple-300/15 bg-purple-400/[0.06] p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-purple-300">Your personal referral link</p><p className="mt-2 truncate rounded-lg bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300">{data.referral.shareLink || '—'}</p></div><div className="flex gap-2"><Button type="button" onClick={() => { void navigator.clipboard?.writeText(data.referral.shareLink || ''); showFeedback('success', 'Link copied', 'Your referral link is ready to share.'); }} className="bg-purple-500 font-bold text-white hover:bg-purple-400">Copy</Button><Button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Book through my LodgeCore referral link: ${data.referral.shareLink || ''}`)}`, '_blank', 'noopener,noreferrer')} className="border border-purple-300/30 bg-transparent font-bold text-purple-200 hover:bg-purple-400/10">WhatsApp</Button></div></div><div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs font-bold uppercase tracking-wider text-purple-300">Commission history</p><div className="mt-3 divide-y divide-white/5">{(data.referral.recentCommissions || []).map((commission: any) => <div key={commission.id} className="flex items-center justify-between gap-3 py-3 text-xs"><span className="text-slate-400">{commission.earnedAt ? new Date(commission.earnedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}</span><span className="font-semibold text-white">{naira(commission.amount)}</span><span className={commission.status === 'PAID' ? 'text-emerald-300' : commission.status === 'REVERSED' ? 'text-rose-300' : 'text-amber-300'}>{commission.status === 'PAID' ? 'Paid' : commission.payslipId ? 'Queued in payroll' : commission.status === 'APPROVED' ? 'Pending payroll' : commission.status}</span><span className="text-right text-slate-500">{commission.payslipPeriod || '—'}</span></div>)}{!(data.referral.recentCommissions || []).length && <p className="py-3 text-xs text-slate-500">No commissions yet.</p>}</div></div></div>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Notifications */}
        <Card title="Latest updates" eyebrow="Notifications" eyebrowClass="text-cyan-300" icon={<Bell className="h-5 w-5 text-cyan-300" />}>
          <div className="space-y-2">
            {(data.notifications || []).slice(0, 5).map((n: any) => (
              <button type="button" key={n.id} onClick={async () => { if (!n.isRead) { await fetch('/api/hr/self-service/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: n.id }) }); fetchSelfServiceData(); } }} className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${n.isRead ? 'border-white/5 bg-slate-950/40' : 'border-cyan-400/20 bg-cyan-400/[0.06]'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-slate-700' : 'bg-cyan-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold text-white">{n.subject || 'LodgeCore update'}</p><span className="shrink-0 text-[10px] text-slate-500">{fmtDate(n.createdAt)}</span></div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p>
                </div>
              </button>
            ))}
            {!data.notifications?.length && <p className="py-4 text-center text-xs text-slate-500">You’re up to date.</p>}
          </div>
        </Card>

        {/* Payment profile + change requests */}
        <Card title="Payment profile" eyebrow="Disbursement" icon={<ShieldCheck className="h-5 w-5 text-teal-300" />} action={<button type="button" onClick={() => setProfileModalOpen(true)} className="rounded-full bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-300 active:scale-95">Update</button>}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Bank account</p><p className="mt-1 truncate text-sm font-bold text-white">{data.bankName || '—'}</p><p className="font-mono text-xs text-slate-400">{data.bankAccountNumber || 'Not configured'}</p></div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Pension RSA</p><p className="mt-1 truncate text-sm font-bold text-white">{data.pfaName || '—'}</p><p className="font-mono text-xs text-slate-400">{data.rsaPin || 'Not registered'}</p></div>
          </div>
          {data.profileChangeRequests?.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Change requests</p>
              <div className="space-y-2">{data.profileChangeRequests.slice(0, 4).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">{r.fieldName}</p><p className="truncate text-xs text-slate-500">{r.proposedValue}</p></div><StatusPill status={r.status} /></div>
              ))}</div>
            </>
          )}
        </Card>
      </div>

      {/* Payslip history — card list (no tables on mobile) */}
      <Card title="Payslip history" eyebrow="Salary" icon={<Receipt className="h-5 w-5 text-teal-300" />}>
        {data.payslips?.length ? (
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-slate-950/40">
            {data.payslips.map((ps: any) => (
              <button key={ps.id} type="button" onClick={() => openPayslip(ps)} className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-white/[0.03] active:bg-white/[0.05]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300"><Receipt className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{ps.periodName}</p><p className="text-xs text-slate-500">Gross {naira(ps.grossPay)} · Ded. {naira(ps.deductions)}</p></div>
                <div className="shrink-0 text-right"><p className="font-mono text-sm font-bold text-emerald-300">{naira(ps.netPay)}</p><p className="text-[10px] text-slate-500">{ps.status}</p></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </button>
            ))}
          </div>
        ) : <Empty icon={<Receipt className="h-8 w-8 text-slate-700" />} title="No payslips yet" sub="Historical payslips will appear here." />}
      </Card>
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
        <DialogContent className="max-w-lg rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40"><DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300"><CalendarCheck2 className="h-5 w-5" /></div><DialogTitle className="text-lg font-bold text-white">Submit leave application</DialogTitle><p className="text-xs leading-5 text-slate-400">Choose the period you need away from work. Your request will follow the configured supervisor and HR approval process.</p></DialogHeader><form onSubmit={handleApplyLeave} className="space-y-5 text-xs"><div className="grid gap-4 sm:grid-cols-2"><label className="block font-medium text-slate-300">First day<div className="mt-2"><Input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></div></label><label className="block font-medium text-slate-300">Last day<div className="mt-2"><Input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></div></label></div><div className="rounded-xl border border-teal-400/15 bg-teal-400/[0.06] p-3 text-[11px] leading-5 text-slate-400"><span className="font-semibold text-teal-200">Before you submit:</span> confirm your dates, review your leave balance, and provide a clear handover plan for your team.</div><label className="block font-medium text-slate-300">Reason for leave<textarea required minLength={5} placeholder="Briefly explain the reason for your leave" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="mt-2 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-400" /></label><label className="block font-medium text-slate-300">Handover plan<textarea placeholder="Who will cover your duties? Include important handover notes." value={leaveForm.handover} onChange={(e) => setLeaveForm({ ...leaveForm, handover: e.target.value })} className="mt-2 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-400" /></label><DialogFooter className="border-slate-800 bg-slate-950/30"><Button type="button" variant="outline" onClick={() => setLeaveModalOpen(false)} className="h-10 !border-slate-700 !bg-slate-900 text-xs !text-slate-100 hover:!bg-slate-800">Cancel</Button><Button type="submit" disabled={submitting} className="h-10 bg-teal-600 text-xs text-white hover:bg-teal-500">{submitting ? 'Submitting application…' : 'Submit for approval'}</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40"><DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><User className="h-5 w-5" /></div><DialogTitle className="text-lg font-bold text-white">Request profile update</DialogTitle><p className="text-xs leading-5 text-slate-400">Official employment details remain protected. Your proposed personal or payment-profile changes will be reviewed by HR or Payroll.</p></DialogHeader><form onSubmit={handleProfileChange} className="space-y-5 text-xs"><label className="block font-medium text-slate-300">Information to update<Select value={profileForm.fieldName} onValueChange={(fieldName) => fieldName && setProfileForm({ ...profileForm, fieldName })}><SelectTrigger className="mt-2 h-10 w-full !border-slate-700 !bg-slate-950 text-sm !text-slate-100"><SelectValue placeholder="Select a field to update" /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="phone">Phone number</SelectItem><SelectItem value="residentialAddress">Residential address</SelectItem><SelectItem value="maritalStatus">Marital status</SelectItem><SelectItem value="emergencyContacts">Emergency contacts</SelectItem><SelectItem value="nextOfKin">Next of kin</SelectItem><SelectItem value="bankName">Bank name</SelectItem><SelectItem value="bankAccountNumber">Bank account number</SelectItem><SelectItem value="bankSortCode">Bank sort code</SelectItem><SelectItem value="tin">Tax ID</SelectItem><SelectItem value="pfaName">Pension administrator</SelectItem><SelectItem value="rsaPin">Pension RSA PIN</SelectItem></SelectContent></Select></label><label className="block font-medium text-slate-300">Proposed new value<Input required placeholder="Enter the correct information" value={profileForm.proposedValue} onChange={(e) => setProfileForm({ ...profileForm, proposedValue: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label><label className="block font-medium text-slate-300">Why does this need to change?<textarea required minLength={5} placeholder="Provide context so the reviewer can verify the request" value={profileForm.reason} onChange={(e) => setProfileForm({ ...profileForm, reason: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400" /></label><div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.06] p-3 text-[11px] leading-5 text-slate-400">Sensitive bank and pension changes may require additional verification and may be subject to a payroll cooling-off period.</div>{actionError && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{actionError}</p>}<DialogFooter className="border-slate-800 bg-slate-950/30"><Button type="submit" disabled={submitting} className="h-10 bg-violet-600 text-xs text-white hover:bg-violet-500">{submitting ? 'Sending for review…' : 'Submit change request'}</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={supportModalOpen} onOpenChange={setSupportModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40"><DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><MessageSquare className="h-5 w-5" /></div><DialogTitle className="text-lg font-bold text-white">Contact HR support</DialogTitle><p className="text-xs leading-5 text-slate-400">Create a trackable request. HR responses and status changes will appear in your support center.</p></DialogHeader><form onSubmit={handleSupportRequest} className="space-y-5 text-xs"><label className="block font-medium text-slate-300">Request category<Select value={supportForm.category} onValueChange={(category) => category && setSupportForm({ ...supportForm, category })}><SelectTrigger className="mt-2 h-10 w-full !border-slate-700 !bg-slate-950 text-sm !text-slate-100"><SelectValue placeholder="Choose a request category" /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="PROFILE_UPDATE">Profile update</SelectItem><SelectItem value="SALARY_INQUIRY">Salary inquiry</SelectItem><SelectItem value="LEAVE_INQUIRY">Leave inquiry</SelectItem><SelectItem value="BENEFIT">Benefits</SelectItem><SelectItem value="EMPLOYMENT_LETTER">Employment letter</SelectItem><SelectItem value="GRIEVANCE">Confidential concern</SelectItem></SelectContent></Select></label><label className="block font-medium text-slate-300">Subject<Input required placeholder="Summarize what you need" value={supportForm.subject} onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label><label className="block font-medium text-slate-300">Request details<textarea required minLength={10} placeholder="Include dates, references, and the outcome you need" value={supportForm.description} onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })} className="mt-2 min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" /></label><div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] p-3 text-[11px] leading-5 text-slate-400">Do not include passwords, full bank numbers, BVN, NIN, or other secrets in your message.</div>{actionError && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{actionError}</p>}<DialogFooter className="border-slate-800 bg-slate-950/30"><Button type="submit" disabled={submitting} className="h-10 bg-cyan-600 text-xs text-white hover:bg-cyan-500">{submitting ? 'Creating request…' : 'Create HR request'}</Button></DialogFooter></form></DialogContent>
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
        <DialogContent className="max-w-lg rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40"><DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><ClipboardCheck className="h-5 w-5" /></div><DialogTitle className="text-lg font-bold text-white">Report attendance issue</DialogTitle><p className="text-xs leading-5 text-slate-400">Request a correction without overwriting the original attendance record. A supervisor or HR reviewer will verify it.</p></DialogHeader><form onSubmit={handleAttendanceCorrection} className="space-y-5 text-xs"><label className="block font-medium text-slate-300">Attendance date<Input required type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block font-medium text-slate-300">Correct clock-in<Input type="datetime-local" value={attendanceForm.requestedIn} onChange={(e) => setAttendanceForm({ ...attendanceForm, requestedIn: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label><label className="block font-medium text-slate-300">Correct clock-out<Input type="datetime-local" value={attendanceForm.requestedOut} onChange={(e) => setAttendanceForm({ ...attendanceForm, requestedOut: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label></div><label className="block font-medium text-slate-300">What happened?<textarea required minLength={10} placeholder="Explain the missed punch, late arrival, early departure, or other issue" value={attendanceForm.reason} onChange={(e) => setAttendanceForm({ ...attendanceForm, reason: e.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400" /></label><div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-[11px] leading-5 text-slate-400">Your original punch remains preserved. Only an approved correction can be used in attendance and payroll calculations.</div>{actionError && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{actionError}</p>}<DialogFooter className="border-slate-800 bg-slate-950/30"><Button type="submit" disabled={submitting} className="h-10 bg-amber-600 text-xs text-white hover:bg-amber-500">{submitting ? 'Sending for review…' : 'Submit correction request'}</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={loanModalOpen} onOpenChange={setLoanModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40"><DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><WalletCards className="h-5 w-5" /></div><DialogTitle className="text-lg font-bold text-white">Employee loan application</DialogTitle><p className="text-xs leading-5 text-slate-400">Submit a structured request for HR review. Approval is subject to your organization’s eligibility and affordability policy.</p></DialogHeader><form onSubmit={handleLoanRequest} className="space-y-5 text-xs"><div className="grid gap-4 sm:grid-cols-2"><label className="block font-medium text-slate-300">Requested amount<div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₦</span><Input required type="number" min="1" placeholder="e.g. 250,000" value={loanForm.principalAmount} onChange={(e) => setLoanForm({ ...loanForm, principalAmount: e.target.value })} className="h-10 border-slate-700 bg-slate-950 pl-7 text-sm text-slate-100" /></div></label><label className="block font-medium text-slate-300">Repayment term<Select value={loanForm.tenorMonths} onValueChange={(value) => value && setLoanForm({ ...loanForm, tenorMonths: value })}><SelectTrigger className="mt-2 h-10 w-full !border-slate-700 !bg-slate-950 text-sm !text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="3">3 months</SelectItem><SelectItem value="6">6 months</SelectItem><SelectItem value="9">9 months</SelectItem><SelectItem value="12">12 months</SelectItem><SelectItem value="18">18 months</SelectItem><SelectItem value="24">24 months</SelectItem></SelectContent></Select></label></div><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4"><div className="flex items-center justify-between"><span className="text-slate-400">Estimated monthly deduction</span><strong className="text-base text-emerald-300">₦{((Number(loanForm.principalAmount) || 0) / Number(loanForm.tenorMonths || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div><p className="mt-1 text-[10px] text-slate-500">Final deductions may change after HR review and applicable policy calculations.</p></div><label className="block font-medium text-slate-300">Request purpose<Select value={loanForm.purpose} onValueChange={(value) => value && setLoanForm({ ...loanForm, purpose: value })}><SelectTrigger className="mt-2 h-10 w-full !border-slate-700 !bg-slate-950 text-sm !text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="PERSONAL_SUPPORT">Personal support</SelectItem><SelectItem value="MEDICAL">Medical expenses</SelectItem><SelectItem value="EDUCATION">Education or training</SelectItem><SelectItem value="EMERGENCY">Emergency assistance</SelectItem><SelectItem value="HOUSING">Housing or relocation</SelectItem><SelectItem value="OTHER">Other approved purpose</SelectItem></SelectContent></Select></label><label className="block font-medium text-slate-300">Supporting details<textarea required minLength={10} placeholder="Explain what the funds will support and any relevant context" value={loanForm.additionalDetails} onChange={(e) => setLoanForm({ ...loanForm, additionalDetails: e.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-400" /></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-5 text-slate-400"><input required type="checkbox" checked={loanForm.consent} onChange={(e) => setLoanForm({ ...loanForm, consent: e.target.checked })} className="mt-1 accent-emerald-500" /><span>I confirm that the information provided is accurate and authorize LodgeCore HR to assess this request under the applicable employee loan policy.</span></label>{actionError && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-300">{actionError}</p>}<DialogFooter className="border-slate-800 bg-slate-950/30"><Button type="submit" disabled={submitting} className="h-10 bg-emerald-700 text-xs text-white hover:bg-emerald-600">{submitting ? 'Submitting application…' : 'Submit for HR review'}</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={swapModalOpen} onOpenChange={setSwapModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-slate-800 bg-[#0b1624] text-slate-100 shadow-2xl shadow-black/40">
          <DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><CalendarRange className="h-5 w-5" /></div><DialogTitle className="text-lg font-bold text-white">Request a shift swap</DialogTitle><p className="text-xs leading-5 text-slate-400">Choose the colleague and both roster dates. The colleague must accept before HR can acknowledge and apply the swap.</p></DialogHeader>
          <form onSubmit={handleRequestSwap} className="space-y-5 text-xs">
            <label className="block font-medium text-slate-300">Swap with colleague<select required value={swapForm.targetStaffId} onChange={(e) => setSwapForm({ ...swapForm, targetStaffId: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"><option value="">Select colleague</option>{swapStaff.filter((staff) => staff.id !== data?.id).map((staff) => <option key={staff.id} value={staff.id}>{staff.firstName} {staff.lastName} · {staff.department}</option>)}</select></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block font-medium text-slate-300">Your roster date<Input required type="date" value={swapForm.requesterDate} onChange={(e) => setSwapForm({ ...swapForm, requesterDate: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label><label className="block font-medium text-slate-300">Their roster date<Input required type="date" value={swapForm.targetDate} onChange={(e) => setSwapForm({ ...swapForm, targetDate: e.target.value })} className="mt-2 h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /></label></div>
            <label className="block font-medium text-slate-300">Reason<textarea required minLength={5} placeholder="Explain why you need the swap" value={swapForm.reason} onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" /></label>
            <DialogFooter className="border-slate-800 bg-slate-950/30"><Button type="button" variant="outline" onClick={() => setSwapModalOpen(false)} className="h-10 !border-slate-700 !bg-slate-900 text-xs !text-slate-100">Cancel</Button><Button type="submit" disabled={submitting} className="h-10 bg-cyan-600 text-xs text-white hover:bg-cyan-500">{submitting ? 'Sending…' : 'Send swap request'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <EmployeePortalFeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </div>
  );
}

const naira = (v: any) => `₦${Number(v || 0).toLocaleString()}`;
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function Card({ title, eyebrow, eyebrowClass = 'text-teal-300', icon, action, children }: { title: string; eyebrow?: string; eyebrowClass?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-[#0b1624] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${eyebrowClass}`}>{eyebrow}</p>}
          <h2 className="mt-0.5 truncate text-base font-bold text-white sm:text-lg">{title}</h2>
        </div>
        {action || icon}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, icon: Icon, value, sub, accent, valueClass = 'text-white' }: { label: string; icon: any; value: string; sub: string; accent?: boolean; valueClass?: string }) {
  return (
    <div className={`min-w-[70%] snap-start rounded-2xl border p-4 sm:min-w-0 ${accent ? 'border-teal-400/20 bg-teal-400/[0.07]' : 'border-slate-800 bg-[#0b1624]'}`}>
      <div className="flex items-center justify-between"><span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${accent ? 'text-teal-300' : 'text-slate-500'}`}>{label}</span><Icon className={`h-4 w-4 ${accent ? 'text-teal-300' : 'text-slate-400'}`} /></div>
      <p className={`mt-3 truncate text-xl font-black ${valueClass}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function ListRow({ title, sub, subClass, onClick }: { title: string; sub: string; subClass: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3 text-left active:scale-[.99]">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{title}</p><p className={`mt-0.5 text-xs ${subClass}`}>{sub}</p></div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
    </button>
  );
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-700/70 px-4 py-7 text-center">
      {icon}
      <p className="mt-2 text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = String(status || '');
  const tone = /APPROV|PAID|RESOLV|COMPLET/.test(s) ? 'bg-emerald-400/10 text-emerald-300' : /REJECT|CANCEL|DECLIN/.test(s) ? 'bg-rose-400/10 text-rose-300' : 'bg-amber-400/10 text-amber-300';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{s.replaceAll('_', ' ')}</span>;
}
