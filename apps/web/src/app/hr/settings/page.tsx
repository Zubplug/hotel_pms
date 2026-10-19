'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Save,
  CheckCircle2,
  Building2,
  Scale,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function HrSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfigured, setPaymentConfigured] = useState(false);
  const [autoPaymentEnabled, setAutoPaymentEnabled] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [geofenceSaving, setGeofenceSaving] = useState(false);
  const [penaltyPolicies, setPenaltyPolicies] = useState<any[]>([]);
  const [penaltySaving, setPenaltySaving] = useState(false);
  const [penaltyForm, setPenaltyForm] = useState({ id: '', code: '', name: '', trigger: 'LATE_ARRIVAL', calculationType: 'FIXED_AMOUNT', amount: '', graceMinutes: '0', maximumAmount: '', effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', isActive: true });
  const [geofence, setGeofence] = useState({ latitude: '', longitude: '', radiusMeters: '150', minAccuracyMeters: '100', isEnabled: true });
  const [form, setForm] = useState({
    // Statutory settings
    taxRegime: 'NTA_2026',
    pensionEnabled: true,
    pensionExemptionReason: '',
    nhfEnabled: true,
    nhfExemptionReason: '',
    pensionEmployeeRate: '8.0',
    pensionEmployerRate: '10.0',
    nhfRate: '2.5',
    nsitfRate: '1.0',
    itfRate: '1.0',
    minimumWageFloor: '70000',
    craFixedFloor: '200000',
    craPercentOne: '1.0',
    craPercentTwo: '20.0',

    // Attendance & Overtime
    standardWorkWeekHours: '40',
    overtimeRateMultiplier: '1.5',
    holidayOvertimeMultiplier: '2.0',
    gracePeriodMins: '15',

    // GL Accounts
    glSalaryExpense: '6000',
    glEmployerPensionExpense: '6010',
    glNetSalariesPayable: '2100',
    glPayePayable: '2110',
    glPensionPayable: '2120',
  });

  useEffect(() => {
    fetch('/api/hr/settings')
      .then((r) => r.json())
      .then((data) => {
        setPaymentConfigured(Boolean(data.payment?.configured));
        setAutoPaymentEnabled(Boolean(data.payment?.autoPaymentEnabled));
        setPenaltyPolicies(data.penaltyPolicies || []);
        if (data.config) {
          setForm((prev) => ({
            ...prev,
            taxRegime: String(data.config.taxRegime ?? prev.taxRegime),
            pensionEnabled: data.config.pensionEnabled !== false,
            pensionExemptionReason: String(data.config.pensionExemptionReason ?? ''),
            nhfEnabled: data.config.nhfEnabled !== false,
            nhfExemptionReason: String(data.config.nhfExemptionReason ?? ''),
            pensionEmployeeRate: String(data.config.pensionEmployeeRate ?? prev.pensionEmployeeRate),
            pensionEmployerRate: String(data.config.pensionEmployerRate ?? prev.pensionEmployerRate),
            nhfRate: String(data.config.nhfRate ?? prev.nhfRate),
            nsitfRate: String(data.config.nsitfRate ?? prev.nsitfRate),
            itfRate: String(data.config.itfRate ?? prev.itfRate),
            minimumWageFloor: String(data.config.minimumWageFloor ?? prev.minimumWageFloor),
            craFixedFloor: String(data.config.craFixedFloor ?? prev.craFixedFloor),
            craPercentOne: String(data.config.craPercentOne ?? prev.craPercentOne),
            craPercentTwo: String(data.config.craPercentTwo ?? prev.craPercentTwo),
            standardWorkWeekHours: String(data.config.standardWorkWeekHours ?? prev.standardWorkWeekHours),
            overtimeRateMultiplier: String(data.config.overtimeRateMultiplier ?? prev.overtimeRateMultiplier),
            holidayOvertimeMultiplier: String(data.config.holidayOvertimeMultiplier ?? prev.holidayOvertimeMultiplier),
            gracePeriodMins: String(data.config.gracePeriodMins ?? prev.gracePeriodMins),
            glSalaryExpense: String(data.config.glSalaryExpense ?? prev.glSalaryExpense),
            glEmployerPensionExpense: String(data.config.glEmployerPensionExpense ?? prev.glEmployerPensionExpense),
            glNetSalariesPayable: String(data.config.glNetSalariesPayable ?? prev.glNetSalariesPayable),
            glPayePayable: String(data.config.glPayePayable ?? prev.glPayePayable),
            glPensionPayable: String(data.config.glPensionPayable ?? prev.glPensionPayable),
          }));
        }
      })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/hr/attendance/geofence').then((response) => response.json()).then((data) => {
      if (data.geofence) setGeofence({ latitude: String(data.geofence.latitude), longitude: String(data.geofence.longitude), radiusMeters: String(data.geofence.radiusMeters), minAccuracyMeters: String(data.geofence.minAccuracyMeters), isEnabled: Boolean(data.geofence.isEnabled) });
    }).catch(() => setError('Unable to load attendance location settings'));
  }, []);

  const toggleAutoPayment = async () => {
    setPaymentSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/hr/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'SET_AUTO_PAYMENT', enabled: !autoPaymentEnabled }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to change automatic payment setting');
      setAutoPaymentEnabled(Boolean(data.autoPaymentEnabled));
    } catch (err: any) { setError(err.message || 'Unable to change automatic payment setting'); }
    finally { setPaymentSaving(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/hr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxRegime: form.taxRegime,
          pensionEnabled: form.pensionEnabled,
          pensionExemptionReason: form.pensionExemptionReason,
          nhfEnabled: form.nhfEnabled,
          nhfExemptionReason: form.nhfExemptionReason,
          pensionEmployeeRate: parseFloat(form.pensionEmployeeRate),
          pensionEmployerRate: parseFloat(form.pensionEmployerRate),
          nhfRate: parseFloat(form.nhfRate),
          nsitfRate: parseFloat(form.nsitfRate),
          itfRate: parseFloat(form.itfRate),
          minimumWageFloor: parseFloat(form.minimumWageFloor),
          craFixedFloor: parseFloat(form.craFixedFloor),
          craPercentOne: parseFloat(form.craPercentOne),
          craPercentTwo: parseFloat(form.craPercentTwo),
          standardWorkWeekHours: parseFloat(form.standardWorkWeekHours),
          overtimeRateMultiplier: parseFloat(form.overtimeRateMultiplier),
          holidayOvertimeMultiplier: parseFloat(form.holidayOvertimeMultiplier),
          gracePeriodMins: parseInt(form.gracePeriodMins, 10),
          glSalaryExpense: form.glSalaryExpense,
          glEmployerPensionExpense: form.glEmployerPensionExpense,
          glNetSalariesPayable: form.glNetSalariesPayable,
          glPayePayable: form.glPayePayable,
          glPensionPayable: form.glPensionPayable,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to persist settings');
    }
  };

  const saveGeofence = async () => {
    setGeofenceSaving(true); setError(null);
    try {
      const response = await fetch('/api/hr/attendance/geofence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...geofence, latitude: Number(geofence.latitude), longitude: Number(geofence.longitude), radiusMeters: Number(geofence.radiusMeters), minAccuracyMeters: Number(geofence.minAccuracyMeters) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save attendance location');
      setGeofence({ latitude: String(result.geofence.latitude), longitude: String(result.geofence.longitude), radiusMeters: String(result.geofence.radiusMeters), minAccuracyMeters: String(result.geofence.minAccuracyMeters), isEnabled: Boolean(result.geofence.isEnabled) });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { setError(err.message || 'Unable to save attendance location'); } finally { setGeofenceSaving(false); }
  };

  const savePenaltyPolicy = async (event: React.FormEvent) => {
    event.preventDefault(); setPenaltySaving(true); setError(null);
    try {
      const response = await fetch('/api/hr/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'SAVE_PENALTY_POLICY', ...penaltyForm }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save penalty policy');
      setPenaltyPolicies((current) => { const next = { ...result.policy }; const existing = current.findIndex((item) => item.id === next.id); if (existing < 0) return [next, ...current]; const copy = [...current]; copy[existing] = next; return copy; });
      setPenaltyForm({ id: '', code: '', name: '', trigger: 'LATE_ARRIVAL', calculationType: 'FIXED_AMOUNT', amount: '', graceMinutes: '0', maximumAmount: '', effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', isActive: true });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { setError(err.message || 'Unable to save penalty policy'); } finally { setPenaltySaving(false); }
  };

  const editPenaltyPolicy = (policy: any) => setPenaltyForm({ id: policy.id, code: policy.code, name: policy.name, trigger: policy.trigger, calculationType: policy.calculationType, amount: String(policy.amount), graceMinutes: String(policy.graceMinutes), maximumAmount: policy.maximumAmount === null ? '' : String(policy.maximumAmount), effectiveFrom: new Date(policy.effectiveFrom).toISOString().split('T')[0], effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '', isActive: Boolean(policy.isActive) });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-teal-400" />
            HR Statutory &amp; Operational Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure Nigerian statutory tax brackets, pension rates, overtime multipliers, and General Ledger mapping.
          </p>
        </div>
        <Button
          onClick={handleSave}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shadow-md shadow-teal-950"
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? 'Saved Successfully!' : 'Save Settings'}
        </Button>
      </div>

      <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <h3 className="text-sm font-bold text-white">Automatic salary payment</h3>
          <p className="text-xs text-slate-400 mt-1">Controls whether approved payroll is automatically initiated through the configured Flutterwave account for this property.</p>
          <p className={`text-[11px] mt-2 ${paymentConfigured ? 'text-emerald-300' : 'text-amber-300'}`}>{paymentConfigured ? (autoPaymentEnabled ? 'Configured and enabled' : 'Configured but disabled') : 'Flutterwave is not configured. Configure it from /portal/integrations.'}</p>
        </div>
        <Button type="button" onClick={toggleAutoPayment} disabled={!paymentConfigured || paymentSaving} className={autoPaymentEnabled ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}>{paymentSaving ? 'Saving…' : autoPaymentEnabled ? 'Disable auto payment' : 'Enable auto payment'}</Button>
      </div>

      <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h3 className="text-sm font-bold text-white">Attendance location boundary</h3><p className="text-xs text-slate-400 mt-1">Employees must have a live GPS position inside this property boundary to check in or check out. HR manual punches remain available as audited exceptions.</p></div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={geofence.isEnabled} onChange={(e) => setGeofence({ ...geofence, isEnabled: e.target.checked })} /> Enforce location</label>
        </div>
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-4">
          <label className="text-slate-400">Latitude<Input type="number" step="0.0000001" min="-90" max="90" value={geofence.latitude} onChange={(e) => setGeofence({ ...geofence, latitude: e.target.value })} className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" placeholder="6.5244" /></label>
          <label className="text-slate-400">Longitude<Input type="number" step="0.0000001" min="-180" max="180" value={geofence.longitude} onChange={(e) => setGeofence({ ...geofence, longitude: e.target.value })} className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" placeholder="3.3792" /></label>
          <label className="text-slate-400">Allowed radius (m)<Input type="number" min="25" max="2000" value={geofence.radiusMeters} onChange={(e) => setGeofence({ ...geofence, radiusMeters: e.target.value })} className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" /></label>
          <label className="text-slate-400">Maximum GPS error (m)<Input type="number" min="10" max="500" value={geofence.minAccuracyMeters} onChange={(e) => setGeofence({ ...geofence, minAccuracyMeters: e.target.value })} className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" /></label>
        </div>
        <Button type="button" onClick={saveGeofence} disabled={geofenceSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">{geofenceSaving ? 'Saving location…' : 'Save attendance boundary'}</Button>
      </div>

      <section className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
          <div><h3 className="text-sm font-bold text-white">Attendance Penalty Policies</h3><p className="mt-1 text-xs text-slate-400">Configure late arrival, early departure, absence, and missed-punch rules. Policies require HR review before any payroll deduction.</p></div>
          <Scale className="h-5 w-5 shrink-0 text-amber-400" />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {penaltyPolicies.map((policy) => <div key={policy.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"><div><p className="font-semibold text-white">{policy.name} <span className="font-mono text-[10px] text-slate-500">{policy.code}</span></p><p className="mt-1 text-slate-400">{policy.trigger.replaceAll('_', ' ')} · {policy.calculationType.replaceAll('_', ' ')} · ₦{Number(policy.amount).toLocaleString()}</p><p className="mt-1 text-[10px] text-slate-500">{policy.isActive ? 'Active' : 'Inactive'} · Effective {new Date(policy.effectiveFrom).toLocaleDateString()}</p></div><Button type="button" variant="outline" onClick={() => editPenaltyPolicy(policy)} className="h-7 border-slate-700 text-[10px] text-slate-300">Edit</Button></div>)}
          {!penaltyPolicies.length && <p className="text-xs text-slate-500">No attendance penalty policies configured.</p>}
        </div>
        <form onSubmit={savePenaltyPolicy} className="grid gap-3 border-t border-slate-800 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Input required placeholder="Policy code e.g. LATE_15" value={penaltyForm.code} onChange={(e) => setPenaltyForm({ ...penaltyForm, code: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <Input required placeholder="Policy name" value={penaltyForm.name} onChange={(e) => setPenaltyForm({ ...penaltyForm, name: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <select value={penaltyForm.trigger} onChange={(e) => setPenaltyForm({ ...penaltyForm, trigger: e.target.value })} className="h-9 rounded-md border border-slate-800 bg-slate-950 px-2 text-slate-200"><option value="LATE_ARRIVAL">Late arrival</option><option value="EARLY_DEPARTURE">Early departure</option><option value="ABSENCE">Absence / no-show</option><option value="MISSED_PUNCH">Missed punch</option></select>
          <select value={penaltyForm.calculationType} onChange={(e) => setPenaltyForm({ ...penaltyForm, calculationType: e.target.value })} className="h-9 rounded-md border border-slate-800 bg-slate-950 px-2 text-slate-200"><option value="FIXED_AMOUNT">Fixed amount</option><option value="PER_MINUTE">Per minute</option><option value="PERCENT_BASIC">Percent of basic</option></select>
          <Input required type="number" min="0.01" step="0.01" placeholder="Amount / rate" value={penaltyForm.amount} onChange={(e) => setPenaltyForm({ ...penaltyForm, amount: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <Input type="number" min="0" placeholder="Extra grace minutes" value={penaltyForm.graceMinutes} onChange={(e) => setPenaltyForm({ ...penaltyForm, graceMinutes: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <Input type="number" min="0" step="0.01" placeholder="Maximum amount (optional)" value={penaltyForm.maximumAmount} onChange={(e) => setPenaltyForm({ ...penaltyForm, maximumAmount: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <Input required type="date" value={penaltyForm.effectiveFrom} onChange={(e) => setPenaltyForm({ ...penaltyForm, effectiveFrom: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <Input type="date" value={penaltyForm.effectiveTo} onChange={(e) => setPenaltyForm({ ...penaltyForm, effectiveTo: e.target.value })} className="bg-slate-950 border-slate-800 text-slate-100" />
          <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={penaltyForm.isActive} onChange={(e) => setPenaltyForm({ ...penaltyForm, isActive: e.target.checked })} /> Active policy</label>
          <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked readOnly /> HR approval required</label>
          <Button type="submit" disabled={penaltySaving} className="bg-amber-600 text-white hover:bg-amber-500">{penaltySaving ? 'Saving…' : penaltyForm.id ? 'Update policy' : 'Add policy'}</Button>
        </form>
      </section>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Nigerian Statutory Parameters */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Nigerian Statutory Compliance Engines</h3>
              <p className="text-xs text-slate-400">PITA 2011 (amended), Pension Reform Act 2014, and statutory on-costs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Tax regime</label>
              <select value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value })} className="h-8 w-full rounded-md border border-slate-800 bg-slate-950 px-2 text-slate-100"><option value="NTA_2026">Nigeria Tax Act 2025 (2026)</option><option value="PITA_2011">Legacy PITA</option></select>
              <span className="text-[10px] text-slate-500 mt-0.5 block">NTA 2026 removes the old CRA calculation.</span>
            </div>
            <div>
              <label className="flex items-center gap-2 pt-1 text-slate-300"><input type="checkbox" checked={form.pensionEnabled} onChange={(e) => setForm({ ...form, pensionEnabled: e.target.checked })} /> Apply pension contributions</label>
              {!form.pensionEnabled && <Input required placeholder="Reason pension is not applicable" value={form.pensionExemptionReason} onChange={(e) => setForm({ ...form, pensionExemptionReason: e.target.value })} className="mt-2 bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" />}
            </div>
            <div>
              <label className="flex items-center gap-2 pt-1 text-slate-300"><input type="checkbox" checked={form.nhfEnabled} onChange={(e) => setForm({ ...form, nhfEnabled: e.target.checked })} /> Apply NHF contributions</label>
              {!form.nhfEnabled && <Input required placeholder="Reason NHF is not applicable" value={form.nhfExemptionReason} onChange={(e) => setForm({ ...form, nhfExemptionReason: e.target.value })} className="mt-2 bg-slate-950 border-slate-800 text-slate-100 text-xs h-8" />}
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Employee Pension Contribution (%)</label>
              <Input
                value={form.pensionEmployeeRate}
                onChange={(e) => setForm({ ...form, pensionEmployeeRate: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory: 8% of emoluments</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Employer Pension Contribution (%)</label>
              <Input
                value={form.pensionEmployerRate}
                onChange={(e) => setForm({ ...form, pensionEmployerRate: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory: 10% employer cost</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">National Housing Fund (NHF) (%)</label>
              <Input
                value={form.nhfRate}
                onChange={(e) => setForm({ ...form, nhfRate: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory: 2.5% of basic salary</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">NSITF Rate (%)</label>
              <Input
                value={form.nsitfRate}
                onChange={(e) => setForm({ ...form, nsitfRate: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory: 1.0% of total payroll</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Industrial Training Fund (ITF) (%)</label>
              <Input
                value={form.itfRate}
                onChange={(e) => setForm({ ...form, itfRate: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Statutory: 1.0% of total payroll</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">National Minimum Wage Floor (NGN)</label>
              <Input
                value={form.minimumWageFloor}
                onChange={(e) => setForm({ ...form, minimumWageFloor: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Minimum statutory monthly pay</span>
            </div>
          </div>
        </div>

        {/* Section 2: Overtime & Working Hours */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Clock className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Hospitality Shift &amp; Overtime Rules</h3>
              <p className="text-xs text-slate-400">Shift schedules, punch grace windows, and overtime multipliers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Standard Work Week (Hours)</label>
              <Input
                value={form.standardWorkWeekHours}
                onChange={(e) => setForm({ ...form, standardWorkWeekHours: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Regular Overtime Multiplier</label>
              <Input
                value={form.overtimeRateMultiplier}
                onChange={(e) => setForm({ ...form, overtimeRateMultiplier: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: 1.5x hourly rate</span>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Holiday / Night Overtime Multiplier</label>
              <Input
                value={form.holidayOvertimeMultiplier}
                onChange={(e) => setForm({ ...form, holidayOvertimeMultiplier: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Public holidays: 2.0x hourly rate</span>
            </div>
          </div>
        </div>

        {/* Section 3: General Ledger Integration Mapping */}
        <div className="bg-[#090e17] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Building2 className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-sm font-bold text-white">General Ledger Accounting Mapping</h3>
              <p className="text-xs text-slate-400">Chart of account code mapping for automated balanced payroll journals</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Gross Salaries Expense Account Code</label>
              <Input
                value={form.glSalaryExpense}
                onChange={(e) => setForm({ ...form, glSalaryExpense: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Net Salaries Payable Account Code</label>
              <Input
                value={form.glNetSalariesPayable}
                onChange={(e) => setForm({ ...form, glNetSalariesPayable: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">PAYE Tax Liability Account Code</label>
              <Input
                value={form.glPayePayable}
                onChange={(e) => setForm({ ...form, glPayePayable: e.target.value })}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-8 font-mono"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
