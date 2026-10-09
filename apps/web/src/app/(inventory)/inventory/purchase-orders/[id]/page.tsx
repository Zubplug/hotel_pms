import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, Boxes, Building2, CalendarDays, Check,
  ClipboardCheck, Clock3, FileText, PackageCheck, ShieldCheck,
  Truck, WalletCards,
} from 'lucide-react';
import { POActionBar } from './ActionBar';
import { POItemsEditor } from './POItemsEditor';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

const STATUS_META: Record<string, { label: string; className: string; dot: string }> = {
  DRAFT: { label: 'Draft', className: 'border-white/10 bg-white/[.05] text-slate-300', dot: 'bg-slate-400' },
  SUBMITTED: { label: 'Awaiting approval', className: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200', dot: 'bg-cyan-300' },
  APPROVED: { label: 'Approved', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200', dot: 'bg-emerald-300' },
  PARTIALLY_RECEIVED: { label: 'Partially received', className: 'border-amber-400/25 bg-amber-400/10 text-amber-200', dot: 'bg-amber-300' },
  RECEIVED: { label: 'Fully received', className: 'border-violet-400/25 bg-violet-400/10 text-violet-200', dot: 'bg-violet-300' },
  REJECTED: { label: 'Rejected', className: 'border-rose-400/25 bg-rose-400/10 text-rose-200', dot: 'bg-rose-300' },
  CANCELLED: { label: 'Cancelled', className: 'border-white/10 bg-white/[.05] text-slate-400', dot: 'bg-slate-500' },
};

const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.propertyId) return <div className="p-8 text-slate-400">No property selected</div>;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: true,
      grns: { select: { id: true, grnNumber: true, status: true, receivedDate: true, items: true } },
      property: { select: { baseCurrency: true } },
    },
  }) as any;
  if (!po || po.propertyId !== session.user.propertyId) notFound();

  const stockItems = await prisma.stockItem.findMany({
    where: { id: { in: po.items.map((item: any) => item.stockItemId).filter(Boolean) } },
    select: { id: true, name: true, stockType: true, baseUnit: true },
  });
  const stockItemById = new Map(stockItems.map((item) => [item.id, item]));
  const userRole = String((session.user as any)?.role || '');
  const isSuperAdmin = Boolean((session.user as any)?.isSuperAdmin);
  const normalizedRole = userRole.toUpperCase();
  const canApprove = hasInventoryPermission(userRole, 'procurement.po.approve', isSuperAdmin) && (isSuperAdmin || (po.approvalStage === 'ACCOUNTANT' && normalizedRole === 'ACCOUNTANT') || (po.approvalStage === 'GENERAL_MANAGER' && normalizedRole === 'GENERAL_MANAGER'));
  const canAdjust = po.status === 'SUBMITTED' && hasInventoryPermission(userRole, 'procurement.po.adjust', isSuperAdmin);
  const currency = po.property?.baseCurrency || 'NGN';
  const orderedQty = po.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  const receivedQty = po.items.reduce((sum: number, item: any) => sum + Number(item.receivedQty || 0), 0);
  const receiptProgress = orderedQty ? Math.min(receivedQty / orderedQty * 100, 100) : 0;
  const status = STATUS_META[po.status] || STATUS_META.DRAFT;
  const editorItems = po.items.map((item: any) => ({
    id: item.id, description: item.description || '', quantity: Number(item.quantity), unitOfMeasure: item.unitOfMeasure,
    unitPrice: Number(item.unitPrice || 0), totalPrice: Number(item.totalPrice || 0), receivedQty: Number(item.receivedQty || 0),
    stockItemName: stockItemById.get(item.stockItemId)?.name || item.description || 'Unknown item',
    stockType: stockItemById.get(item.stockItemId)?.stockType || 'CONSUMABLE', conversionToBase: Number(item.conversionToBase || 1),
    stockBaseUnit: stockItemById.get(item.stockItemId)?.baseUnit || item.unitOfMeasure,
  }));

  return (
    <div className="min-h-full bg-[#07111f] text-slate-100">
      <header className="border-b border-white/[.07] bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,.16),_transparent_35%),linear-gradient(135deg,#0b1728,#07111f)] px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1380px]">
          <Link href="/inventory/purchase-orders" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-emerald-300"><ArrowLeft className="h-3.5 w-3.5" /> Back to purchase orders</Link>
          <div className="mt-7 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Procurement record</span><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</span></div>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-white sm:text-4xl">{po.poNumber}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400"><span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-500" />{po.supplier?.name || 'Supplier not assigned'}</span><span className="text-slate-700">•</span><span>Created {dateLabel(po.createdAt)}</span></div>
            </div>
            <POActionBar id={po.id} status={po.status} approvalStage={po.approvalStage} canApprove={canApprove} />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <HeaderFact icon={CalendarDays} label="Expected delivery" value={dateLabel(po.expectedDate)} />
            <HeaderFact icon={WalletCards} label="Committed value" value={money(po.totalAmount, currency)} />
            <HeaderFact icon={Boxes} label="Line items" value={`${po.items.length} item${po.items.length === 1 ? '' : 's'} · ${po.grns.length} GRN${po.grns.length === 1 ? '' : 's'}`} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        <section className="grid gap-4 md:grid-cols-3">
          <Metric icon={ClipboardCheck} label="Approval stage" value={po.status === 'SUBMITTED' ? (po.approvalStage === 'ACCOUNTANT' ? 'Accountant review' : 'General Manager review') : status.label} tone="cyan" />
          <Metric icon={PackageCheck} label="Receipt progress" value={`${Math.round(receiptProgress)}%`} detail={`${receivedQty.toLocaleString()} of ${orderedQty.toLocaleString()} units received`} tone="emerald" progress={receiptProgress} />
          <Metric icon={Truck} label="Receiving records" value={String(po.grns.length)} detail={po.grns.length ? 'Goods received notes linked' : 'No receiving record yet'} tone="violet" />
        </section>

        <section className="rounded-2xl border border-white/[.08] bg-[#111c2e] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-white">Order lifecycle</p><p className="mt-1 text-xs text-slate-500">Track this commitment from request through receiving.</p></div><span className="text-xs text-slate-500">Current state: <strong className="text-slate-300">{status.label}</strong></span></div>
          <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">{['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED'].map((step, index) => { const complete = ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(po.status) ? index < 3 || po.status === 'RECEIVED' : step === po.status || (step === 'DRAFT' && po.status !== 'REJECTED'); const active = step === po.status || (step === 'RECEIVED' && po.status === 'PARTIALLY_RECEIVED'); return <div key={step} className="relative text-center">{index < 3 && <div className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-3 h-px ${complete ? 'bg-emerald-400/60' : 'bg-white/10'}`} />}<div className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${complete ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : active ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-white/[.04] text-slate-600'}`}>{complete ? <Check className="h-3 w-3" /> : index + 1}</div><p className={`mt-2 text-[10px] font-semibold uppercase tracking-[.1em] sm:text-xs ${active || complete ? 'text-slate-300' : 'text-slate-600'}`}>{step === 'SUBMITTED' ? 'Submitted' : step.charAt(0) + step.slice(1).toLowerCase()}</p></div>; })}</div>
        </section>

        <POItemsEditor poId={po.id} items={editorItems} editable={canAdjust} currency={currency} />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/[.08] bg-[#111c2e] p-5 sm:p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><ShieldCheck className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold text-white">Order context</h2><p className="mt-1 text-xs text-slate-500">Supplier and internal information attached to this request.</p></div></div><dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2"><Context label="Supplier" value={po.supplier?.name || 'Not assigned'} /><Context label="Approval route" value={po.approvalStage ? String(po.approvalStage).replaceAll('_', ' ') : 'Standard review'} /><Context label="Currency" value={currency} /><Context label="Created" value={dateLabel(po.createdAt)} /></dl>{po.notes && <div className="mt-6 border-t border-white/[.07] pt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Notes</p><p className="mt-2 text-sm leading-6 text-slate-300">{po.notes}</p></div>}</section>
          <section className="rounded-2xl border border-white/[.08] bg-[#111c2e] p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Receiving history</h2><p className="mt-1 text-xs text-slate-500">Goods received against this order.</p></div><Truck className="h-4 w-4 text-slate-500" /></div>{po.grns.length ? <div className="mt-5 space-y-3">{po.grns.map((grn: any) => <Link key={grn.id} href={`/inventory/grns/${grn.id}`} className="group flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-3 transition hover:border-cyan-400/25 hover:bg-cyan-400/[.04]"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300"><FileText className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{grn.grnNumber}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(grn.receivedDate)} · {grn.items?.length || 0} lines</p></div></div><ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-300" /></Link>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center"><Clock3 className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-400">Nothing received yet</p><p className="mt-1 text-xs leading-5 text-slate-600">A GRN will appear here once the supplier delivery is recorded.</p></div>}</section>
        </div>
      </main>
    </div>
  );
}

function HeaderFact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.035] px-4 py-3"><Icon className="h-4 w-4 shrink-0 text-emerald-300" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-200">{value}</p></div></div>; }
function Metric({ icon: Icon, label, value, detail, tone, progress }: { icon: typeof ClipboardCheck; label: string; value: string; detail?: string; tone: 'cyan' | 'emerald' | 'violet'; progress?: number }) { const color = tone === 'emerald' ? 'text-emerald-300 bg-emerald-400/10' : tone === 'violet' ? 'text-violet-300 bg-violet-400/10' : 'text-cyan-300 bg-cyan-400/10'; return <div className="rounded-2xl border border-white/[.08] bg-[#111c2e] p-5"><div className="flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</p><span className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></span></div><p className="mt-5 text-xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail || 'Controlled workflow state'}</p>{progress !== undefined && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>}</div>; }
function Context({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</dt><dd className="mt-1.5 truncate text-sm font-medium capitalize text-slate-200">{value}</dd></div>; }
