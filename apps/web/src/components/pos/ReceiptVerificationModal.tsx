import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { HardwareBridge, toReceiptPrintData } from '@/lib/desktop/HardwareBridge';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Loader2 } from 'lucide-react';

interface ReceiptVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function ReceiptVerificationModal({ isOpen, onClose, order }: ReceiptVerificationModalProps) {
  const { provider } = useLodgeCoreProvider();
  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = async () => {
    if (!HardwareBridge.isAvailable()) {
      toast.error('Hardware bridge is not connected');
      return;
    }
    
    setIsPrinting(true);
    try {
      const receiptRes = await provider.pos.getReceipt(order.id);
      const receiptData = toReceiptPrintData(receiptRes?.data || receiptRes, true);
      
      if (receiptData) {
        await HardwareBridge.printReceipt(receiptData);
        toast.success('Reprint sent to hardware successfully');
      } else {
        throw new Error("Could not load receipt data");
      }
    } catch(e: any) {
      toast.error(e.message || 'Failed to print receipt');
    } finally {
      setIsPrinting(false);
    }
  };

  if (!order) return null;

  const payment = order.payments?.[0];
  const receiptId = payment?.receiptNumber || `RCP-${order.orderNumber.split('-')[1] || order.orderNumber}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-slate-50 p-0 border-0 shadow-2xl">
        <div className="bg-white p-6 rounded-t-xl border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-slate-800">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-lg">Receipt Details</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-lg mx-auto w-full max-w-sm relative">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1">{order.outlet?.name || 'LodgeCore POS'}</h2>
              <p className="text-xs text-slate-500 uppercase tracking-widest">{order.status === 'PAID' ? 'PAID RECEIPT' : 'OPEN ORDER'}</p>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-600 mb-4 pb-4 border-b border-dashed border-slate-300">
              <div className="col-span-2 flex justify-between font-medium">
                <span>Receipt:</span>
                <span className="text-slate-900">{receiptId}</span>
              </div>
              <div className="col-span-2 flex justify-between">
                <span>Order:</span>
                <span>{order.orderNumber}</span>
              </div>
              <div className="col-span-2 flex justify-between">
                <span>Date:</span>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div className="col-span-2 flex justify-between">
                <span>Table:</span>
                <span>{order.tableNumber || '-'}</span>
              </div>
            </div>

            {/* Audit Chain */}
            <div className="bg-slate-50 rounded p-3 mb-4 text-xs space-y-1.5 border border-slate-100">
              <div className="flex items-center justify-between font-semibold text-slate-700 pb-1 border-b border-slate-200 mb-2">
                Audit Chain
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Server:</span>
                <span className="font-medium">{order.serverStaff?.firstName} {order.serverStaff?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Drawer:</span>
                <span className="font-medium">{order.sessionOwnerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="font-medium">{payment?.method || 'NONE'}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4 pb-4 border-b border-dashed border-slate-300">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-4">{Number(item.quantity)}</span>
                    <span className="text-slate-800">{item.productName}</span>
                  </div>
                  <span className="text-slate-900 font-medium">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 mb-6 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-slate-900 pt-2 mt-2 border-t border-slate-200">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* Verification QR */}
            {order.status === 'PAID' && order.verificationToken && (
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-200 mt-6">
                <div className="bg-white p-2 rounded shadow-sm border border-slate-100 mb-2">
                  <QRCodeSVG 
                    value={`https://lodgecore.com/verify/${order.verificationToken}`} 
                    size={100}
                    level="H"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Cryptographically Verified
                </div>
                <span className="text-[10px] text-slate-400 mt-1 text-center font-mono">
                  {order.verificationToken}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 flex gap-3 sticky bottom-0 z-10">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button 
            className="flex-1 bg-slate-900 hover:bg-slate-800" 
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
               <Printer className="w-4 h-4 mr-2" />
            )}
            Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
