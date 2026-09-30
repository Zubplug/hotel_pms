import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";

type SessionUser = { organizationId?: string };

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const cls =
    s === "ACTIVE"   ? "badge-active"  :
    s === "TRIALING" ? "badge-pending" :
    s === "PAST_DUE" ? "badge-urgent"  : "badge-inactive";
  return <span className={`portal-badge ${cls}`}>{status}</span>;
}

export default async function SubscriptionPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.organizationId) redirect("/portal/login");

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        include: {
          items: { include: { product: true } },
        },
      },
    },
  });

  const plan = subscription?.plan ?? null;

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Subscription</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Your active plan, modules and entitlements.
          </p>
        </div>
        <Link href="/portal/billing" className="btn btn-outline btn-sm">Manage billing →</Link>
      </div>

      {!subscription ? (
        <div className="portal-empty">
          <div className="portal-empty-icon">📦</div>
          <div className="portal-empty-title">No active subscription</div>
          <div className="portal-empty-body">
            Your organization doesn&apos;t have a subscription yet. Talk to the LodgeCore team to get set up.
          </div>
          <Link href="/book-demo" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Contact sales →</Link>
        </div>
      ) : (
        <>
          {/* Plan overview */}
          <div className="portal-card">
            <div className="portal-card-title">
              Current plan
              <StatusBadge status={subscription.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
              <div>
                <div className="portal-stat-label">Plan name</div>
                <div className="portal-stat-value" style={{ fontSize: "1.4rem" }}>
                  {plan?.name ?? "—"}
                </div>
              </div>
              <div>
                <div className="portal-stat-label">Status</div>
                <div className="portal-stat-value" style={{ fontSize: "1.4rem" }}>
                  {subscription.status}
                </div>
              </div>
              <div>
                <div className="portal-stat-label">Active since</div>
                <div className="portal-stat-value" style={{ fontSize: "1.2rem" }}>
                  {new Date(subscription.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </div>
              </div>
            </div>
            {plan?.description && (
              <p style={{ marginTop: 18, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                {plan.description}
              </p>
            )}
          </div>

          {/* Module entitlements */}
          <div className="portal-card" style={{ padding: 0 }}>
            <div className="portal-card-title" style={{ padding: "20px 22px 0" }}>
              Included modules
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 400 }}>
                {plan?.items?.length ?? 0} module{(plan?.items?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            {!plan?.items?.length ? (
              <div className="portal-empty" style={{ margin: "0 22px 22px" }}>
                <div className="portal-empty-body">No modules listed for this plan yet. Contact support for details.</div>
              </div>
            ) : (
              <div className="portal-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Code</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                          {item.product.name}
                        </td>
                        <td>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>
                            {item.product.code}
                          </span>
                        </td>
                        <td>
                          <span className={`portal-badge ${item.product.active ? "badge-active" : "badge-inactive"}`}>
                            {item.product.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upgrade prompt */}
          <div className="portal-card" style={{ background: "transparent", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="portal-card-title" style={{ marginBottom: 4 }}>Need more modules or higher limits?</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Talk to the LodgeCore team about expanding your plan.</p>
            </div>
            <Link href="/portal/support" className="btn btn-primary btn-sm" style={{ border: "none" }}>Contact team →</Link>
          </div>
        </>
      )}
    </PortalShell>
  );
}
