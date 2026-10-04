import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";

type SessionUser = { organizationId?: string; email?: string | null; name?: string | null };

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.organizationId) redirect("/portal/login");

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true, slug: true, createdAt: true },
  });

  const memberCount = await prisma.user.count({
    where: { membership: { organizationId: user.organizationId } },
  });

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Settings</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Organization details and access management.
          </p>
        </div>
      </div>

      {/* Booking Engine */}
      <div className="portal-card" style={{ border: "1px solid rgba(167,139,250,.28)", background: "linear-gradient(135deg, rgba(167,139,250,.08), rgba(15,23,42,.18))" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div><div className="portal-card-title">Beds24 channel integration</div><p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 620, marginTop: 8 }}>Connect Beds24, map rooms and rate plans, and synchronize reservations, rates and availability.</p></div>
          <Link href="/portal/settings/integrations" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }}>Configure Beds24 →</Link>
        </div>
      </div>

      {/* Booking Engine */}
      <div className="portal-card" style={{ border: "1px solid rgba(0,212,232,.28)", background: "linear-gradient(135deg, rgba(0,212,232,.08), rgba(15,23,42,.18))" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div className="portal-card-title">Booking Engine & website</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 620, marginTop: 8 }}>
              Configure your property booking sites, select a visual template, manage payments, request custom website design, and connect a custom domain.
            </p>
          </div>
          <Link href="/portal/settings/booking-engine" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }}>Open Booking Engine →</Link>
        </div>
      </div>

      {/* Organization */}
      <div className="portal-card">
        <div className="portal-card-title">Organization</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          <div>
            <div className="portal-stat-label">Name</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginTop: 6 }}>
              {organization?.name ?? "—"}
            </div>
          </div>
          <div>
            <div className="portal-stat-label">Slug</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginTop: 6 }}>
              {organization?.slug ?? "—"}
            </div>
          </div>
          <div>
            <div className="portal-stat-label">Member since</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              {organization?.createdAt
                ? new Date(organization.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            To update organization details, contact the LodgeCore team.
          </p>
          <Link href="/portal/support" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>Request change →</Link>
        </div>
      </div>

      {/* Current user */}
      <div className="portal-card">
        <div className="portal-card-title">Your account</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="portal-user-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
            {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>
              {user.name ?? "Portal user"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {user.email}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Password changes and account security are managed through the LodgeCore team.
          </p>
          <Link href="/portal/support" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>Change password →</Link>
        </div>
      </div>

      {/* Team */}
      <div className="portal-card">
        <div className="portal-card-title">
          Team access
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
          User accounts and role assignments are managed through the LodgeCore control plane.
          To add or remove a team member, raise a support ticket.
        </p>
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <Link href="/portal/support" className="btn btn-primary btn-sm" style={{ border: "none" }}>Add team member →</Link>
          <Link href="/portal/support" className="btn btn-outline btn-sm">Remove access</Link>
        </div>
      </div>

      {/* Security */}
      <div className="portal-card" style={{ background: "transparent", border: "1px solid var(--border)" }}>
        <div className="portal-card-title" style={{ marginBottom: 10 }}>Security</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { label: "Encryption", value: "TLS 1.3 + AES-256" },
            { label: "Access control", value: "Role-based (RBAC)" },
            { label: "Audit log", value: "All operations" },
            { label: "Compliance", value: "SOC 2 · PCI DSS" },
          ].map((item) => (
            <div key={item.label}>
              <div className="portal-stat-label">{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Link href="/security" className="btn btn-outline btn-sm">View security policy →</Link>
        </div>
      </div>
    </PortalShell>
  );
}
