import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";
import SubscriptionCatalogue from "./SubscriptionCatalogue";

function StatusBadge({ status }: { status: string }) { const value = (status || "").toUpperCase(); const cls = value === "ACTIVE" ? "badge-active" : value === "PAST_DUE" ? "badge-urgent" : "badge-pending"; return <span className={`portal-badge ${cls}`}>{status}</span>; }

export default async function SubscriptionPage() {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  const [subscription, entitlements, plans, addOns, properties] = await Promise.all([
    prisma.subscription.findFirst({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "desc" }, include: { plan: { include: { items: { include: { product: true } } } } } }),
    prisma.entitlement.findMany({ where: { organizationId: user.organizationId, status: "ACTIVE" }, include: { product: true, property: { select: { name: true } } }, orderBy: [{ propertyId: "asc" }, { productCode: "asc" }] }),
    prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" }, include: { items: { include: { product: { include: { prices: { orderBy: { amount: "asc" } } } } } } } }),
    prisma.billingProduct.findMany({ where: { active: true, type: "ADDON" }, orderBy: { name: "asc" }, include: { prices: { orderBy: { amount: "asc" } } } }),
    prisma.property.findMany({ where: { organizationId: user.organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const plan = subscription?.plan;
  return <PortalShell><div className="portal-page-header"><div><div className="portal-page-kicker">Customer workspace</div><h1 className="portal-page-title">Subscription</h1><p className="portal-page-sub" style={{ marginBottom: 0 }}>Manage your organisation plan, property access and optional modules.</p></div><Link href="/portal/billing" className="btn btn-outline btn-sm">View invoices →</Link></div>
    {subscription ? <div className="portal-card" style={{ marginBottom: 20 }}><div className="portal-card-title">Current subscription <StatusBadge status={subscription.status} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 20, marginTop: 16 }}><div><div className="portal-stat-label">Plan</div><div className="portal-stat-value">{plan?.name || "Custom"}</div></div><div><div className="portal-stat-label">Active until</div><div className="portal-stat-value" style={{ fontSize: "1rem" }}>{new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB")}</div></div><div><div className="portal-stat-label">Auto-renewal</div><div className="portal-stat-value" style={{ fontSize: "1rem" }}>{subscription.cancelAtPeriodEnd ? "Scheduled to end" : "Not enabled"}</div></div></div>{subscription.status === "PAST_DUE" && <p style={{ marginTop: 16, color: "var(--danger, #b42318)", fontSize: 13 }}>Payment is past due. Use the invoice page to make a payment and keep your modules active.</p>}</div> : <div className="portal-card" style={{ marginBottom: 20 }}><div className="portal-card-title">No active subscription</div><p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 13 }}>Choose a plan below. Your organisation will receive an invoice and can pay securely through Flutterwave.</p></div>}
    <SubscriptionCatalogue plans={plans} addOns={addOns} properties={properties} />
    <div className="portal-card" style={{ marginTop: 24, background: "transparent", border: "1px solid var(--border)" }}><div className="portal-card-title" style={{ marginBottom: 8 }}>Active entitlements</div>{entitlements.length ? <div className="portal-table-wrap" style={{ border: "none" }}><table className="portal-table"><thead><tr><th>Module</th><th>Scope</th><th>Status</th></tr></thead><tbody>{entitlements.map((entitlement) => <tr key={entitlement.id}><td style={{ color: "var(--text-primary)", fontWeight: 600 }}>{entitlement.product.name}</td><td>{entitlement.property?.name ?? "All organisation properties"}</td><td><span className="portal-badge badge-active">Active</span></td></tr>)}</tbody></table></div> : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Entitlements will appear after a payment is confirmed.</p>}</div>
  </PortalShell>;
}
