'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, ListTree, BedDouble, ReceiptText, TrendingUp } from 'lucide-react';
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

export function RoomChargesDialog({ businessDate, auditId, open: controlledOpen, onOpenChange, showTrigger = true }: RoomChargesDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && <DialogTrigger>
        <Button variant="outline" size="sm" className="mt-2 text-xs font-semibold">
          <ListTree className="w-3 h-3 mr-1" />
          View Analysis
        </Button>
      </DialogTrigger>}
      <DialogContent className="!h-[90vh] !w-[calc(100vw-2rem)] !max-w-6xl overflow-hidden rounded-[2rem] border-0 bg-slate-100/95 p-2 shadow-2xl sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] bg-slate-50 p-3 sm:p-5">
          <div className="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-[0_16px_35px_rgba(15,23,42,0.2)] sm:p-7">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
            <DialogHeader className="relative">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-indigo-200 ring-1 ring-white/15"><ReceiptText className="h-6 w-6" /></div>
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200/70">Audit analysis</p><DialogTitle className="mt-1 text-2xl font-semibold tracking-tight text-white">Room charges billed</DialogTitle><p className="mt-1 text-sm text-slate-400">{new Date(businessDate).toLocaleDateString(undefined, { dateStyle: 'full' })}</p></div>
                </div>
                <span className="self-start rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">Posted charges</span>
              </div>
            </DialogHeader>
          </div>

          <div className="grid gap-3 py-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><BedDouble className="h-4 w-4 text-indigo-500" /> Rooms billed</div><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{loading ? '—' : roomCount}</p><p className="mt-1 text-xs text-slate-400">Unique occupied rooms</p></div>
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><TrendingUp className="h-4 w-4 text-emerald-500" /> Average charge</div><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{loading ? '—' : formatCurrency(averageCharge)}</p><p className="mt-1 text-xs text-slate-400">Per posted entry</p></div>
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700"><ReceiptText className="h-4 w-4" /> Total billed</div><p className="mt-2 text-2xl font-semibold tracking-tight text-indigo-900">{loading ? '—' : formatCurrency(totalAmount)}</p><p className="mt-1 text-xs text-indigo-600/70">Highest entry {loading ? '—' : formatCurrency(highestCharge)}</p></div>
          </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                  </TableCell>
                </TableRow>
              ) : charges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                    No room charges found for this audit.
                  </TableCell>
                </TableRow>
              ) : (
                charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell className="font-medium">{charge.roomNumber}</TableCell>
                    <TableCell>{charge.guestName}</TableCell>
                    <TableCell className="text-slate-500">{charge.description}</TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      {formatCurrency(charge.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {!loading && charges.length > 0 && (
              <TableFooter className="sticky bottom-0 border-t bg-slate-50/95 backdrop-blur">
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-black text-slate-700 uppercase tracking-wider text-xs">
                    Total Billed
                  </TableCell>
                  <TableCell className="text-right font-black text-slate-900 text-base">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
