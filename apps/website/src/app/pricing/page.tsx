import Link from "next/link";
import prisma from "@hotel-pms/db";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" }, include: { items: { include: { product: { select: { name: true } } } } } });
  return <main className="site-shell"><PublicHeader /><section className="page-hero"><div className="section-kicker">Plans that scale with the property</div><h1>Choose the operating depth your team needs.</h1><p>Every LodgeCore plan is configured from the control plane, so the modules and limits shown here stay aligned with what is available to your property.</p></section><section className="section" style={{ paddingTop: 0 }}><div className="foundation-grid">{plans.length === 0 ? <div className="foundation-card" style={{ gridColumn: "1 / -1" }}><span>PRICING CONFIGURATION</span><h3>Plans are being prepared for publication.</h3><p>Talk to the LodgeCore team and we will recommend the right operating model for your property.</p><Link href="/book-demo" className="text-link">Talk to sales <b>↗</b></Link></div> : plans.map((plan) => <article className="foundation-card" key={plan.id}><span>{plan.name.toUpperCase()}</span><h3>{plan.description || "Connected hotel operations, configured for your property."}</h3><p>{plan.items.length ? `${plan.items.length} connected product${plan.items.length === 1 ? "" : "s"} included.` : "A connected operating foundation for your team."}</p><ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none", color: "#a9b9c8", fontSize: 13, lineHeight: 2 }}>{plan.items.slice(0, 5).map((item) => <li key={item.product.name}>＋ {item.product.name}</li>)}</ul><Link href="/book-demo" className="text-link">Discuss {plan.name} <b>↗</b></Link></article>)}</div></section><PublicFooter /></main>;
}
