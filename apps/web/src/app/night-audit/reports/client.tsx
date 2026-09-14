'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText, FileSpreadsheet, BarChart3, Users, ArrowUpDown,
  CreditCard, BookOpen, AlertOctagon, ShoppingBag, BedDouble,
  Scale, RefreshCw,
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };

type ReportDef = {
  title: string;
  slug: string;
  desc: string;
  Icon: React.ElementType;
  accent: string;
  glow: string;
  iconBg: string;
};

const REPORTS: ReportDef[] = [
  {
    title: "Manager's Flash Report",
    slug: 'managers-flash',
    desc: 'Revenue, occupancy, ADR and RevPAR overview for the business date.',
    Icon: BarChart3,
    accent: 'border-indigo-400/25',
    glow: 'rgba(99,102,241,0.12)',
    iconBg: 'rgba(99,102,241,0.15)',
  },
  {
    title: 'Detailed Revenue Report',
    slug: 'detailed-revenue',
    desc: 'Breakdown of revenue by department, charge code and room type.',
    Icon: FileSpreadsheet,
    accent: 'border-emerald-400/25',
    glow: 'rgba(16,185,129,0.10)',
    iconBg: 'rgba(16,185,129,0.15)',
  },
  {
    title: 'Trial Balance',
    slug: 'trial-balance',
    desc: 'Accounting trial balance: debits, credits and ledger integrity check.',
    Icon: Scale,
    accent: 'border-violet-400/25',
    glow: 'rgba(139,92,246,0.10)',
    iconBg: 'rgba(139,92,246,0.15)',
  },
  {
    title: 'Cashier Shift Summary',
    slug: 'cashier-summary',
    desc: 'Consolidated view of all shift drops, settlements and cash variances.',
    Icon: CreditCard,
    accent: 'border-amber-400/25',
    glow: 'rgba(245,158,11,0.10)',
    iconBg: 'rgba(245,158,11,0.15)',
  },
  {
    title: 'In-House Guest List',
    slug: 'in-house-guests',
    desc: 'Full roster of all guests currently checked in with folio balances.',
    Icon: Users,
    accent: 'border-rose-400/25',
    glow: 'rgba(244,63,94,0.10)',
    iconBg: 'rgba(244,63,94,0.15)',
  },
  {
    title: 'Departures & Arrivals',
    slug: 'departures-arrivals',
    desc: 'Expected check-outs and check-ins for the upcoming business day.',
    Icon: ArrowUpDown,
    accent: 'border-purple-400/25',
    glow: 'rgba(168,85,247,0.10)',
    iconBg: 'rgba(168,85,247,0.15)',
  },
  {
    title: 'Payment Reconciliation',
    slug: 'payment-reconciliation',
    desc: 'All payments and refunds grouped by method for the business date.',
    Icon: CreditCard,
    accent: 'border-teal-400/25',
    glow: 'rgba(20,184,166,0.10)',
    iconBg: 'rgba(20,184,166,0.15)',
  },
  {
    title: 'Transaction Journal',
    slug: 'transaction-journal',
    desc: 'Chronological ledger of all charge postings and financial entries.',
    Icon: BookOpen,
    accent: 'border-sky-400/25',
    glow: 'rgba(14,165,233,0.10)',
    iconBg: 'rgba(14,165,233,0.15)',
  },
  {
    title: 'Exceptions Report',
    slug: 'exceptions-report',
    desc: 'Voids, manual refunds, complimentaries and rate discounts.',
    Icon: AlertOctagon,
    accent: 'border-red-400/25',
    glow: 'rgba(239,68,68,0.10)',
    iconBg: 'rgba(239,68,68,0.15)',
  },
  {
    title: 'POS Reconciliation',
    slug: 'pos-reconciliation',
    desc: 'Point-of-sale totals, variances and room-charge transfer summary.',
    Icon: ShoppingBag,
    accent: 'border-orange-400/25',
    glow: 'rgba(249,115,22,0.10)',
    iconBg: 'rgba(249,115,22,0.15)',
  },
  {
    title: 'Guest Folio Postings',
    slug: 'room-charge-detail',
    desc: 'All ancillary charges posted to guest folios from POS and services.',
    Icon: BedDouble,
    accent: 'border-cyan-400/25',
    glow: 'rgba(6,182,212,0.10)',
    iconBg: 'rgba(6,182,212,0.15)',
  },
];

export default function ReportsGeneratorPage({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId } = useProperty();
  const [businessDate, setBusinessDate] = useState<string>('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`)
      .then(r => r.json())
      .then(res => {
        if (res.data?.analytics?.trend?.length > 0) {
          const trend = res.data.analytics.trend;
          setBusinessDate(String(trend[trend.length - 1].businessDate).slice(0, 10));
        } else if (res.data?.businessDate) {
          setBusinessDate(String(res.data.businessDate).slice(0, 10));
        } else {
          setBusinessDate(new Date().toISOString().slice(0, 10));
        }
      })
      .catch(() => setBusinessDate(new Date().toISOString().slice(0, 10)));
  }, [propertyId]);

  const openReport = (slug: string) => {
    if (!businessDate) { alert('Business date is required to view reports.'); return; }
    const base = managerMode ? '/general-manager/night-audit/reports/print' : '/night-audit/reports/print';
    window.location.href = `${base}/${slug}?propertyId=${propertyId}&businessDate=${businessDate}`;
  };

  return (
    <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8" style={PAGE_BG}>
      <div className="mx-auto max-w-[1540px] space-y-7">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Night Audit / Insights
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(124,58,237,0.15))', boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}
              >
                <FileText className="h-5 w-5 text-indigo-300" />
              </span>
              Audit Reports
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Generate, view and print the full night-audit report pack for any business date.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={businessDate}
              onChange={e => setBusinessDate(e.target.value)}
              className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-slate-200 outline-none focus:border-indigo-400/50"
            />
            <Link href="/night-audit/reconciliation">
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-4 text-sm font-semibold text-indigo-300 transition-all hover:bg-indigo-400/20 hover:text-indigo-200">
                <Scale className="h-4 w-4" />
                Reconciliation
              </button>
            </Link>
          </div>
        </header>

        {/* ── Info banner ── */}
        <div
          className="flex items-start gap-3 rounded-2xl border border-indigo-400/15 px-5 py-4 text-sm"
          style={{ background: 'rgba(99,102,241,0.07)' }}
        >
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400/70" />
          <div>
            <p className="font-semibold text-indigo-200">Night audit report pack</p>
            <p className="mt-0.5 text-indigo-400/70">Use the standard reports below for the close review. Custom and scheduled reporting belongs in the management reporting workspace.</p>
          </div>
        </div>

        {/* ── Report cards grid ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {REPORTS.map((report, idx) => {
            const { Icon } = report;
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={idx}
                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[20px] border transition-all duration-200 ${report.accent} ${isHovered ? 'ring-1 ring-white/[0.1] -translate-y-0.5 shadow-2xl' : ''}`}
                style={{
                  background: isHovered
                    ? `rgba(255,255,255,0.04)`
                    : `rgba(255,255,255,0.025)`,
                  boxShadow: isHovered ? `0 8px 40px ${report.glow}` : 'none',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => openReport(report.slug)}
              >
                {/* Icon header */}
                <div className="px-5 pt-5">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200"
                    style={{
                      background: report.iconBg,
                      borderColor: report.accent.replace('border-', '').replace('/25', '/30'),
                      boxShadow: isHovered ? `0 0 20px ${report.glow}` : 'none',
                    }}
                  >
                    <Icon className="h-5 w-5 text-slate-300 group-hover:text-white transition-colors" />
                  </span>
                </div>

                {/* Text */}
                <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
                  <h3 className="text-sm font-bold text-white group-hover:text-white">{report.title}</h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">{report.desc}</p>
                </div>

                {/* Footer action */}
                <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                    {businessDate || '—'}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-all group-hover:border-indigo-400/30 group-hover:bg-indigo-400/10 group-hover:text-indigo-300">
                    <FileText className="h-3 w-3" /> View
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
