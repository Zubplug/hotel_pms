'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';

function useTerminalPrinter() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(HardwareBridge.isAvailable());
  }, []);

  return available;
}

export function PrintPoolAdmissionButton({ entry }: { entry: any }) {
  const available = useTerminalPrinter();
  const [printing, setPrinting] = useState(false);

  if (!available) return null;

  const print = async () => {
    setPrinting(true);
    try {
      const pass = entry.passType ?? {};
      const facility = entry.facility?.name || 'Swimming Pool';
      const guestName = entry.guest
        ? `${entry.guest.firstName || ''} ${entry.guest.lastName || ''}`.trim()
        : 'Walk-in guest';
      const unitPrice = Number(pass.price || 0);
      const quantity = Math.max(1, Number(entry.guestCount || 1));
      const result = await HardwareBridge.printReceipt({
        orderNumber: String(entry.entryNumber || entry.id || 'POOL-ADMISSION'),
        items: [{
          name: `${facility} — ${pass.name || 'Pool admission'}`,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
        }],
        subtotal: unitPrice * quantity,
        taxAmount: 0,
        total: unitPrice * quantity,
        paymentMethod: entry.posOrder?.paymentStatus === 'PAID' ? 'PAID' : 'POOL ADMISSION',
        currency: pass.currency || 'NGN',
        serverName: guestName,
        outletName: facility,
        printedAt: new Date().toISOString(),
        isReprint: true,
      });
      if (result?.success === false) throw new Error(result.error || 'Printer did not accept the ticket');
      toast.success('Pool admission ticket sent to printer');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to print pool admission ticket');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <button
      onClick={() => void print()}
      disabled={printing}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50"
      style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.28)' }}
    >
      {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
      Print Admission Ticket
    </button>
  );
}

export function PrintPoolPaymentReceiptButton({ entry }: { entry: any }) {
  const available = useTerminalPrinter();
  const [printing, setPrinting] = useState(false);
  const hasPayment = Boolean(entry.posOrder?.paymentStatus === 'PAID' || entry.posOrderId);

  if (!available || !hasPayment) return null;

  const print = async () => {
    setPrinting(true);
    try {
      const pass = entry.passType ?? {};
      const facility = entry.facility?.name || 'Swimming Pool';
      const guestName = entry.guest
        ? `${entry.guest.firstName || ''} ${entry.guest.lastName || ''}`.trim()
        : 'Walk-in guest';
      const unitPrice = Number(pass.price || 0);
      const quantity = Math.max(1, Number(entry.guestCount || 1));
      const result = await HardwareBridge.printReceipt({
        orderNumber: String(entry.posOrder?.orderNumber || entry.entryNumber || entry.posOrderId || 'POOL-PAYMENT'),
        items: [{
          name: `${facility} admission payment — ${pass.name || 'Pool admission'}`,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
        }],
        subtotal: unitPrice * quantity,
        taxAmount: 0,
        total: Number(entry.posOrder?.total || unitPrice * quantity),
        paymentMethod: 'PAID',
        currency: pass.currency || 'NGN',
        serverName: guestName,
        outletName: facility,
        printedAt: new Date().toISOString(),
        isReprint: true,
      });
      if (result?.success === false) throw new Error(result.error || 'Printer did not accept the receipt');
      toast.success('Pool payment receipt sent to printer');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to print pool payment receipt');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <button
      onClick={() => void print()}
      disabled={printing}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50"
      style={{ background: 'rgba(52,211,153,0.14)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.26)' }}
    >
      {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
      Print Payment Receipt
    </button>
  );
}

export function PrintPoolShiftButton({ data }: { data: any }) {
  const available = useTerminalPrinter();
  const [printing, setPrinting] = useState(false);

  if (!available) return null;

  const print = async () => {
    setPrinting(true);
    try {
      const result = await HardwareBridge.printShiftReport({
        staffName: data.staffName || 'Pool Staff',
        ordersCount: Number(data.todayAdmissions || 0),
        grossSales: Number(data.revenue || 0),
        netSales: Number(data.revenue || 0),
        cashSales: Number(data.byMethod?.find((item: any) => item.method === 'CASH')?.amount || 0),
        cardSales: Number(data.byMethod?.find((item: any) => item.method === 'CARD')?.amount || 0),
        roomCharges: Number(data.byMethod?.find((item: any) => item.method === 'ROOM_CHARGE')?.amount || 0),
        totalDiscounts: 0,
        currency: data.currency || 'NGN',
        printedAt: new Date().toISOString(),
        reportTitle: 'Pool Terminal Shift Summary',
        otherCharges: Number(data.byMethod?.find((item: any) => item.method === 'COMPLIMENTARY')?.amount || 0),
        paymentSummary: data.byMethod || [],
      });
      if (result?.success === false) throw new Error(result.error || 'Printer did not accept the report');
      toast.success('Pool shift summary sent to printer');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to print pool shift summary');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <button
      onClick={() => void print()}
      disabled={printing}
      title="Print shift summary"
      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 disabled:opacity-50"
    >
      {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
    </button>
  );
}
