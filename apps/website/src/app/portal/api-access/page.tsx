import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_PUBLIC_API_URL ?? "https://getlodgecore.vercel.app/api/v1/public";

const API_EXAMPLES = [
  {
    title: "1. Discover rooms and rates",
    request: `curl "${API_BASE}/availability?checkIn=2026-12-20&checkOut=2026-12-22&adults=2&children=0" \\
  -H "X-Publishable-Key: pk_live_your_key"`,
    response: `{
  "success": true,
  "data": {
    "checkIn": "2026-12-20",
    "checkOut": "2026-12-22",
    "nights": 2,
    "occupancy": { "adults": 2, "children": 0 },
    "data": [{
      "roomTypeId": "room-type-uuid",
      "name": "Deluxe King",
      "availability": { "available": 3, "isAvailable": true },
      "rates": [{ "ratePlanId": "rate-plan-uuid", "subtotal": 240000 }]
    }]
  }
}`,
  },
  {
    title: "2. Hold a selected room",
    request: `curl -X POST "${API_BASE}/hold" \\
  -H "Content-Type: application/json" \\
  -H "X-Publishable-Key: pk_live_your_key" \\
  -d '{
    "roomTypeId": "room-type-uuid",
    "ratePlanId": "rate-plan-uuid",
    "checkIn": "2026-12-20",
    "checkOut": "2026-12-22"
  }'`,
    response: `{
  "success": true,
  "data": {
    "holdToken": "opaque-hold-token",
    "expiresAt": "2026-12-20T12:12:00.000Z",
    "expiresInSeconds": 720,
    "pricing": { "nights": 2, "currency": "NGN", "subtotal": 240000 }
  }
}`,
  },
  {
    title: "3. Create a reservation",
    request: `curl -X POST "${API_BASE}/reservations" \\
  -H "Content-Type: application/json" \\
  -H "X-Publishable-Key: pk_live_your_key" \\
  -H "X-Idempotency-Key: booking-20261220-000001" \\
  -d '{
    "holdToken": "opaque-hold-token",
    "guest": {
      "firstName": "Ada",
      "lastName": "Lodge",
      "email": "ada@example.com",
      "phone": "+2348000000000",
      "country": "NG"
    },
    "adults": 2,
    "children": 0
  }'`,
    response: `{
  "success": true,
  "data": {
    "confirmationNumber": "LC-123456",
    "status": "PENDING",
    "confirmationToken": "reservation-token",
    "cancellationToken": "cancellation-token",
    "paymentRequired": true,
    "depositAmount": 120000
  }
}`,
  },
  {
    title: "4. Start payment when required",
    request: `curl -X POST "${API_BASE}/payment/intent" \\
  -H "Content-Type: application/json" \\
  -H "X-Publishable-Key: pk_live_your_key" \\
  -H "X-Idempotency-Key: payment-20261220-000001" \\
  -d '{
    "reservationToken": "reservation-token",
    "guestEmail": "ada@example.com"
  }'`,
    response: `{
  "success": true,
  "data": {
    "providerRef": "BK-12345678-ABC123",
    "authorizationUrl": "https://paystack.com/pay/…",
    "amount": 120000,
    "currency": "NGN"
  }
}`,
  },
];

export default async function ApiAccessPage() {
  const session = await auth();
  const user = session?.user as { organizationId?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.organizationId) redirect("/portal/login");

  const integrations = await prisma.propertyIntegration.findMany({
    where: { organizationId: user.organizationId, provider: "CUSTOM_WEBSITE", status: "ACTIVE" },
    select: {
      id: true,
      property: { select: { name: true } },
      publishableKeys: {
        where: { environment: "LIVE", status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { key: true, allowedOrigins: true, createdAt: true, lastUsedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <PortalShell userName={user.name ?? user.email ?? undefined}>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Developer tools · Standalone website API</div>
          <h1 className="portal-page-title">API access</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Your publishable key, setup instructions, and the public endpoints available to your website.
          </p>
        </div>
        <span className="portal-badge badge-active">Live API</span>
      </div>

      {integrations.length === 0 ? (
        <div className="portal-card" style={{ padding: 28 }}>
          <div className="portal-card-title">No standalone API access yet</div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.7 }}>
            Purchase the Standalone website using LodgeCore API add-on from your subscription page. Your key will be created automatically after payment is confirmed.
          </p>
          <Link href="/portal/subscription" className="btn btn-primary btn-sm" style={{ marginTop: 12, border: "none" }}>View add-ons →</Link>
        </div>
      ) : integrations.map((integration) => {
        const key = integration.publishableKeys[0];
        return (
          <section className="portal-card" style={{ marginBottom: 18 }} key={integration.id}>
            <div className="portal-card-title">
              {integration.property.name}
              <span className="portal-badge badge-active">Active</span>
            </div>
            {key ? (
              <>
                <div style={{ marginTop: 16 }}>
                  <div className="portal-stat-label">LC_PUBLISHABLE_KEY</div>
                  <code style={{ display: "block", marginTop: 7, padding: "12px 14px", overflowX: "auto", color: "var(--accent)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>{key.key}</code>
                  <code style={{ display: "block", marginTop: 7, color: "var(--text-muted)", fontSize: 11 }}>LC_PUBLISHABLE_KEY={key.key}</code>
                  <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 11 }}>Keep this key in your server environment or website configuration. Do not commit it to source control.</p>
                </div>
                <div style={{ marginTop: 22 }}>
                  <div className="portal-stat-label">Configuration guide</div>
                  <ol style={{ margin: "10px 0 0", paddingLeft: 20, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8 }}>
                    <li>Send the key in the <code>X-Publishable-Key</code> request header.</li>
                    <li>Configure your deployed website origin in the key's allowed origins before browser requests.</li>
                    <li>Use an <code>X-Idempotency-Key</code> of at least 16 characters when creating reservations.</li>
                    <li>Use the API only for public guest booking flows; never expose private PMS credentials.</li>
                  </ol>
                </div>
                <div style={{ marginTop: 22 }}>
                  <div className="portal-stat-label">Public API endpoints</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {[
                      ["GET", "/rooms", "List public room types and amenities."],
                      ["GET", "/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=2&children=0", "Check rooms and rates for a stay."],
                      ["POST", "/hold", "Temporarily hold a selected room and rate."],
                      ["POST", "/reservations", "Create a reservation from an active hold."],
                      ["POST", "/payment/intent", "Create a payment intent when payment is required."],
                      ["POST", "/cancel", "Cancel a reservation with its cancellation token."],
                    ].map(([method, path, description]) => (
                      <div key={`${method}-${path}`} style={{ display: "grid", gridTemplateColumns: "52px minmax(0, 1fr)", gap: 10, padding: "10px 12px", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                        <strong style={{ color: method === "GET" ? "var(--mint)" : "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 10 }}>{method}</strong>
                        <div><code style={{ color: "var(--text-primary)", fontSize: 11, overflowWrap: "anywhere" }}>{API_BASE}{path}</code><div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3 }}>{description}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 22 }}>
                  <div className="portal-stat-label">Called and received examples</div>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6, margin: "8px 0 12px" }}>
                    Replace the sample UUIDs and key with values from your property. All responses use the <code>success</code> and <code>data</code> envelope.
                  </p>
                  <div style={{ display: "grid", gap: 14 }}>
                    {API_EXAMPLES.map((example) => (
                      <div key={example.title} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                        <div style={{ padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontWeight: 700, background: "var(--bg-overlay)" }}>{example.title}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, background: "var(--border)" }}>
                          <div style={{ minWidth: 0, padding: 12, background: "var(--bg-card)" }}>
                            <div className="portal-stat-label" style={{ marginBottom: 7 }}>Call</div>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.65 }}>{example.request}</pre>
                          </div>
                          <div style={{ minWidth: 0, padding: 12, background: "var(--bg-card)" }}>
                            <div className="portal-stat-label" style={{ marginBottom: 7 }}>Received</div>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--mint)", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.65 }}>{example.response}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {key.allowedOrigins.length === 0 && <p style={{ margin: "18px 0 0", color: "var(--warning, #f4c76b)", fontSize: 12 }}>Add your website origin to allowed origins before making browser-side API calls. Contact support to configure it.</p>}
              </>
            ) : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Your payment is confirmed. Your publishable key is being provisioned.</p>}
          </section>
        );
      })}
    </PortalShell>
  );
}
