'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Coffee, Loader2, Printer, RefreshCw, Search, Utensils, Wifi, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { generateUUID } from '@/lib/utils';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';

type BreakfastRow = { reservationId: string; roomNumber: string; guestName: string; maxCoversAllowed: number; coversRedeemed: number; remainingCovers: number };

function safe(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export default function BreakfastServicePage() {
  const router = useRouter();
  const { provider, isDesktopMode, isOnline } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [outletType, setOutletType] = useState('');
  const [operatorName, setOperatorName] = useState('Operator');
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let contextOutletId = '';
      const entitlement = await provider.pos.getBreakfastEntitlements();
      if (entitlement?.error) throw new Error(entitlement.error);
      const entitlementData = entitlement?.data || null;
      setData(entitlementData);
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('lodgecore_pos_operator_token') : null;
      const storedSession = typeof window !== 'undefined' ? localStorage.getItem('lodgecore_pos_session_id') : null;
      setToken(storedToken);
      setSessionId(storedSession || '');
      if (storedSession) {
        const context = await provider.pos.getSessionContext(storedSession);
        const contextData = context?.data || context;
        contextOutletId = contextData?.outletId || contextData?.OutletId || '';
        setOutletId(contextOutletId);
        setOutletType(String(contextData?.posType || contextData?.terminalType || contextData?.outletType || contextData?.type || '').toUpperCase());
      }
      if (storedSession) {
        const operator = await provider.pos.getCurrentOperator(storedSession, storedToken);
        const current = operator?.data || operator;
        if (current) setOperatorName(`${current.firstName || ''} ${current.lastName || ''}`.trim() || current.name || 'Operator');
      }
      const productResult = await provider.pos.getProducts(propertyId || entitlementData?.propertyId || '', contextOutletId || undefined);
      setProducts(Array.isArray(productResult?.data) ? productResult.data.filter((item: any) => item.isActive !== false) : []);
    } catch (error: any) {
      toast.error(error?.message || 'Could not load breakfast service');
    } finally { setLoading(false); }
  }, [propertyId, provider.pos]);

  useEffect(() => { void load(); }, [load]);

  const menuItems = useMemo(() => {
    const breakfast = products.filter((item) => {
      const text = `${item.name || ''} ${item.category?.name || item.categoryName || ''}`.toLowerCase();
      return text.includes('breakfast') || text.includes('food');
    });
    return breakfast.length ? breakfast : products;
  }, [products]);

  const rows: BreakfastRow[] = Array.isArray(data?.rows) ? data.rows : [];
  const visibleRows = rows.filter((row) => `${row.guestName} ${row.roomNumber}`.toLowerCase().includes(search.toLowerCase()));
  const selectedItem = menuItems.find((item) => item.id === selectedMenuItem);
  const restaurantOnlyBlocked = outletType && outletType !== 'RESTAURANT_POS' && outletType !== 'RESTAURANT';

  const printReceipt = async (row: BreakfastRow, covers: number, itemName: string) => {
    if (isDesktopMode && HardwareBridge.isAvailable()) {
      const result = await HardwareBridge.printReceipt({
        orderNumber: `BR-${row.reservationId.slice(0, 8).toUpperCase()}`,
        tableNumber: row.roomNumber,
        items: [{ name: itemName, quantity: covers, unitPrice: 0, total: 0 }],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        paymentMethod: 'COMPLIMENTARY BREAKFAST',
        currency: 'NGN',
        serverName: operatorName,
        outletName: 'Breakfast Service',
        propertyName: data?.propertyName,
        printedAt: new Date().toISOString(),
      });
      if (result?.error) throw new Error(result.error);
      return;
    }
    const printWindow = window.open('', '_blank', 'width=480,height=640');
    if (!printWindow) { toast.error('Allow pop-ups to print the redemption receipt.'); return; }
    printWindow.document.write(`<!doctype html><html><head><title>Breakfast Redemption</title><style>body{font:14px Arial;color:#172033;padding:24px}h1{font-size:20px;margin:0 0 4px}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #cbd5e1;margin:18px 0}.row{display:flex;justify-content:space-between;margin:10px 0}.strong{font-weight:700}</style></head><body><h1>${safe(data?.propertyName || 'LodgeCore')}</h1><div class="muted">COMPLIMENTARY BREAKFAST REDEMPTION</div><div class="line"></div><div class="row"><span>Guest</span><b>${safe(row.guestName)}</b></div><div class="row"><span>Room</span><b>${safe(row.roomNumber)}</b></div><div class="row"><span>Menu item</span><b>${safe(itemName)}</b></div><div class="row"><span>Covers</span><b>${covers}</b></div><div class="row"><span>Business date</span><b>${safe(data?.businessDate)}</b></div><div class="line"></div><div class="muted">Redeemed by ${safe(operatorName)} · ${safe(new Date().toLocaleString())}</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  const redeem = async (row: BreakfastRow) => {
    if (!selectedItem) { toast.error('Select the breakfast item being served today first.'); return; }
    setRedeeming(row.reservationId);
    try {
      const result = await provider.pos.redeemBreakfast({ reservationId: row.reservationId, roomNumber: row.roomNumber, coversRedeemed: row.remainingCovers, menuItemId: selectedItem.id, menuItemName: selectedItem.name, operationId: `breakfast_${row.reservationId}_${data?.businessDate}_${generateUUID()}`, operatorToken: token });
      if (result?.error) throw new Error(result.error);
      toast.success(`${row.guestName} redeemed ${row.remainingCovers} breakfast cover${row.remainingCovers === 1 ? '' : 's'}.`);
      await printReceipt(row, row.remainingCovers, selectedItem.name);
      await load();
    } catch (error: any) { toast.error(error?.message || 'Breakfast redemption failed'); }
    finally { setRedeeming(null); }
  };

  const printList = async () => {
    if (printing || !rows.length) return;
    setPrinting(true);
    try {
      if (isDesktopMode && HardwareBridge.isAvailable()) {
        const result = await provider.pos.printBreakfastEntitlements({ ...data, rows, operatorName });
        if (result?.error) throw new Error(result.error);
        toast.success('Breakfast service list sent to the POS printer.');
      } else {
        const printWindow = window.open('', '_blank', 'width=960,height=720');
        if (!printWindow) throw new Error('Allow pop-ups to print the breakfast list.');
        printWindow.document.write(`<html><head><title>Breakfast Service List</title><style>body{font:13px Arial;color:#172033;padding:28px}h1{margin:0}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{padding:10px;border-bottom:1px solid #cbd5e1;text-align:left}th{background:#f1f5f9}</style></head><body><h1>${safe(data?.propertyName || 'LodgeCore')}</h1><p class="muted">Breakfast Service List · ${safe(data?.businessDate)} · Night Audit source ${safe(data?.auditedBusinessDate)}</p><table><tr><th>Room</th><th>Guest</th><th>Covers remaining</th></tr>${rows.map((row) => `<tr><td>${safe(row.roomNumber)}</td><td>${safe(row.guestName)}</td><td>${row.remainingCovers}</td></tr>`).join('')}</table><p class="muted">Printed by ${safe(operatorName)} · ${safe(new Date().toLocaleString())}</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
        printWindow.document.close();
      }
    } catch (error: any) { toast.error(error?.message || 'Could not print the service list'); }
    finally { setPrinting(false); }
  };

  if (restaurantOnlyBlocked) return <div className="flex min-h-full items-center justify-center bg-[#f6f8fc] p-6"><section className="max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl"><Coffee className="mx-auto h-10 w-10 text-amber-500" /><h1 className="mt-4 text-xl font-black">Restaurant POS only</h1><p className="mt-2 text-sm leading-6 text-slate-500">Breakfast Service is available from an active Restaurant POS outlet. Pool and other terminals cannot redeem breakfast entitlements.</p><button onClick={() => router.push('/pos')} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black text-white">Return to POS</button></section></div>;

  return <div className="min-h-full overflow-y-auto bg-[#f6f8fc] text-slate-900">
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div className="flex items-center gap-3"><button onClick={() => router.push('/pos')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-500">Restaurant POS · Service Control</p><h1 className="text-xl font-black tracking-tight">Breakfast Service</h1></div></div><div className="flex items-center gap-2 text-xs font-bold text-slate-500">{isOnline ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-amber-500" />} {isOnline ? 'Live' : 'Offline'}<button onClick={() => void load()} className="ml-2 rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div>
    </header>
    <main className="mx-auto max-w-7xl space-y-5 p-5 md:p-8"><section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300"><Coffee className="h-3.5 w-3.5" /> Complimentary breakfast</div><h2 className="text-3xl font-black tracking-tight">Serve today’s eligible guests</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Use the completed Night Audit entitlement list. Each redemption is recorded once, synchronized safely, and printed as a service receipt.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Business date</p><p className="mt-1 text-lg font-black">{data?.businessDate || '—'}</p><p className="mt-1 text-xs text-slate-500">{rows.length} eligible guests · {rows.reduce((sum, row) => sum + row.remainingCovers, 0)} covers remaining</p></div></div></section>
      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1.4fr] md:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-500">Service menu</p><h3 className="mt-1 text-lg font-black">What is being served today?</h3><p className="mt-1 text-xs leading-5 text-slate-500">Select once before redeeming guests. This is printed and stored with every redemption.</p></div><select value={selectedMenuItem} onChange={(event) => setSelectedMenuItem(event.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"><option value="">Select breakfast menu item…</option>{menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>
      {!data?.available && <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><p className="font-black text-amber-900">Breakfast list is not available</p><p className="mt-1 text-sm text-amber-800">{data?.reason || 'Complete Night Audit before starting breakfast service.'}</p></section>}
      {data?.available && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between"><div><h3 className="text-lg font-black">Eligible guest register</h3><p className="text-xs text-slate-500">Redeem all remaining covers for the selected guest in one controlled action.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guest or room" className="h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></div><button onClick={() => void printList()} disabled={printing || !rows.length} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40"><Printer className="h-4 w-4" />Print list</button></div></div><div className="divide-y divide-slate-100">{loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading audited guest list…</div> : visibleRows.length ? visibleRows.map((row) => <div key={row.reservationId} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">{row.roomNumber}</div><div><p className="font-black text-slate-800">{row.guestName}</p><p className="mt-1 text-xs text-slate-500">Room {row.roomNumber} · {row.coversRedeemed} redeemed · {row.remainingCovers} remaining</p></div></div><button onClick={() => void redeem(row)} disabled={!!redeeming || !selectedItem} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{redeeming === row.reservationId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Redeem {row.remainingCovers} cover{row.remainingCovers === 1 ? '' : 's'}</button></div>) : <div className="p-12 text-center text-sm text-slate-500"><Utensils className="mx-auto mb-3 h-8 w-8 text-slate-300" />No eligible covers remain for this business date.</div>}</div></section>}
    </main>
  </div>;
}
