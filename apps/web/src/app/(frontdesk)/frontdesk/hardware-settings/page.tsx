'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Printer, Plus, Trash2, Wifi, CheckCircle, XCircle, Loader2,
  ChevronRight, Settings2, ArrowLeft, Search, CreditCard,
  Zap, Monitor, Server, Radio, ChevronDown, X, AlertTriangle,
} from 'lucide-react';
import { invokeDesktop } from '@/lib/desktop/IpcBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useRouter } from 'next/navigation';
import { goBack } from '@/lib/frontdesk-navigation';

// ─── Types ──────────────────────────────────────────────────────────────────
interface PrinterConfig {
  id: string;
  name: string;
  printerRole: 'RECEIPT' | 'KITCHEN' | 'FRONTDESK';
  connectionType: 'NETWORK' | 'USB' | 'SERIAL';
  devicePath: string;
  baudRate: number;
  ipAddress: string;
  port: number;
  paperWidth: number;
  hotelName: string;
  hotelAddress: string;
  outletId: string | null;
  openCashDrawer: boolean;
  isActive: boolean;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

const ROLES = [
  { value: 'FRONTDESK', label: 'Front Desk Printer', desc: 'Prints folios and reservation documents', color: 'bg-violet-500', dot: 'bg-violet-500' },
  { value: 'RECEIPT',   label: 'Receipt Printer',    desc: 'Prints customer receipts at checkout',  color: 'bg-blue-500',   dot: 'bg-blue-500'   },
];

const PAPER_WIDTHS = [
  { value: 32, label: '58mm (32 chars)' },
  { value: 48, label: '80mm (48 chars)' },
];

const BLANK_PRINTER: Omit<PrinterConfig, 'id'> = {
  name: '', printerRole: 'FRONTDESK', connectionType: 'NETWORK',
  devicePath: '', baudRate: 9600, ipAddress: '', port: 9100,
  paperWidth: 48, hotelName: '', hotelAddress: '',
  outletId: null, openCashDrawer: false, isActive: true,
};

// ─── Lock Providers ──────────────────────────────────────────────────────────
const LOCK_PROVIDERS = [
  { value: 'deluns',  label: 'Deluns',                 sub: 'Standard RFID lock system',        icon: '🔒' },
  { value: 'rfv2016', label: 'RFV2016',                sub: 'RF-based keycard encoder v2016',   icon: '📡' },
  { value: 'hslock',  label: 'HsLock',                 sub: 'HsLock hotel keycard system',      icon: '🏨' },
  { value: 'xeeder',  label: 'Xeeder',                 sub: 'Xeeder smart lock platform',       icon: '⚡' },
  { value: 'prousb',  label: 'ACS Hotel / proUSB',     sub: 'Q508 proUSB card encoder (China)', icon: '🔑' },
];

// ─── Custom Searchable Dropdown ──────────────────────────────────────────────
function ProviderDropdown({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = LOCK_PROVIDERS.find(p => p.value === value) ?? LOCK_PROVIDERS[0];
  const filtered = LOCK_PROVIDERS.filter(p =>
    p.label.toLowerCase().includes(query.toLowerCase()) ||
    p.sub.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 bg-white dark:bg-[#111] transition-all text-left group
          ${open
            ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
            : 'border-gray-200 dark:border-[#2a2a2a] hover:border-gray-300 dark:hover:border-[#3a3a3a]'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="text-xl shrink-0">{current.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{current.label}</p>
          <p className="text-[11px] text-gray-400 truncate">{current.sub}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100 dark:border-[#1e1e1e]">
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] focus-within:border-indigo-400 transition-colors">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search providers…"
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No providers match your search</div>
            ) : filtered.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  ${value === p.value
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-[#1e1e1e]'}`}
              >
                <span className="text-xl shrink-0">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${value === p.value ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>{p.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{p.sub}</p>
                </div>
                {value === p.value && <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProUSB Settings Modal ───────────────────────────────────────────────────
function ProUsbSettingsModal({ onClose }: { onClose: () => void }) {
  const [hotelCode, setHotelCode] = useState('');
  const [usbPort, setUsbPort] = useState('1');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [discovered, setDiscovered] = useState<string | null>(null);

  useEffect(() => {
    invokeDesktop('hardware.getExtendedSettings').then((res: any) => {
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      if (data?.data) {
        setHotelCode(data.data.proUsbHotelCode ?? '');
        setUsbPort(data.data.proUsbPort ?? '1');
        setDiscovered(data.data.proUsbHotelCode || null);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true); setStatus('idle');
    try {
      const res: any = await invokeDesktop('hardware.setExtendedSettings', {
        proUsbHotelCode: hotelCode.trim(),
        proUsbPort: usbPort.trim(),
      });
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      if (data?.success) {
        setStatus('saved');
        setTimeout(() => { setStatus('idle'); onClose(); }, 1800);
      } else { setStatus('error'); setErrorMsg(data?.error ?? 'Save failed'); }
    } catch (e: any) { setStatus('error'); setErrorMsg(e?.message ?? 'Unknown error'); }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#141414] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#0f2257] via-[#1a3a7a] to-[#0d1f4a] px-6 py-6">
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 75% 25%, #818cf8 0%, transparent 55%)' }} />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-2xl">🔑</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-0.5">ACS Hotel · Q508</p>
              <h2 className="text-xl font-bold text-white tracking-tight">proUSB Lock Settings</h2>
              <p className="text-sm text-slate-400 mt-1">Configure the encoder connection for this terminal.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {!loaded ? (
            <div className="h-12 rounded-xl bg-gray-100 dark:bg-[#1e1e1e] animate-pulse" />
          ) : discovered ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Hotel code saved</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Code <span className="font-mono font-bold">{discovered}</span> is active. Update below if needed.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
              <div className="text-base shrink-0">ℹ️</div>
              <div>
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Auto-discovery active</p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400">Leave blank — agent reads <span className="font-mono">dlsCoID</span> from <span className="font-mono">System.ini</span> automatically.</p>
              </div>
            </div>
          )}

          {/* Hotel Code */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Hotel Code
              <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] rounded text-gray-500">dlsCoID</span>
              <span className="ml-2 font-normal text-gray-400">— blank = auto-discover</span>
            </label>
            <input
              id="prousb-hotel-code"
              type="number"
              value={hotelCode}
              onChange={e => setHotelCode(e.target.value)}
              placeholder="e.g. 7823"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <p className="mt-1.5 text-[11px] text-gray-400">
              Find this in <span className="font-mono">C:\CardLock\System.ini</span> → <span className="font-mono">[SYSTEM] dlsCoID</span>
            </p>
          </div>

          {/* USB Port */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              USB Encoder Port <span className="font-normal text-gray-400">— almost always 1</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" onClick={() => setUsbPort(String(n))}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-mono font-semibold transition-all
                    ${usbPort === String(n)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-[#2a2a2a] text-gray-500 hover:border-gray-300'}`}
                >{n}</button>
              ))}
            </div>
          </div>

          {status === 'saved' && (
            <div className="flex items-center gap-2.5 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3 rounded-xl">
              <CheckCircle className="w-4 h-4 shrink-0" /> Settings saved — restart desktop to apply.
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 rounded-xl">
              <XCircle className="w-4 h-4 shrink-0" /> {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-[#2a2a2a] text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors">
            Cancel
          </button>
          <button
            id="prousb-save-btn"
            onClick={handleSave}
            disabled={saving || status === 'saved'}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {saving ? 'Saving…' : status === 'saved' ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Printer Card ────────────────────────────────────────────────────────────
function PrinterCard({ printer, onEdit, onDelete }: {
  printer: PrinterConfig; onEdit: () => void; onDelete: () => void;
}) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMsg, setTestMsg] = useState('');
  const role = ROLES.find(r => r.value === printer.printerRole) ?? ROLES[0];

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      const res = await invokeDesktop('hardware.testPrinter', { config: JSON.stringify(printer) });
      if (res?.success) { setTestStatus('success'); setTestMsg(res.message ?? 'Connected!'); }
      else              { setTestStatus('failed');  setTestMsg(res?.error ?? 'Connection failed'); }
    } catch { setTestStatus('failed'); setTestMsg('Could not reach printer'); }
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const connLabel = printer.connectionType === 'NETWORK'
    ? `${printer.ipAddress}:${printer.port}`
    : printer.devicePath || '—';

  return (
    <div className="group relative bg-white dark:bg-[#141414] border border-gray-100 dark:border-[#222] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Top accent */}
      <div className={`h-1 w-full ${role.color}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${role.color} bg-opacity-10 rounded-xl flex items-center justify-center`}>
              <Printer className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{printer.name}</h3>
              <span className="text-[11px] text-gray-400">{role.label}</span>
            </div>
          </div>
          {printer.isActive ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">Inactive</span>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
              {printer.connectionType === 'NETWORK' ? <Wifi className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
              {printer.connectionType}
            </span>
            <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#1e1e1e] px-2 py-0.5 rounded-md">{connLabel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400">Paper</span>
            <span className="text-[11px] text-gray-700 dark:text-gray-300">{printer.paperWidth === 32 ? '58mm' : '80mm'}</span>
          </div>
        </div>

        {/* Test feedback */}
        {testStatus !== 'idle' && (
          <div className={`mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            testStatus === 'testing' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' :
            testStatus === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
            'bg-red-50 dark:bg-red-900/20 text-red-600'
          }`}>
            {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {testStatus === 'success' && <CheckCircle className="w-3.5 h-3.5" />}
            {testStatus === 'failed'  && <XCircle    className="w-3.5 h-3.5" />}
            {testStatus === 'testing' ? 'Connecting…' : testMsg}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleTest} disabled={testStatus === 'testing'}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors disabled:opacity-60">
            {testStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            Test
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors">
            <Settings2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 border border-red-100 dark:border-red-900/40 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Printer Form Modal ──────────────────────────────────────────────────────
function PrinterForm({ initial, onSave, onCancel, saving }: {
  initial: Partial<PrinterConfig>;
  onSave: (p: Omit<PrinterConfig, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<PrinterConfig, 'id'> & { id?: string }>({ ...BLANK_PRINTER, ...initial });
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const discoverPrinters = async () => {
    setDiscovering(true);
    try {
      const res = await invokeDesktop('hardware.getAvailableHardwarePrinters');
      if (res?.success && Array.isArray(res.data)) setAvailablePorts(res.data);
    } catch { /* ignore */ }
    setDiscovering(false);
  };

  useEffect(() => { if (form.connectionType !== 'NETWORK') discoverPrinters(); }, [form.connectionType]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="w-full max-w-lg bg-white dark:bg-[#141414] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{form.id ? 'Edit Printer' : 'Add Printer'}</h2>
              <p className="text-indigo-200 text-xs">Configure a thermal printer for this terminal</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Printer Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Bar Receipt Printer"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Printer Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set('printerRole', r.value)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    form.printerRole === r.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-[#2a2a2a] hover:border-gray-300'}`}>
                  <div className={`w-2 h-2 rounded-full ${r.dot} mb-1.5`} />
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{r.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Connection *</label>
            <div className="flex gap-2">
              {(['NETWORK', 'USB', 'SERIAL'] as const).map(type => (
                <button key={type} type="button" onClick={() => set('connectionType', type)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    form.connectionType === type
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-[#2a2a2a] text-gray-500 hover:border-gray-300'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* IP/Port */}
          {form.connectionType === 'NETWORK' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">IP Address *</label>
                <input value={form.ipAddress} onChange={e => set('ipAddress', e.target.value)} placeholder="192.168.1.100"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Port</label>
                <input type="number" value={form.port} onChange={e => set('port', Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
            </div>
          )}

          {/* USB/Serial */}
          {form.connectionType !== 'NETWORK' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Detected Devices *</label>
                <button type="button" onClick={discoverPrinters} disabled={discovering}
                  className="text-xs text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-700">
                  {discovering && <Loader2 className="w-3 h-3 animate-spin" />} Refresh
                </button>
              </div>
              {availablePorts.length > 0 ? (
                <select value={form.devicePath} onChange={e => set('devicePath', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select a device…</option>
                  {availablePorts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> No devices found. Enter manually below.
                </div>
              )}
              <input value={form.devicePath} onChange={e => set('devicePath', e.target.value)}
                placeholder={form.connectionType === 'USB' ? 'e.g. USB001' : 'e.g. COM3'}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition" />
              {form.connectionType === 'SERIAL' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Baud Rate</label>
                  <input type="number" value={form.baudRate} onChange={e => set('baudRate', Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
              )}
            </div>
          )}

          {/* Paper Width */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Paper Width</label>
            <div className="flex gap-2">
              {PAPER_WIDTHS.map(w => (
                <button key={w.value} type="button" onClick={() => set('paperWidth', w.value)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    form.paperWidth === w.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-[#2a2a2a] text-gray-500 hover:border-gray-300'}`}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hotel Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Hotel / Property Name</label>
            <input value={form.hotelName} onChange={e => set('hotelName', e.target.value)} placeholder="Grand Palace Hotel"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" />
          </div>

          {/* Hotel Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Address Line</label>
            <input value={form.hotelAddress} onChange={e => set('hotelAddress', e.target.value)} placeholder="123 Victoria Island, Lagos"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" />
          </div>

          {/* Cash Drawer */}
          {form.printerRole === 'RECEIPT' && (
            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Open Cash Drawer on Print</p>
                <p className="text-xs text-gray-400 mt-0.5">Kicks the drawer each time a receipt prints</p>
              </div>
              <div onClick={() => set('openCashDrawer', !form.openCashDrawer)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.openCashDrawer ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.openCashDrawer ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </label>
          )}

          {/* Active */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Active</p>
              <p className="text-xs text-gray-400 mt-0.5">Disable to temporarily stop printing to this printer</p>
            </div>
            <div onClick={() => set('isActive', !form.isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#1e1e1e] flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-[#2a2a2a] text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim() || (form.connectionType === 'NETWORK' && !form.ipAddress.trim()) || (form.connectionType !== 'NETWORK' && !form.devicePath?.trim())}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Printer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HardwareSettingsPage() {
  const router = useRouter();
  const { isDesktopMode } = useLodgeCoreProvider();
  const [printers,  setPrinters]  = useState<PrinterConfig[]>([]);
  const [lockStatus, setLockStatus] = useState<{ configuredProvider: string; activeProvider: string; restartRequired: boolean } | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editPrinter, setEditPrinter] = useState<Partial<PrinterConfig> | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [showProUsb, setShowProUsb] = useState(false);

  const loadHardware = async () => {
    if (!isDesktopMode) { setLoading(false); return; }
    try {
      const res = await invokeDesktop('hardware.getPrinters');
      if (res?.success) setPrinters((res.data ?? []).filter((p: PrinterConfig) => p.printerRole === 'FRONTDESK' || p.printerRole === 'RECEIPT'));
      const lockRes = await invokeDesktop('hardware.getLockProvider');
      if (lockRes) setLockStatus(typeof lockRes === 'string' ? JSON.parse(lockRes) : lockRes);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadHardware(); }, [isDesktopMode]);

  const handleLockChange = async (provider: string) => {
    setSavingLock(true);
    try {
      const res = await invokeDesktop('hardware.setLockProvider', { provider });
      if (res) setLockStatus(typeof res === 'string' ? JSON.parse(res) : res);
    } catch { /* ignore */ }
    setSavingLock(false);
  };

  const handleSave = async (form: Omit<PrinterConfig, 'id'> & { id?: string }) => {
    setSaving(true);
    try {
      const res = await invokeDesktop('hardware.savePrinter', { config: JSON.stringify(form) });
      if (res?.success) { setShowForm(false); setEditPrinter(null); await loadHardware(); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try { await invokeDesktop('hardware.deletePrinter', { id }); await loadHardware(); } catch { /* ignore */ }
  };

  const currentProvider = LOCK_PROVIDERS.find(p => p.value === lockStatus?.configuredProvider);

  // ── Not desktop ─────────────────────────────────────────────────────────
  if (!isDesktopMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto">
            <Monitor className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Desktop App Only</h2>
          <p className="text-gray-500 text-sm">Hardware configuration is only available in the Windows Desktop App.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#080e1f]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-[100px]" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-violet-600/15 blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10 py-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <Link href="/frontdesk" onClick={e => { e.preventDefault(); goBack(router, '/frontdesk'); }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <Settings2 className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.22em] text-indigo-400 mb-1">Front Desk · Hardware</p>
                <h1 className="text-2xl font-bold text-white tracking-tight">Hardware Settings</h1>
                <p className="text-sm text-slate-400 mt-0.5">Thermal printers and keycard lock systems for this terminal.</p>
              </div>
            </div>
            <button onClick={() => { setEditPrinter(null); setShowForm(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/30">
              <Plus className="w-4 h-4" /> Add Printer
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-10 py-8 space-y-8">

        {/* ── Lock System Card ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Keycard Lock System</h2>
          </div>

          <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1e1e1e] rounded-2xl shadow-sm overflow-hidden">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-[#1e1e1e]">

              {/* Left: Provider Selector */}
              <div className="p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Select Provider</p>
                <ProviderDropdown
                  value={lockStatus?.configuredProvider ?? 'deluns'}
                  onChange={handleLockChange}
                  disabled={savingLock}
                />
                {savingLock && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-indigo-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying…
                  </div>
                )}

                {/* proUSB configure button */}
                {lockStatus?.configuredProvider?.toLowerCase() === 'prousb' && (
                  <button
                    id="prousb-configure-btn"
                    onClick={() => setShowProUsb(true)}
                    className="mt-4 w-full flex items-center justify-between px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔑</span>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Configure proUSB Encoder</p>
                        <p className="text-[11px] text-indigo-500 mt-0.5">Hotel code · USB port</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>

              {/* Right: Status Panel */}
              <div className="p-6 bg-gray-50/50 dark:bg-[#0d0d0d]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Status</p>

                {lockStatus ? (
                  <div className="space-y-4">
                    {/* Provider info chip */}
                    {currentProvider && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#141414] border border-gray-100 dark:border-[#222]">
                        <span className="text-2xl">{currentProvider.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentProvider.label}</p>
                          <p className="text-[11px] text-gray-400">{currentProvider.sub}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Configured</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 capitalize">{lockStatus.configuredProvider}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Active (running)</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 capitalize">{lockStatus.activeProvider}</span>
                      </div>
                    </div>

                    {lockStatus.restartRequired ? (
                      <div className="flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3.5 py-3 rounded-xl">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        Restart LodgeCore Desktop to apply the new lock system.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 px-3.5 py-2.5 rounded-xl">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Provider is active and running.
                      </div>
                    )}
                  </div>
                ) : loading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(n => <div key={n} className="h-8 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg animate-pulse" />)}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Lock system status unavailable.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Printers Section ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Configured Printers</h2>
              {printers.length > 0 && (
                <span className="ml-1 text-[10px] font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                  {printers.length}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(n => <div key={n} className="h-52 bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#1e1e1e] animate-pulse" />)}
            </div>
          ) : printers.length === 0 ? (
            <div className="bg-white dark:bg-[#111] border border-dashed border-gray-200 dark:border-[#222] rounded-2xl flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl flex items-center justify-center mb-4">
                <Printer className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Printers Configured</h3>
              <p className="text-sm text-gray-400 max-w-xs mb-6">Add a thermal printer to start printing receipts and folios from this terminal.</p>
              <button onClick={() => { setEditPrinter(null); setShowForm(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> Add First Printer
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {printers.map(p => (
                <PrinterCard key={p.id} printer={p}
                  onEdit={() => { setEditPrinter(p); setShowForm(true); }}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
              {/* Add another */}
              <button onClick={() => { setEditPrinter(null); setShowForm(true); }}
                className="h-full min-h-[180px] flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 dark:border-[#2a2a2a] rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#1e1e1e] group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="text-sm font-medium text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Add Printer</p>
              </button>
            </div>
          )}
        </section>

        {/* ── Role legend ───────────────────────────────────────────────── */}
        {printers.length > 0 && (
          <div className="flex items-center gap-6 flex-wrap">
            {ROLES.map(r => (
              <div key={r.value} className="flex items-center gap-2 text-xs text-gray-400">
                <div className={`w-2 h-2 rounded-full ${r.dot}`} />
                <span className="font-medium text-gray-600 dark:text-gray-300">{r.label}</span>
                <span>— {r.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showForm && (
        <PrinterForm
          initial={editPrinter ?? {}}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditPrinter(null); }}
          saving={saving}
        />
      )}
      {showProUsb && <ProUsbSettingsModal onClose={() => setShowProUsb(false)} />}
    </div>
  );
}
