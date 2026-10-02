import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { ADDON_ELIGIBLE_SUBSCRIPTION_STATUSES } from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";
import SubscriptionWorkspace from "./SubscriptionWorkspace";

export default async function SubscriptionPage() {
  const session = await auth();
  const user = session?.user as { organizationId?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  const organizationId = user.organizationId;
  const [subscription, activeBaseSubscription, entitlements, plans, addOns, properties, invoices, projects] = await Promise.all([
    prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { plan: { include: { items: { include: { product: { include: { modules: { where: { active: true }, orderBy: { name: "asc" } } } } } } } } } }),
    prisma.subscription.findFirst({ where: { organizationId, status: { in: [...ADDON_ELIGIBLE_SUBSCRIPTION_STATUSES] }, planId: { not: null } }, select: { id: true } }),
    prisma.entitlement.findMany({ where: { organizationId, status: "ACTIVE" }, include: { product: true, property: { select: { name: true } } }, orderBy: [{ propertyId: "asc" }, { productCode: "asc" }] }),
    prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" }, include: { items: { include: { product: { include: { prices: { orderBy: { amount: "asc" } }, modules: { where: { active: true }, orderBy: { name: "asc" } } } } } } } }),
    prisma.billingProduct.findMany({ where: { active: true, type: "ADDON" }, orderBy: { name: "asc" }, include: { prices: { orderBy: { amount: "asc" } }, modules: { where: { active: true }, orderBy: { name: "asc" } } } }),
    prisma.property.findMany({ where: { organizationId }, select: { id: true, name: true, isActive: true, businessDate: true, auditStatus: true }, orderBy: { name: "asc" } }),
    prisma.billingInvoice.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, status: true, currency: true, total: true, amountPaid: true, amountDue: true, periodStart: true, periodEnd: true, hostedInvoiceUrl: true, invoicePdf: true, createdAt: true } }),
    prisma.implementationProject.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, status: true, targetGoLiveAt: true, createdAt: true } }),
  ]);
  const plan = subscription?.plan;
  const latestInvoice = invoices[0];
  const activeProperties = properties.filter((property) => property.isActive).length;
  const readyProperties = properties.filter((property) => property.isActive && property.businessDate && property.auditStatus).length;
  const openProjects = projects.filter((project) => !["COMPLETED", "CANCELLED"].includes(project.status)).length;
  const metrics = { activeProperties, totalProperties: properties.length, readyProperties, activeEntitlements: entitlements.length, openProjects, invoiceDue: invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0), failedInvoices: invoices.filter((invoice) => ["FAILED", "UNCOLLECTIBLE", "PAST_DUE"].includes(invoice.status.toUpperCase())).length };

  return <PortalShell orgName={undefined} userName={user.name ?? user.email ?? undefined}><SubscriptionWorkspace data={{ subscription: subscription ? { status: subscription.status, planName: plan?.name ?? "Custom plan", planCode: plan?.code ?? null, periodStart: subscription.currentPeriodStart.toISOString(), periodEnd: subscription.currentPeriodEnd.toISOString(), cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null, items: plan?.items.map((item) => ({ name: item.product.name, code: item.product.code, includedQty: item.includedQty, required: item.required })) ?? [] } : null, entitlements: entitlements.map((entitlement) => ({ id: entitlement.id, name: entitlement.product.name, code: entitlement.productCode, propertyName: entitlement.property?.name ?? "All organisation properties", expiresAt: entitlement.expiresAt?.toISOString() ?? null })), properties: properties.map((property) => ({ id: property.id, name: property.name, isActive: property.isActive, ready: Boolean(property.isActive && property.businessDate && property.auditStatus) })), invoices: invoices.map((invoice) => ({ id: invoice.id, status: invoice.status, currency: invoice.currency, total: invoice.total, amountPaid: invoice.amountPaid, amountDue: invoice.amountDue, periodStart: invoice.periodStart?.toISOString() ?? null, periodEnd: invoice.periodEnd?.toISOString() ?? null, hostedInvoiceUrl: invoice.hostedInvoiceUrl, invoicePdf: invoice.invoicePdf, createdAt: invoice.createdAt.toISOString() })), projects: projects.map((project) => ({ id: project.id, name: project.name, status: project.status, targetGoLiveAt: project.targetGoLiveAt?.toISOString() ?? null, createdAt: project.createdAt.toISOString() })), latestInvoiceStatus: latestInvoice?.status ?? null, metrics }} plans={plans} addOns={addOns} hasActiveBaseSubscription={Boolean(activeBaseSubscription)} checkoutProperties={properties.filter((property) => property.isActive).map((property) => ({ id: property.id, name: property.name }))} /></PortalShell>;
}
