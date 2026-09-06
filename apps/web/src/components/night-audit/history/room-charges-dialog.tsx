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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ListTree } from 'lucide-react';
import { getNightAuditRoomCharges } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { useProperty } from '@/components/PropertyProvider';

interface RoomChargesDialogProps {
  businessDate: string | Date;
  auditId: string;
}

export function RoomChargesDialog({ businessDate, auditId }: RoomChargesDialogProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="mt-2 text-xs font-semibold">
          <ListTree className="w-3 h-3 mr-1" />
          View Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Room Charges Billed</DialogTitle>
          <p className="text-sm text-slate-500">
            Analysis for {new Date(businessDate).toLocaleDateString(undefined, { dateStyle: 'full' })}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 border rounded-md">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0">
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
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
