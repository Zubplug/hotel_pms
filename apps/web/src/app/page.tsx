import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BedDouble,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  Hotel,
  KeyRound,
  Layers3,
  Menu,
  Moon,
  Network,
  ShieldCheck,
  Sparkles,
  Utensils,
  WifiOff,
} from "lucide-react";

const platform = [
  { icon: BedDouble, title: "Property management", copy: "Reservations, front desk, guest profiles and room operations in one calm workspace." },
  { icon: Utensils, title: "POS & F&B", copy: "Connect restaurants, bars, kitchens and room charges to the same guest folio." },
  { icon: Network, title: "Booking & channels", copy: "Sell direct, keep OTAs in sync and protect availability across every channel." },
  { icon: BarChart3, title: "Finance & control", copy: "Accounting, night audit, cash control and reporting built for hotel operations." },
  { icon: Sparkles, title: "Housekeeping & maintenance", copy: "Turn room status, tasks and work orders into a live operating rhythm." },
  { icon: KeyRound, title: "E-locks & hardware", copy: "Deploy smart access, encoders, terminals and on-site support with one partner." },
];

const plans = [
  { name: "Starter", description: "The essentials for a focused property.", features: ["PMS & reservations", "Front desk operations", "Guest profiles", "Basic reporting"] },
  { name: "Professional", description: "A connected system for growing hotels.", features: ["Everything in Starter", "POS & housekeeping", "Accounting & inventory", "Booking engine & channels"], featured: true },
  { name: "Enterprise", description: "Control for groups and complex operations.", features: ["Everything in Professional", "Multi-property management", "API & custom integrations", "Dedicated implementation"] },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="LodgeCore home">
      <Image src="/lodgecore-logo.png" alt="" width={34} height={34} className="rounded-lg" />
      <span className="text-[17px] font-semibold tracking-[-0.03em] text-white">Lodge<span className="text-sky-300">Core</span></span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-slate-200">
      <div className="absolute inset-x-0 top-0 -z-0 h-[720px] bg-[radial-gradient(ellipse_at_50%_-20%,rgba(36,113,167,.28),transparent_64%)]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-400 lg:flex">
          <a href="#platform" className="transition hover:text-white">Platform</a>
          <a href="#solutions" className="transition hover:text-white">Solutions</a>
          <a href="#hardware" className="transition hover:text-white">Hardware</a>
          <a href="#integrations" className="transition hover:text-white">Integrations</a>
          <a href="#pricing" className="transition hover:text-white">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:block">Log in</Link>
          <a href="#demo" className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#081525] transition hover:bg-sky-100">Book a demo</a>
          <Menu className="ml-1 h-5 w-5 text-slate-400 lg:hidden" />
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-20 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:pb-32 lg:pt-28">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/[.07] px-3 py-1.5 text-xs font-medium text-sky-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />The operating system for modern hotels</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.055em] text-white sm:text-6xl lg:text-[76px]">Every part of your hotel, <span className="text-sky-300">working together.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">LodgeCore connects rooms, restaurants, payments, people and performance in one intelligent hotel platform—so your team can run a better stay.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#demo" className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-[#061321] transition hover:bg-sky-300">Book a demo <ArrowRight className="h-4 w-4" /></a>
            <a href="#platform" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[.05]">Explore the platform <ChevronRight className="h-4 w-4 text-sky-300" /></a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" />Enterprise-ready</span><span className="flex items-center gap-2"><WifiOff className="h-4 w-4 text-sky-300" />Offline-first operations</span><span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-violet-300" />Built for every property</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:ml-auto">
          <div className="absolute -inset-8 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative rounded-3xl border border-white/10 bg-[#0c1a2c]/90 p-3 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-[#0a1525] p-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Today at</p><p className="mt-1 text-xl font-semibold text-white">LodgeCore / Overview</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />All systems live</div></div>
              <div className="grid grid-cols-3 gap-2.5"><div className="rounded-xl border border-white/8 bg-white/[.04] p-3"><p className="text-[10px] text-slate-500">Occupancy</p><p className="mt-2 text-xl font-semibold text-white">84.6%</p><p className="mt-1 text-[10px] text-emerald-300">↑ 8.2% this week</p></div><div className="rounded-xl border border-white/8 bg-white/[.04] p-3"><p className="text-[10px] text-slate-500">Today&apos;s revenue</p><p className="mt-2 text-xl font-semibold text-white">₦4.8m</p><p className="mt-1 text-[10px] text-sky-300">Across 3 properties</p></div><div className="rounded-xl border border-white/8 bg-white/[.04] p-3"><p className="text-[10px] text-slate-500">Rooms ready</p><p className="mt-2 text-xl font-semibold text-white">126 <span className="text-xs text-slate-500">/ 148</span></p><p className="mt-1 text-[10px] text-amber-300">22 in progress</p></div></div>
              <div className="mt-4 rounded-xl border border-white/8 bg-white/[.03] p-4"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold text-slate-300">Revenue performance</span><span className="text-[10px] text-slate-500">Last 7 days</span></div><div className="flex h-28 items-end gap-2">{[35,48,41,62,56,78,91,72,84,68,88,96,82,100].map((height, i) => <div key={i} className={`flex-1 rounded-t-sm ${i > 9 ? "bg-sky-300" : "bg-sky-300/25"}`} style={{ height: `${height}%` }} />)}</div></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] p-3"><div className="rounded-lg bg-violet-400/10 p-2 text-violet-300"><Moon className="h-4 w-4" /></div><div><p className="text-[10px] text-slate-500">Night audit</p><p className="text-xs font-medium text-white">Completed · 04:12</p></div></div><div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] p-3"><div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300"><CreditCard className="h-4 w-4" /></div><div><p className="text-[10px] text-slate-500">Payments</p><p className="text-xs font-medium text-white">All reconciled</p></div></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="relative border-y border-white/[.07] bg-[#091626] px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">One connected platform</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">The details that make a stay exceptional.</h2><p className="mt-5 text-base leading-7 text-slate-400">From the first reservation to the final reconciliation, LodgeCore gives every team the context and tools to do their best work.</p></div><div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{platform.map(({ icon: Icon, title, copy }) => <div key={title} className="group rounded-2xl border border-white/[.08] bg-white/[.025] p-6 transition hover:-translate-y-1 hover:border-sky-300/25 hover:bg-sky-300/[.04]"><div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-300/10 text-sky-300"><Icon className="h-5 w-5" /></div><h3 className="text-base font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p><span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 opacity-0 transition group-hover:opacity-100">Learn more <ArrowRight className="h-3.5 w-3.5" /></span></div>)}</div></div></section>

      <section id="hardware" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28"><div className="order-2 lg:order-1"><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#10253a] to-[#0b1524] p-5 shadow-2xl shadow-black/20"><div className="grid grid-cols-2 gap-3"><div className="col-span-2 rounded-2xl border border-white/10 bg-[#091525] p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-slate-500">Property network</p><p className="mt-2 text-lg font-semibold text-white">LodgeCore connected hardware</p></div><Layers3 className="h-5 w-5 text-sky-300" /></div><div className="mt-6 flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-emerald-400" /><div className="h-2 w-1/4 rounded-full bg-emerald-400/40" /><div className="h-2 w-1/6 rounded-full bg-sky-300/30" /></div><div className="mt-3 flex justify-between text-[10px] text-slate-500"><span>Front desk</span><span>POS terminals</span><span>E-locks</span></div></div><div className="rounded-2xl border border-white/10 bg-[#091525] p-4"><KeyRound className="h-5 w-5 text-violet-300" /><p className="mt-8 text-sm font-semibold text-white">148 doors</p><p className="mt-1 text-[10px] text-emerald-300">Access system healthy</p></div><div className="rounded-2xl border border-white/10 bg-[#091525] p-4"><WifiOff className="h-5 w-5 text-amber-300" /><p className="mt-8 text-sm font-semibold text-white">Offline ready</p><p className="mt-1 text-[10px] text-slate-500">Syncs when online</p></div></div></div></div><div className="order-1 lg:order-2"><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">Hardware, without the headache</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">Your technology partner from door to dashboard.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">Specify, install and manage your hotel hardware through the same platform. From RFID locks and encoders to POS terminals and payment devices, every deployment has a clear owner.</p><div className="mt-7 space-y-3 text-sm text-slate-300"><p className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400" />Dormakaba, Salto, Xeeder, Deluns and HsLock integrations</p><p className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400" />Installation, diagnostics, warranty and replacement</p><p className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400" />Hotel-wide rollout with training and go-live support</p></div><a href="#demo" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-300">Book an e-lock installation <ArrowRight className="h-4 w-4" /></a></div></section>

      <section id="solutions" className="bg-sky-300 px-5 py-16 text-[#07111f] lg:px-8 lg:py-20"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#236482]">Built around your operation</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Start with one property. Grow without changing systems.</h2></div><a href="#demo" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#07111f] px-5 py-3 text-sm font-semibold text-white">Talk to our team <ArrowRight className="h-4 w-4" /></a></div></section>

      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">Plans that follow your growth</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">The right operating depth for every stage.</h2></div><p className="max-w-xs text-sm leading-6 text-slate-500">Pricing, modules and limits are managed centrally in the LodgeCore control plane.</p></div><div className="mt-12 grid gap-4 lg:grid-cols-3">{plans.map((plan) => <div key={plan.name} className={`rounded-2xl border p-7 ${plan.featured ? "border-sky-300/50 bg-sky-300/[.08]" : "border-white/10 bg-white/[.025]"}`}><div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-white">{plan.name}</h3>{plan.featured && <span className="rounded-full bg-sky-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#07111f]">Most popular</span>}</div><p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">{plan.description}</p><ul className="mt-7 space-y-3 border-t border-white/10 pt-6">{plan.features.map((feature) => <li key={feature} className="flex items-center gap-3 text-sm text-slate-300"><Check className="h-4 w-4 text-emerald-400" />{feature}</li>)}</ul><a href="#demo" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-300">Explore {plan.name} <ArrowRight className="h-4 w-4" /></a></div>)}</div></section>

      <section id="integrations" className="border-y border-white/[.07] bg-[#091626] px-5 py-16 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-left"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">An open hotel ecosystem</p><h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Connect the tools your team already trusts.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Payments, OTAs, accounting, communications and hardware—LodgeCore brings the operational picture together.</p></div><div className="flex flex-wrap justify-center gap-2 lg:max-w-md lg:justify-end">{["Paystack", "Flutterwave", "Booking.com", "Expedia", "WhatsApp", "Dormakaba", "Salto", "API access"].map((name) => <span key={name} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300">{name}</span>)}</div></div></section>

      <section id="demo" className="mx-auto max-w-7xl px-5 py-24 text-center lg:px-8 lg:py-32"><div className="mx-auto max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">Ready when you are</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.05em] text-white sm:text-6xl">Run a better hotel, from one connected place.</h2><p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-400">Tell us about your property, your operation and where you want to go next. We&apos;ll show you how LodgeCore can get you there.</p><div className="mt-9 flex flex-wrap justify-center gap-3"><a href="mailto:sales@lodgecore.com" className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-[#061321] transition hover:bg-sky-300">Book a demo <ArrowRight className="h-4 w-4" /></a><Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[.05]">Customer login <Hotel className="h-4 w-4 text-sky-300" /></Link></div></div></section>

      <footer className="border-t border-white/[.07] px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-xs text-slate-500 sm:flex-row sm:items-center"><Logo /><div className="flex flex-wrap gap-x-5 gap-y-2"><span>© {new Date().getFullYear()} LodgeCore</span><a href="#platform" className="hover:text-white">Platform</a><a href="#pricing" className="hover:text-white">Pricing</a><a href="mailto:support@lodgecore.com" className="hover:text-white">Support</a><a href="mailto:sales@lodgecore.com" className="hover:text-white">Contact</a></div></div></footer>
    </main>
  );
}
