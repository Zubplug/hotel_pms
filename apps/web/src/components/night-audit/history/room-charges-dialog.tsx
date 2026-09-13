'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, ListTree, BedDouble, ReceiptText, TrendingUp, X } from 'lucide-react';
import { getNightAuditRoomCharges } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { useProperty } from '@/components/PropertyProvider';

interface RoomChargesDialogProps {
  businessDate: string | Date;
  auditId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function RoomChargesDialog({
  businessDate,
  auditId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: RoomChargesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [loading, setLoading] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const { propertyId } = useProperty();

  useEffect(() => {
    if (open && propertyId && auditId) {
      setLoading(true);
      getNightAuditRoomCharges(propertyId, auditId)
        .then(setCharges)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, propertyId, auditId]);

  const totalAmount = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const roomCount = new Set(charges.map((charge) => charge.roomNumber).filter(Boolean)).size;
  const averageCharge = charges.length ? totalAmount / charges.length : 0;
  const highestCharge = charges.reduce((highest, charge) => Math.max(highest, Number(charge.amount) || 0), 0);

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const summaryStats = [
    {
      label: 'Rooms Billed',
      value: loading ? '—' : String(roomCount),
      sub: 'Unique occupied rooms',
      icon: BedDouble,
      accent: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
      iconBg: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-400',
    },
    {
      label: 'Average Charge',
      value: loading ? '—' : formatCurrency(averageCharge),
      sub: 'Per posted entry',
      icon: TrendingUp,
      accent: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      iconBg: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400',
    },
    {
      label: 'Total Billed',
      value: loading ? '—' : formatCurrency(totalAmount),
      sub: `Highest: ${loading ? '—' : formatCurrency(highestCharge)}`,
      icon: ReceiptText,
      accent: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
      iconBg: 'border-violet-400/20 bg-violet-400/10 text-violet-400',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-indigo-300 transition-all hover:border-indigo-400/30 hover:bg-indigo-400/10">
          <ListTree className="w-3 h-3" />
          View Analysis
        </DialogTrigger>
      )}

      <DialogContent
        className="!h-[90vh] !w-[calc(100vw-2rem)] !max-w-5xl overflow-hidden border-white/[0.08] p-0 shadow-2xl"
        style={{ background: '#07090f', borderRadius: '24px' }}
      >
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Header ── */}
          <div
            className="relative shrink-0 overflow-hidden px-6 py-6 sm:px-8"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(124,58,237,0.08) 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Glow blob */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />

            <DialogHeader className="relative">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/25 text-indigo-300"
                    style={{ background: 'rgba(99,102,241,0.12)', boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}
                  >
                    <ReceiptText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-indigo-400/70">Audit Analysis</p>
                    <DialogTitle className="mt-0.5 text-xl font-bold tracking-tight text-white">
                      Room Charges Billed
                    </DialogTitle>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {new Date(businessDate).toLocaleDateString(undefined, { dateStyle: 'full' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                    Posted Charges
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── Stats row ── */}
          <div className="grid shrink-0 grid-cols-3 gap-3 px-6 py-4 sm:px-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {summaryStats.map(({ label, value, sub, icon: Icon, accent, iconBg }) => (
              <div
                key={label}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${accent}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${iconBg}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-0.5 text-base font-bold text-white tabular-nums">{value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600 truncate">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Table ── */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5 pt-3 sm:px-8">
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/[0.07]" style={{ background: 'rgba(255,255,255,0.025)' }}>
              <Table>
                <TableHeader>
                  <TableRow
                    className="border-white/[0.07] hover:bg-transparent"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Room</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Guest</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Description</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-white/[0.05] hover:bg-white/[0.02]">
                      <TableCell colSpan={4} className="h-32 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400" />
                      </TableCell>
                    </TableRow>
                  ) : charges.length === 0 ? (
                    <TableRow className="border-white/[0.05] hover:bg-white/[0.02]">
                      <TableCell colSpan={4} className="h-32 text-center text-sm text-slate-500">
                        No room charges found for this audit.
                      </TableCell>
                    </TableRow>
                  ) : (
                    charges.map((charge) => (
                      <TableRow key={charge.id} className="border-white/[0.05] transition-colors hover:bg-white/[0.03]">
                        <TableCell>
                          <span className="inline-flex items-center rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-xs font-bold text-indigo-300">
                            {charge.roomNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-300">{charge.guestName}</TableCell>
                        <TableCell className="text-sm text-slate-500">{charge.description}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-white tabular-nums">
                          {formatCurrency(charge.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!loading && charges.length > 0 && (
                  <TableFooter>
                    <TableRow className="border-white/[0.07]" style={{ background: 'rgba(99,102,241,0.08)' }}>
                      <TableCell colSpan={3} className="text-right text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
                        Total Billed
                      </TableCell>
                      <TableCell className="text-right text-base font-bold text-white tabular-nums">
                        {formatCurrency(totalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
