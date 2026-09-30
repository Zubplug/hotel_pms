import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

const labels: Record<string, [string, string]> = {
  subscription:  ["Subscription",          "Your active plan, modules and entitlements."],
  billing:       ["Billing & invoices",     "Invoices, payment details and billing history."],
  invoices:      ["Invoices",               "Download and review your payment history."],
  modules:       ["Enabled modules",        "Modules and features active on your plan."],
  properties:    ["Properties",             "Properties registered under your organization."],
  users:         ["Users",                  "Team members with access to the portal."],
  settings:      ["Organization settings",  "Manage your organization details and access."],
  hardware:      ["Hardware",               "Installed devices and pending installations."],
  installations: ["Installations",          "Scheduled and completed hardware deployments."],
  implementation:["Implementation",         "Migration, property setup and training progress."],
  support:       ["Support",                "Open tickets, SLA commitments and help resources."],
  integrations:  ["Integrations",           "Connected systems and API access."],
  api:           ["API access",             "API credentials, documentation and webhooks."],
};

export default async function PortalArea({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/portal/login");

  const slug = (await params).slug.join("/");
  const [title, description] = labels[slug] ?? ["Portal workspace", "This area is connected to your LodgeCore workspace."];

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">{title}</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>{description}</p>
        </div>
      </div>

      <div className="portal-card">
        <div
          style={{
            padding: "36px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 36, opacity: .5 }}>⏳</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
            Content loading
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360, lineHeight: 1.6 }}>
            This workspace is connected to your LodgeCore control-plane data.
            Records will appear here as they are provisioned for your organization.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Link href="/portal/dashboard" className="btn btn-outline btn-sm">← Dashboard</Link>
        <Link href="/portal/support" className="btn btn-primary btn-sm" style={{ border: "none" }}>Contact support →</Link>
      </div>
    </PortalShell>
  );
}
