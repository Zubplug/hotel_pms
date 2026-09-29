import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const labels: Record<string, string> = { subscription: "Subscription", billing: "Billing & invoices", invoices: "Invoices", modules: "Enabled modules", properties: "Properties", users: "Users", settings: "Organization settings", hardware: "Hardware", installations: "Installations", implementation: "Implementation", support: "Support", integrations: "Installed integrations", api: "API access" };
export default async function PortalArea({ params }: { params: Promise<{ slug: string[] }> }) {
  const session = await auth();
  if (!session?.user) redirect("/portal/login");
  const slug = (await params).slug.join("/");
  const title = labels[slug] || "Portal workspace";
  return <main className="min-h-screen bg-[#07111f] px-6"><header className="mx-auto flex max-w-7xl justify-between py-6"><Link href="/portal/dashboard" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><Link href="/portal/dashboard" className="text-sm text-slate-400">Back to dashboard</Link></header><section className="mx-auto max-w-5xl py-20"><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">Customer portal</p><h1 className="mt-4 text-5xl font-bold text-white">{title}</h1><p className="mt-5 max-w-xl leading-7 text-slate-400">This workspace is connected to your organization&apos;s LodgeCore control-plane data and will show live records as they are provisioned.</p><div className="mt-10 rounded-2xl border border-white/10 bg-white/[.04] p-6 text-sm text-slate-300">No records are available for this workspace yet.</div></section></main>;
}
