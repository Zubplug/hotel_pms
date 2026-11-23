'use client';
import React from 'react';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { Panel, PanelHeader, Badge, money } from './ui';

export function GuestAmenityControl({ data }: { data: NightAuditData }) {
  const ctrl = data.financial.guestAmenity;
  if (!ctrl) return null;

  const cur = data.property.baseCurrency || 'NGN';
  const warnings = [...(ctrl.warnings || []), ...(ctrl.blockers || [])];
  const hasShortage = warnings.length > 0;

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={Package}
        title="Guest Amenity"
        subtitle="Inventory COGS preflight"
        tone={hasShortage ? 'amber' : 'emerald'}
        actions={
          <Badge tone={!ctrl.enabled ? 'neutral' : hasShortage ? 'amber' : 'emerald'}>
            {!ctrl.enabled ? 'Disabled' : hasShortage ? 'Operational Exception' : 'Ready'}
          </Badge>
        }
      />

      {!ctrl.enabled ? (
        <div className="px-4 py-3 text-[11.5px] text-slate-500">Complimentary amenities are disabled for this property.</div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {[
            { label: 'Warehouse', value: ctrl.warehouse?.name || 'Not configured' },
            { label: 'In-house guests', value: String(ctrl.guestCount), mono: true },
            { label: 'Cost / guest', value: money(ctrl.perGuestCost, cur, true), mono: true },
            { label: 'Est. COGS', value: money(ctrl.estimatedCost, cur, true), mono: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] text-slate-500">{row.label}</span>
              <span className={`text-[12.5px] font-semibold ${row.mono ? 'font-mono tabular-nums text-white' : 'text-slate-200'}`}>{row.value}</span>
            </div>
          ))}

          {(hasShortage || ctrl.zeroCostItems.length > 0) && (
            <div className="space-y-1 px-4 py-2.5">
              {warnings.map((warning: string) => (
                <div key={warning} className="flex items-start gap-1.5 text-[11px] text-amber-300">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{warning}
                </div>
              ))}
              {ctrl.zeroCostItems.length > 0 && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-300">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />Reference cost used: {ctrl.zeroCostItems.join(', ')}
                </div>
              )}
            </div>
          )}

          {!hasShortage && ctrl.zeroCostItems.length === 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 text-[11.5px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />All amenity lines costed correctly
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
