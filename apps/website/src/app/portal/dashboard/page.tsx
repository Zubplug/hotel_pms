import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";

const areas = [["Subscription", "Plan, status and enabled modules", "/portal/subscription"], ["Properties", "Properties and operational scope", "/portal/properties"], ["Implementation", "Migration, installation and training", "/portal/implementation"], ["Support", "Tickets, SLA and help", "/portal/support"], ["Integrations", "Installed connections and APIs", "/portal/integrations"], ["Billing", "Invoices and payment details", "/portal/billing"]];
export default async function PortalDashboard() {
  const session = await auth();
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) redirect("/portal/login");
  const [organization, subscription, properties, tickets] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" }, select: { status: true, plan: { select: { name: true } } } }),
    prisma.property.count({ where: { organizationId, isActive: true } }),
    prisma.supportTicket.count({ where: { organizationId, status: { not: "CLOSED" } } }),
  ]);
  const liveAreas = areas.map(([title, description, href]) => [title, description, href] as const);
  return <main className="min-h-screen bg-[#07111f] px-6"><header className="mx-auto flex max-w-7xl justify-between py-6"><Link href="/" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><span className="text-sm text-slate-500">Customer portal</span></header><section className="mx-auto max-w-7xl py-16"><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">Organization workspace</p><h1 className="mt-4 text-4xl font-bold text-white">{organization?.name || "Your organization"}</h1><p className="mt-3 text-slate-400">Subscription: {subscription?.plan?.name || "No plan assigned"} · {subscription?.status || "Not active"} · {properties} active properties · {tickets} open tickets</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{liveAreas.map(([title, description, href]) => <Link href={href} key={title} className="rounded-2xl border border-white/10 bg-white/[.04] p-6 hover:border-sky-300/40"><h2 className="font-bold text-white">{title}</h2><p className="mt-2 text-sm text-slate-400">{description}</p><p className="mt-6 text-xs font-bold text-sky-300">Open →</p></Link>)}</div></section></main>;
}
