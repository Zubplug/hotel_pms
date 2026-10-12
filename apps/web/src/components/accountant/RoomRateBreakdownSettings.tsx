'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  UtensilsCrossed,
  Percent,
  DollarSign,
  Save,
  Info,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Building2,
} from 'lucide-react';
import {
  RoomRateBreakdownConfig,
  DEFAULT_BREAKDOWN_CONFIG,
  computeRateBreakdown
} from '@/lib/room-rate-breakdown';

interface Props {
  propertyId: string;
}

interface LiveRoomType {
  id: string;
  name: string;
  code?: string | null;
  baseRate: number | string;
  currency?: string | null;
}

export function RoomRateBreakdownSettings({ propertyId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RoomRateBreakdownConfig>(DEFAULT_BREAKDOWN_CONFIG);
  const [currency, setCurrency] = useState('NGN');
  const [testGross, setTestGross] = useState(50000);
  const [roomTypes, setRoomTypes] = useState<LiveRoomType[]>([]);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const [settingsRes, roomTypesRes] = await Promise.all([
          fetch(`/api/v1/properties/${propertyId}/rate-breakdown-settings`),
          fetch(`/api/v1/room-types?propertyId=${encodeURIComponent(propertyId)}`),
        ]);
        if (!settingsRes.ok) throw new Error('Failed to load breakdown settings');
        if (!roomTypesRes.ok) throw new Error('Failed to load property room types');

        const data = await settingsRes.json();
        const roomTypesPayload = await roomTypesRes.json();
        const liveRoomTypes = roomTypesPayload?.data ?? roomTypesPayload;
        if (!Array.isArray(liveRoomTypes)) throw new Error('Invalid property room types response');

        setRoomTypes(liveRoomTypes);
        if (data.config) {
          setConfig(data.config);
        }
        if (data.baseCurrency) {
          setCurrency(data.baseCurrency);
        }
      } catch (err: any) {
        toast.error(err.message || 'Error loading settings');
      } finally {
        setLoading(false);
      }
    }

    if (propertyId) {
      loadSettings();
    }
  }, [propertyId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/v1/properties/${propertyId}/rate-breakdown-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
      }
      toast.success('Room rate breakdown settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  const previewResult = computeRateBreakdown(testGross, config, false);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-amber-400" />
            Room Rate Breakdown & Food Allocation
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Automated Hotel Stanzel 4-way revenue decomposition for room charge night audit postings.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Policy
        </button>
      </div>

      {/* ── Formula Banner ── */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-indigo-200">Decomposition Equation</h3>
            <p className="mt-1 text-xs text-indigo-300/80 leading-relaxed font-mono">
              Gross Rate = Net Accommodation + VAT (7.5%) + Service Charge (10%) + Complimentary Food Allocation (₦3,000)
            </p>
            <p className="mt-1 text-xs text-indigo-300/60">
              Net Accommodation is dynamically solved as (Gross Rate - Food Allocation) / 1.175 with rounding delta reconciled onto Net Accommodation.
            </p>
          </div>
        </div>
      </div>

      {/* ── Settings Grid ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Core Policy & Toggles */}
        <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm">
          <h3 className="text-base font-semibold text-white">General Allocation Rules</h3>

          {/* Toggle: Enable Decomposition */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Enable Rate Decomposition</p>
              <p className="text-xs text-slate-400">Post Net Room, VAT, Service Charge, and Food Allocation on night audit.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-800 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
            </label>
          </div>

          {/* Toggle: Food on Discounted Rooms */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Allow Complimentary Food on Discounted Rooms</p>
              <p className="text-xs text-slate-400">
                Default OFF: Rooms with approved discounts receive ₦0 food allocation unless enabled.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.allowComplimentaryFoodOnDiscountedRooms}
                onChange={(e) =>
                  setConfig({ ...config, allowComplimentaryFoodOnDiscountedRooms: e.target.checked })
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-800 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
            </label>
          </div>

          {/* Input: Complimentary Food Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Complimentary Food Allocation Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-500">₦</span>
              <input
                type="number"
                min="0"
                step="500"
                value={config.complimentaryFoodAmount}
                onChange={(e) =>
                  setConfig({ ...config, complimentaryFoodAmount: Number(e.target.value || 0) })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-7 pr-4 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Input: Tax & Service Charge Rates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">VAT Rate (%)</label>
              <input
                type="number"
                step="0.001"
                value={config.vatRate * 100}
                onChange={(e) =>
                  setConfig({ ...config, vatRate: Number(e.target.value || 0) / 100 })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Service Charge (%)</label>
              <input
                type="number"
                step="0.001"
                value={config.serviceChargeRate * 100}
                onChange={(e) =>
                  setConfig({ ...config, serviceChargeRate: Number(e.target.value || 0) / 100 })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 2: General Ledger Mapping */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm">
          <h3 className="text-base font-semibold text-white">General Ledger Mapping</h3>
          <p className="text-xs text-slate-400">
            Assign the chart of account codes credited during the Night Audit room charge posting.
          </p>

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs text-slate-300">Net Accommodation (Room Revenue)</span>
              <input
                type="text"
                value={config.glCodes.netAccommodation}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    glCodes: { ...config.glCodes, netAccommodation: e.target.value },
                  })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-sm text-emerald-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs text-slate-300">Complimentary Breakfast (F&B Revenue)</span>
              <input
                type="text"
                value={config.glCodes.complimentaryBreakfast}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    glCodes: { ...config.glCodes, complimentaryBreakfast: e.target.value },
                  })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-sm text-amber-300 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs text-slate-300">VAT Payable (Liability)</span>
              <input
                type="text"
                value={config.glCodes.vatPayable}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    glCodes: { ...config.glCodes, vatPayable: e.target.value },
                  })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-sm text-cyan-300 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 items-center gap-3">
              <span className="text-xs text-slate-300">Service Charge Payable (Liability)</span>
              <input
                type="text"
                value={config.glCodes.serviceChargePayable}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    glCodes: { ...config.glCodes, serviceChargePayable: e.target.value },
                  })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-sm text-indigo-300 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Live Decomposition Sandbox ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-white">Live Calculation Sandbox</h3>
        <p className="mt-1 text-xs text-slate-400">
          Test any room rate against current formula parameters in real time.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Test Gross Rate:</span>
            <input
              type="number"
              step="1000"
              value={testGross}
              onChange={(e) => setTestGross(Number(e.target.value || 0))}
              className="w-36 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Net Room (GL {config.glCodes.netAccommodation})</p>
            <p className="mt-1 text-base font-bold text-emerald-300">{formatMoney(previewResult.netAccommodation)}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-cyan-400/80">VAT 7.5% (GL {config.glCodes.vatPayable})</p>
            <p className="mt-1 text-base font-bold text-cyan-300">{formatMoney(previewResult.vat)}</p>
          </div>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-indigo-400/80">Service Charge 10% (GL {config.glCodes.serviceChargePayable})</p>
            <p className="mt-1 text-base font-bold text-indigo-300">{formatMoney(previewResult.serviceCharge)}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-400/80">Complimentary Food (GL {config.glCodes.complimentaryBreakfast})</p>
            <p className="mt-1 text-base font-bold text-amber-300">{formatMoney(previewResult.complimentaryFoodAllocation)}</p>
          </div>
        </div>
      </div>

      {/* ── Live Property Room Type Schedule ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-white">Property Room Type Rate Schedule</h3>
        <p className="mt-1 text-xs text-slate-400">
          Live active room types and rates loaded from this property, decomposed using the policy above.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Room Type</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Live Gross Rate</th>
                <th className="px-4 py-3 text-right text-emerald-400">Net Room (GL {config.glCodes.netAccommodation})</th>
                <th className="px-4 py-3 text-right text-cyan-400">VAT ({(config.vatRate * 100).toFixed(3).replace(/\.000$/, '')}%) (GL {config.glCodes.vatPayable})</th>
                <th className="px-4 py-3 text-right text-indigo-400">SC ({(config.serviceChargeRate * 100).toFixed(3).replace(/\.000$/, '')}%) (GL {config.glCodes.serviceChargePayable})</th>
                <th className="px-4 py-3 text-right text-amber-400">Food Alloc (GL {config.glCodes.complimentaryBreakfast})</th>
                <th className="px-4 py-3 text-right">Reconciled Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {roomTypes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No active room types are configured for this property.
                  </td>
                </tr>
              ) : roomTypes.map((roomType) => {
                const gross = Number(roomType.baseRate);
                const result = computeRateBreakdown({
                  grossRate: gross,
                  config,
                  roomTypeName: roomType.name,
                });

                return (
                  <tr key={roomType.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold text-white">{roomType.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{roomType.code || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-200">{formatMoney(gross)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">{formatMoney(result.netAccommodation)}</td>
                    <td className="px-4 py-3 text-right font-mono text-cyan-300">{formatMoney(result.vat)}</td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-300">{formatMoney(result.serviceCharge)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300">{formatMoney(result.complimentaryFoodAllocation)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> {result.balanced ? 'Exact' : 'Unbalanced'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
