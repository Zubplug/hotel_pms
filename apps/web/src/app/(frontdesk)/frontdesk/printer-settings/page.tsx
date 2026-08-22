'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Plus, Trash2, Wifi, WifiOff, CheckCircle, XCircle, Loader2, ChevronRight, Settings2, ArrowLeft } from 'lucide-react';
import { invokeDesktop } from '@/lib/desktop/IpcBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

// ─── Types ─────────────────────────────────────────────────────────────────
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
  { value: 'FRONTDESK', label: 'Front Desk Printer', desc: 'Prints folios and reservation documents', color: 'bg-purple-500' },
  { value: 'RECEIPT', label: 'Receipt Printer', desc: 'Prints customer receipts at checkout', color: 'bg-blue-500' },
];

const PAPER_WIDTHS = [
  { value: 32, label: '58mm (32 chars)' },
  { value: 48, label: '80mm (48 chars)' },
];

const BLANK_PRINTER: Omit<PrinterConfig, 'id'> = {
  name: '',
  printerRole: 'FRONTDESK',
  connectionType: 'NETWORK',
  devicePath: '',
  baudRate: 9600,
  ipAddress: '',
  port: 9100,
  paperWidth: 48,
  hotelName: '',
  hotelAddress: '',
  outletId: null,
  openCashDrawer: false,
  isActive: true,
};

// ─── Printer Card ───────────────────────────────────────────────────────────
function PrinterCard({
  printer,
  onEdit,
  onDelete,
  onTest,
}: {
  printer: PrinterConfig;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMsg, setTestMsg] = useState('');
  const role = ROLES.find((r) => r.value === printer.printerRole) ?? ROLES[0];

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      const res = await invokeDesktop('hardware.testPrinter', { config: JSON.stringify(printer) });
      if (res?.success) {
        setTestStatus('success');
        setTestMsg(res.message ?? 'Connected!');
      } else {
        setTestStatus('failed');
        setTestMsg(res?.error ?? 'Connection failed');
      }
    } catch {
      setTestStatus('failed');
      setTestMsg('Could not reach printer');
    }
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Colour strip */}
      <div className={`h-1.5 w-full ${role.color}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${role.color} bg-opacity-10 rounded-xl flex items-center justify-center`}>
              <Printer className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{printer.name}</h3>
              <span className="text-xs text-gray-400">{role.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {printer.isActive ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
              </span>
            ) : (
              <span className="text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Inactive</span>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Connection</span>
            <span className="font-mono text-gray-900 dark:text-white">
               {printer.connectionType === 'NETWORK' 
                  ? `${printer.ipAddress}:${printer.port}`
                  : printer.devicePath || 'Not Set'}
            </span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Paper Width</span>
            <span className="text-gray-900 dark:text-white">{printer.paperWidth === 32 ? '58mm' : '80mm'}</span>
          </div>
          {printer.openCashDrawer && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Cash Drawer</span>
              <span className="text-emerald-600 font-medium">Opens on receipt</span>
            </div>
          )}
        </div>

        {/* Test result */}
        {testStatus !== 'idle' && (
          <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            testStatus === 'testing' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' :
            testStatus === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
            'bg-red-50 dark:bg-red-900/20 text-red-600'
          }`}>
            {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {testStatus === 'success' && <CheckCircle className="w-3.5 h-3.5" />}
            {testStatus === 'failed' && <XCircle className="w-3.5 h-3.5" />}
            {testStatus === 'testing' ? 'Connecting…' : testMsg}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-gray-200 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors disabled:opacity-60"
          >
            {testStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            Test Print
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 border border-red-100 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Printer Form Drawer ────────────────────────────────────────────────────
function PrinterForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<PrinterConfig>;
  onSave: (p: Omit<PrinterConfig, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<PrinterConfig, 'id'> & { id?: string }>({
    ...BLANK_PRINTER,
    ...initial,
  });
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const discoverPrinters = async () => {
    setDiscovering(true);
    try {
      const res = await invokeDesktop('hardware.getAvailableHardwarePrinters');
      if (res?.success && Array.isArray(res.data)) {
        setAvailablePorts(res.data);
      }
    } catch (e) { console.error(e); }
    setDiscovering(false);
  };

  useEffect(() => {
    if (form.connectionType !== 'NETWORK') {
       discoverPrinters();
    }
  }, [form.connectionType]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{form.id ? 'Edit Printer' : 'Add Printer'}</h2>
              <p className="text-indigo-100 text-xs">Configure a network thermal printer</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Printer Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Bar Receipt Printer"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Printer Role *</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('printerRole', r.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.printerRole === r.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-[#2a2a2a] hover:border-gray-300'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${r.color} mb-1.5`} />
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{r.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Connection Type *</label>
            <div className="flex gap-2">
               {['NETWORK', 'USB', 'SERIAL'].map(type => (
                 <button
                    key={type}
                    type="button"
                    onClick={() => set('connectionType', type)}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      form.connectionType === type
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {type}
                 </button>
               ))}
            </div>
          </div>

          {/* IP + Port */}
          {form.connectionType === 'NETWORK' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">IP Address *</label>
                <input
                  value={form.ipAddress}
                  onChange={(e) => set('ipAddress', e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => set('port', Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* USB / Serial Path */}
          {form.connectionType !== 'NETWORK' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Available Devices / Ports *</label>
                <button type="button" onClick={discoverPrinters} disabled={discovering} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                   {discovering ? <Loader2 className="w-3 h-3 animate-spin"/> : null} Refresh
                </button>
              </div>
              
              {availablePorts.length > 0 ? (
                <select
                  value={form.devicePath}
                  onChange={(e) => set('devicePath', e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a device...</option>
                  {availablePorts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">No supported printers found. Please enter manually.</div>
              )}

              <input
                value={form.devicePath}
                onChange={(e) => set('devicePath', e.target.value)}
                placeholder={form.connectionType === 'USB' ? "e.g. Receipt Printer" : "e.g. COM3 or /dev/ttyS0"}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 mt-2"
              />

              {form.connectionType === 'SERIAL' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mt-3 mb-1">Baud Rate</label>
                  <input
                    type="number"
                    value={form.baudRate}
                    onChange={(e) => set('baudRate', Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Paper Width */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Paper Width</label>
            <div className="flex gap-2">
              {PAPER_WIDTHS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => set('paperWidth', w.value)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    form.paperWidth === w.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hotel Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Hotel / Property Name (printed on header)</label>
            <input
              value={form.hotelName}
              onChange={(e) => set('hotelName', e.target.value)}
              placeholder="Grand Palace Hotel"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Hotel Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Address Line (printed on header)</label>
            <input
              value={form.hotelAddress}
              onChange={(e) => set('hotelAddress', e.target.value)}
              placeholder="123 Victoria Island, Lagos"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Cash Drawer (only for receipt printers) */}
          {form.printerRole === 'RECEIPT' && (
            <label className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Open Cash Drawer on Print</p>
                <p className="text-xs text-gray-400 mt-0.5">Kicks the drawer each time a receipt is printed</p>
              </div>
              <div
                onClick={() => set('openCashDrawer', !form.openCashDrawer)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.openCashDrawer ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.openCashDrawer ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </label>
          )}

          {/* Active toggle */}
          <label className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Active</p>
              <p className="text-xs text-gray-400 mt-0.5">Disable to temporarily stop printing to this printer</p>
            </div>
            <div
              onClick={() => set('isActive', !form.isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2a2a2a] flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#2a2a2a] text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim() || (form.connectionType === 'NETWORK' && !form.ipAddress.trim()) || (form.connectionType !== 'NETWORK' && !form.devicePath?.trim())}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Printer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function PrinterSettingsPage() {
  const { isDesktopMode } = useLodgeCoreProvider();
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPrinter, setEditPrinter] = useState<Partial<PrinterConfig> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadPrinters = async () => {
    if (!isDesktopMode) { setLoading(false); return; }
    try {
      const res = await invokeDesktop('hardware.getPrinters');
      if (res?.success) {
        const allPrinters: PrinterConfig[] = res.data ?? [];
        setPrinters(allPrinters.filter(p => p.printerRole === 'FRONTDESK' || p.printerRole === 'RECEIPT'));
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadPrinters(); }, [isDesktopMode]);

  const handleSave = async (form: Omit<PrinterConfig, 'id'> & { id?: string }) => {
    setSaving(true);
    try {
      const res = await invokeDesktop('hardware.savePrinter', { config: JSON.stringify(form) });
      if (res?.success) { setShowForm(false); setEditPrinter(null); await loadPrinters(); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    try {
      await invokeDesktop('hardware.deletePrinter', { id });
      await loadPrinters();
    } catch { /* ignore */ }
    setDeleteId(null);
  };

  // ── Not in Desktop mode ──────────────────────────────────────────────────
  if (!isDesktopMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto">
            <Printer className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Desktop App Only</h2>
          <p className="text-gray-500 text-sm">
            Printer configuration is only available in the Windows Desktop App. Printers connect directly to the local network from the terminal hardware.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#111] border-b border-gray-100 dark:border-[#1f1f1f] px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/frontdesk"
              className="w-10 h-10 bg-gray-50 hover:bg-gray-100 dark:bg-[#1a1a1a] dark:hover:bg-[#252525] text-gray-500 dark:text-gray-400 rounded-xl flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Printer Setup</h1>
              <p className="text-sm text-gray-400">Configure thermal receipt and kitchen printers for this terminal</p>
            </div>
          </div>
          <button
            onClick={() => { setEditPrinter(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm shadow-indigo-200 dark:shadow-indigo-900/30"
          >
            <Plus className="w-4 h-4" />
            Add Printer
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Info banner */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl p-4 flex gap-3">
          <div className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0">ℹ️</div>
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            <strong>Supported Printers:</strong> We support both Network and Direct (USB/Serial) POS printers. For network printers, ensure it's on the same local network. For USB, select your device from the discovered list. 
          </div>
        </div>

        {/* Printer grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-52 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : printers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl flex items-center justify-center mb-5">
              <Printer className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Printers Configured</h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Add your first thermal printer to start printing receipts and kitchen order tickets from this terminal.
            </p>
            <button
              onClick={() => { setEditPrinter(null); setShowForm(true); }}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Printer
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printers.map((p) => (
              <PrinterCard
                key={p.id}
                printer={p}
                onEdit={() => { setEditPrinter(p); setShowForm(true); }}
                onDelete={() => handleDelete(p.id)}
                onTest={() => {}}
              />
            ))}
          </div>
        )}

        {/* Role legend */}
        {printers.length > 0 && (
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Printer Roles</p>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <div key={r.value} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${r.color} shrink-0`} />
                  <span className="font-medium text-gray-900 dark:text-white w-32">{r.label}</span>
                  <span className="text-gray-400">{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Form Overlay */}
      {showForm && (
        <PrinterForm
          initial={editPrinter ?? {}}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditPrinter(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
