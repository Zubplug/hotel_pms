'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Shirt, CheckCircle2, Clock, Truck, CreditCard, Banknote, Receipt, AlertTriangle, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ManageLaundryOrderPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const router = useRouter();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deliveryConfirmationOpen, setDeliveryConfirmationOpen] = useState(false);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState({
    open: false,
    title: '',
    description: ''
  });

  const amountValue = (value: unknown) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  };

  const itemUnitPrice = (item: any) => amountValue(
    item.priceAtTime ?? item.unitPrice ?? item.UnitPrice ?? item.price ?? 0
  );

  const displayItems = (items: any[] = []) => Object.values(items.reduce((groups: Record<string, any>, item: any) => {
    const key = String(item.itemId || item.item?.id || item.item?.name || item.id);
    const existing = groups[key];
    if (existing) {
      existing.quantity += Number(item.quantity || 0);
      existing.totalPrice += amountValue(item.totalPrice ?? item.total ?? 0);
    } else {
      groups[key] = { ...item, quantity: Number(item.quantity || 0), totalPrice: amountValue(item.totalPrice ?? item.total ?? 0) };
    }
    return groups;
  }, {}));

  const fetchOrder = async () => {
    if (!propertyId) return;
    setLoading(true);
    // Fetch all and filter, since we don't have a single-order endpoint in the provider interface yet
    const res = await provider.laundry.getOrders(propertyId);
    if (res.data) {
      const found = res.data.find((o: any) => o.id === orderId);
      setOrder(found || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrder();
  }, [propertyId, orderId]);

  const handleUpdateStatus = async (status: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await provider.laundry.updateOrderStatus(order.id, status);
      if (!res.error) {
        await fetchOrder();
        setSuccessDialog({
          open: true,
          title: 'Status updated',
          description: `The laundry order is now ${status.toLowerCase()}.`
        });
      } else {
        alert(res.error || 'Failed to update status');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = async () => {
    if (!order || !provider.hardware.printLaundryDocuments) return;
    const result = await provider.hardware.printLaundryDocuments({
      orderNumber: String(order.id).slice(0, 8).toUpperCase(),
      guestName: `${order.reservation?.primaryGuest?.firstName || order.guest?.firstName || ''} ${order.reservation?.primaryGuest?.lastName || order.guest?.lastName || ''}`.trim(),
      roomNumber: order.room?.number || null,
      serviceType: order.serviceType,
      items: displayItems(order.items).map((item: any) => ({ name: item.item?.name || item.itemName || 'Laundry item', quantity: item.quantity })),
      total: amountValue(order.totalAmount),
      currency: order.currency || 'NGN',
      requestedAt: order.requestedAt || order.createdAt,
      isReprint: true,
    });
    if (result?.error) alert(result.error);
  };

  const handleDeliver = async () => {
    if (!order) return;
    setDeliveryConfirmationOpen(false);
    setUpdating(true);
    try {
      const res = await provider.laundry.deliverOrder(order.id);
      if (!res.error) {
        await fetchOrder();
        setSuccessDialog({
          open: true,
          title: 'Order delivered',
          description: 'The laundry order was delivered and the folio was charged successfully.'
        });
      } else {
        alert(res.error || 'Failed to deliver order');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleSettlePayment = async () => {
    if (!order?.folioItem?.folio) return;
    const folio = order.folioItem.folio;
    
    if (amountValue(folio.balance) <= 0) return alert('Folio is already fully paid.');
    
    setProcessingPayment(true);
    try {
      const res = await fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: folio.id,
          amount: amountValue(folio.balance),
          currency: folio.currency,
          method: paymentMethod,
          idempotencyKey: `laundry_pay_${order.id}_${Date.now()}`,
          notes: 'Walk-in laundry payment settled via frontdesk'
        })
      });
      
      const data = await res.json();
      if (res.ok || res.status === 201 || res.status === 200) {
        setPaymentConfirmationOpen(false);
        await fetchOrder();
        setSuccessDialog({
          open: true,
          title: 'Payment recorded',
          description: 'The payment was recorded successfully and the folio has been updated.'
        });
      } else {
        alert(data.error || 'Failed to process payment');
      }
    } catch (e: any) {
      alert('Network error while processing payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (!propertyId) return <div className="p-8 text-center text-slate-500">Select property</div>;
  
  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>;
  if (!order) return <div className="p-20 text-center text-slate-500">Order not found</div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div>
            <Button onClick={() => router.push('/laundry')} variant="ghost" size="sm" className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 h-8 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shirt className="w-8 h-8 text-cyan-600" /> Manage Order
            </h1>
          </div>
          <div className="text-right">
            {provider.hardware.printLaundryDocuments && (
              <Button onClick={handlePrint} variant="outline" size="sm" className="mb-2 rounded-xl">
                <Printer className="w-4 h-4 mr-2" /> Print ticket
              </Button>
            )}
            <p className="text-sm font-bold text-slate-500">Total</p>
            <p className="text-2xl font-black text-cyan-700">{formatCurrency(amountValue(order.totalAmount), order.currency)}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 space-y-8">
          <div className="flex justify-between items-center pb-6 border-b border-slate-100">
             <div>
               <p className="text-sm font-bold text-slate-500">Status</p>
               <p className="text-2xl font-black text-slate-800">{order.status}</p>
             </div>
             <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <Button onClick={() => handleUpdateStatus('COLLECTED')} disabled={updating} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                     {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Clock className="w-4 h-4 mr-2"/>} Collect
                  </Button>
                )}
                {order.status === 'COLLECTED' && (
                  <Button onClick={() => handleUpdateStatus('WASHING')} disabled={updating} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                     {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Shirt className="w-4 h-4 mr-2"/>} Start Washing
                  </Button>
                )}
                {order.status === 'WASHING' && (
                  <Button onClick={() => handleUpdateStatus('READY')} disabled={updating} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                     {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle2 className="w-4 h-4 mr-2"/>} Mark Ready
                  </Button>
                )}
                {order.status === 'READY' && (
                  <Button onClick={() => setDeliveryConfirmationOpen(true)} disabled={updating} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-8 h-12 text-lg font-bold shadow-lg shadow-cyan-600/20">
                     {updating ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <Truck className="w-5 h-5 mr-2"/>} Deliver & Charge
                  </Button>
                )}
             </div>
          </div>

           <div>
             <h2 className="text-lg font-bold mb-4">Items</h2>
             <div className="space-y-3">
               {displayItems(order.items).map((item: any) => (
                 <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-800">{item.quantity}x {item.item?.name || item.itemName || 'Unnamed laundry item'}</span>
                    <span className="font-semibold text-slate-600">{formatCurrency(itemUnitPrice(item), order.currency)}</span>
                 </div>
               ))}
             </div>
          </div>

          {order.customerType === 'WALK_IN' && order.status === 'DELIVERED' && order.folioItem?.folio && (
            <div className="mt-8 p-6 bg-cyan-50/50 rounded-2xl border border-cyan-100">
              <h2 className="text-lg font-bold text-cyan-900 mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5" /> Walk-In Folio Settlement
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Charges</p>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(amountValue(order.folioItem.folio.totalCharges), order.folioItem.folio.currency)}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid</p>
                  <p className="text-xl font-black text-emerald-600">{formatCurrency(amountValue(order.folioItem.folio.totalPayments), order.folioItem.folio.currency)}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm border border-cyan-200 ring-2 ring-cyan-100 col-span-2">
                  <p className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Balance Due</p>
                  <p className="text-2xl font-black text-cyan-700">{formatCurrency(amountValue(order.folioItem.folio.balance), order.folioItem.folio.currency)}</p>
                </div>
              </div>

              {amountValue(order.folioItem.folio.balance) > 0 ? (
                <div className="flex items-end gap-4 p-4 bg-white rounded-xl border border-slate-200">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-bold text-slate-700">Payment Method</label>
                    <select 
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-lg px-3 font-medium outline-none focus:ring-2 focus:ring-cyan-500"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="POS">POS / Card Terminal</option>
                      <option value="CARD">Online Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                  <Button 
                    onClick={() => setPaymentConfirmationOpen(true)}
                    disabled={processingPayment} 
                    className="h-12 px-8 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shadow-md"
                  >
                    {processingPayment ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Banknote className="w-5 h-5 mr-2" />}
                    Record Payment
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center font-bold">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" /> Folio Fully Settled
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={deliveryConfirmationOpen} onOpenChange={setDeliveryConfirmationOpen}>
        <DialogContent className="overflow-hidden rounded-3xl border-0 p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-br from-cyan-700 via-cyan-600 to-blue-700 px-6 py-7 text-white">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Truck className="h-6 w-6" /></div>
              <div><DialogTitle className="text-xl font-black text-white">Confirm laundry delivery</DialogTitle><DialogDescription className="mt-1 text-cyan-100">The order will be marked delivered and posted to the guest folio.</DialogDescription></div>
            </div>
          </div>
          <div className="space-y-5 p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Order summary</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">READY</span></div>
              <div className="space-y-2">{displayItems(order.items).map((item: any) => <div key={String(item.itemId || item.id)} className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.quantity}× {item.item?.name || item.itemName || 'Laundry item'}</span><span className="font-semibold tabular-nums text-slate-900">{formatCurrency(item.totalPrice || itemUnitPrice(item) * item.quantity, order.currency)}</span></div>)}</div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3"><span className="font-bold text-slate-700">Charge to folio</span><span className="text-xl font-black tabular-nums text-cyan-700">{formatCurrency(amountValue(order.totalAmount), order.currency)}</span></div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><p>This action records the delivery and creates the laundry charge. Confirm that the items have been handed to the guest.</p></div>
          </div>
          <DialogFooter className="border-t bg-white px-6 py-4 sm:justify-end"><Button variant="outline" onClick={() => setDeliveryConfirmationOpen(false)} disabled={updating}>Cancel</Button><Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={handleDeliver} disabled={updating}>{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}Confirm delivery & charge</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentConfirmationOpen} onOpenChange={setPaymentConfirmationOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm payment</DialogTitle>
            <DialogDescription>
              Confirm that you received the laundry payment before recording it on the folio.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Payment method</span>
              <span className="font-bold text-slate-900">{paymentMethod.replace('_', ' ')}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-cyan-100 pt-3">
              <span className="font-semibold text-slate-700">Amount to record</span>
              <span className="text-xl font-black text-cyan-700">
                {formatCurrency(amountValue(order.folioItem?.folio?.balance), order.folioItem?.folio?.currency || order.currency)}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setPaymentConfirmationOpen(false)} disabled={processingPayment}>
              Cancel
            </Button>
            <Button
              className="bg-cyan-600 text-white hover:bg-cyan-700"
              onClick={async () => {
                await handleSettlePayment();
              }}
              disabled={processingPayment}
            >
              {processingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={successDialog.open}
        onOpenChange={open => setSuccessDialog(current => ({ ...current, open }))}
      >
        <DialogContent className="sm:max-w-md rounded-2xl text-center">
          <DialogHeader className="items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl">{successDialog.title}</DialogTitle>
            <DialogDescription>{successDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              className="min-w-28 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setSuccessDialog(current => ({ ...current, open: false }))}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
