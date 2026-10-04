import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";
import { requireOrganizationContext } from "@/lib/organization-access";
import Beds24Setup from "./Beds24Setup";

export default async function PortalIntegrationsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");
  const ctx = await requireOrganizationContext(session.user.id);
  const connection = await prisma.channelConnection.findFirst({ where: { organizationId: ctx.organizationId, provider: "BEDS24", propertyId: { in: [...ctx.propertyIds] }, status: "CONNECTED" }, select: { id: true } });
  return <PortalShell><div className="portal-page-header"><div><div className="portal-page-kicker">Customer workspace</div><h1 className="portal-page-title">Integrations</h1><p className="portal-page-sub">Connect Beds24 and manage distribution for your property.</p></div></div><Beds24Setup connected={Boolean(connection)} /></PortalShell>;
}
