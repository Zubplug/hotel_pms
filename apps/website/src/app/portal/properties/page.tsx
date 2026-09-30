import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";

type SessionUser = { organizationId?: string };

export default async function PropertiesPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.organizationId) redirect("/portal/login");

  const properties = await prisma.property.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      createdAt: true,
      address: true,
    },
  });

  const active = properties.filter((p) => p.isActive);
  const inactive = properties.filter((p) => !p.isActive);

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Properties</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <Link href="/portal/support" className="btn btn-outline btn-sm">Add a property →</Link>
      </div>

      {properties.length === 0 ? (
        <div className="portal-empty">
          <div className="portal-empty-icon">🏨</div>
          <div className="portal-empty-title">No properties configured</div>
          <div className="portal-empty-body">
            Properties are created and configured through the LodgeCore control plane.
            Contact the team to add your first property.
          </div>
          <Link href="/portal/support" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Request via support →</Link>
        </div>
      ) : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Code</th>
                <th>Rooms</th>
                <th>Location</th>
                <th>Added</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td style={{ color: "var(--text-primary)", fontWeight: 600 }}>{p.name}</td>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>{p.code}</span></td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>—</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{p.address ?? "—"}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td>
                    <span className={`portal-badge ${p.isActive ? "badge-active" : "badge-inactive"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="portal-card" style={{ marginTop: 16, background: "transparent", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="portal-card-title" style={{ marginBottom: 4 }}>Adding another property?</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>New properties are provisioned through the LodgeCore team. Raise a support ticket to get started.</p>
        </div>
        <Link href="/portal/support" className="btn btn-outline btn-sm">Request →</Link>
      </div>
    </PortalShell>
  );
}
