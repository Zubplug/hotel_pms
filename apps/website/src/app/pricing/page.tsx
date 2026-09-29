import Link from "next/link";
import prisma from "@hotel-pms/db";

export const dynamic = "force-dynamic";

const fallbackPlans = [["Starter", "PMS, reservations, front desk and basic reports."], ["Professional", "PMS, POS, housekeeping, accounting, inventory and channels."], ["Enterprise", "Everything, plus multi-property, APIs, custom integrations and dedicated support."]];
export default async function PricingPage() {
  const plans = await prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" }, include: { items: { include: { product: { select: { name: true } } } } } });
  const cards = plans.length ? plans.map((plan) => [plan.name, plan.description || plan.items.map((item) => item.product.name).join(", ") || "Connected hotel operations."]) : fallbackPlans;
  return <main className="min-h-screen bg-[#07111f] px-6"><header className="mx-auto flex max-w-7xl justify-between py-6"><Link href="/" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><Link href="/book-demo" className="rounded-full bg-sky-300 px-4 py-2 text-sm font-bold text-[#07111f]">Talk to sales</Link></header><section className="mx-auto max-w-7xl py-20"><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">Plans that follow your growth</p><h1 className="mt-5 text-5xl font-bold text-white">The right operating depth for every stage.</h1><p className="mt-5 max-w-xl text-slate-400">Plans, modules and limits are served from the LodgeCore control plane—not hard-coded into the website.</p><div className="mt-12 grid gap-4 lg:grid-cols-3">{cards.map(([name, description]) => <div key={name} className="rounded-2xl border border-white/10 bg-white/[.04] p-7"><h2 className="text-2xl font-bold text-white">{name}</h2><p className="mt-4 min-h-20 text-sm leading-6 text-slate-400">{description}</p><Link href="/book-demo" className="mt-8 inline-block text-sm font-bold text-sky-300">Explore {name} →</Link></div>)}</div></section></main>;
}
