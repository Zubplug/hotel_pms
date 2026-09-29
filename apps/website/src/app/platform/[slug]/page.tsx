import type { Metadata } from "next";
import Link from "next/link";

const copy: Record<string, { title: string; description: string }> = {
  pms: { title: "Hotel PMS", description: "A complete property management workspace for reservations, front desk, guests, rooms and the daily rhythm of your hotel." },
  "front-desk": { title: "Front Desk", description: "Move guests from arrival to departure with a fast, clear front desk experience that works even when the internet does not." },
  pos: { title: "Hotel POS", description: "Connect outlets, menus, payments and room charges to the guest folio without duplicating work." },
  "f-and-b": { title: "Restaurant & F&B", description: "Give every outlet the tools to serve faster, control costs and report accurately." },
  "booking-engine": { title: "Booking Engine", description: "Turn direct demand into profitable reservations with a branded booking experience." },
  "channel-manager": { title: "Channel Manager", description: "Keep availability, rates and reservations aligned across OTAs and direct channels." },
  housekeeping: { title: "Housekeeping", description: "Make room readiness visible to every team with tasks, status and accountability." },
  accounting: { title: "Accounting & Finance", description: "Bring revenue, cash, payables and operational control into one financial picture." },
  "night-audit": { title: "Night Audit", description: "Close the business day with confidence, exception visibility and a complete audit trail." },
  events: { title: "Events & Banqueting", description: "Manage venues, packages, bookings, BEOs and event finance from first enquiry to closeout." },
  inventory: { title: "Inventory & Procurement", description: "Control stock, purchasing, recipes, waste and supplier accountability across the operation." },
  analytics: { title: "Reports & Analytics", description: "Turn live hotel operations into decisions your team can act on." },
  "offline-operations": { title: "Offline Operations", description: "Keep front desk and POS moving during outages, then synchronize securely when connectivity returns." },
  mobile: { title: "Mobile Staff Operations", description: "Put the right operational context in the hands of managers and staff wherever they work." },
  "multi-property": { title: "Multi-Property Management", description: "Standardize control while giving every property the autonomy to operate well." },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = copy[(await params).slug] || { title: "Hotel technology", description: "Connected hotel operations with LodgeCore." };
  return { title: page.title, description: page.description };
}

export default async function PlatformPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = copy[(await params).slug] || { title: "Hotel technology", description: "Connected hotel operations with LodgeCore." };
  return <main className="min-h-screen bg-[#07111f]"><header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><Link href="/" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><Link href="/book-demo" className="rounded-full bg-sky-300 px-4 py-2 text-sm font-bold text-[#07111f]">Book a demo</Link></header><section className="mx-auto max-w-5xl px-6 pb-24 pt-20"><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">LodgeCore platform</p><h1 className="mt-5 text-6xl font-bold tracking-[-.05em] text-white">{page.title}</h1><p className="mt-6 max-w-2xl text-xl leading-8 text-slate-400">{page.description}</p><div className="mt-12 grid gap-4 md:grid-cols-3">{["Designed for hotel teams", "Connected to your control plane", "Supported through go-live"].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/[.04] p-6 text-sm text-slate-300">✓ {item}</div>)}</div><Link href="/book-demo" className="mt-12 inline-block rounded-full bg-sky-300 px-6 py-3 text-sm font-bold text-[#07111f]">See it in action →</Link></section></main>;
}
