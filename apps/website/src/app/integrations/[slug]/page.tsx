import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

const integrationData: Record<
  string,
  {
    icon: string;
    type: string;
    tagline: string;
    features: { title: string; body: string }[];
  }
> = {
  paystack: {
    icon: "💳",
    type: "Payments",
    tagline: "Accept Paystack payments and post charges directly to the guest folio.",
    features: [
      { title: "Card & bank transfer", body: "Accept Mastercard, Visa, Verve and bank transfer payments at the front desk, F&B outlet, or online booking engine." },
      { title: "Auto-posting to folio", body: "Every Paystack transaction posts automatically to the guest folio — no manual reconciliation between systems." },
      { title: "Refund management", body: "Initiate and track Paystack refunds directly from the LodgeCore finance workspace." },
      { title: "Settlement reporting", body: "Daily settlement summaries from Paystack are matched against the LodgeCore operational record automatically." },
    ],
  },
  flutterwave: {
    icon: "🔄",
    type: "Payments",
    tagline: "Multi-currency payment processing across 34 African markets.",
    features: [
      { title: "Multi-currency support", body: "Accept NGN, USD, GBP, EUR, KES, GHS and more — Flutterwave handles conversion so your team doesn't have to." },
      { title: "Direct folio posting", body: "All transactions — card, bank transfer, USSD — post directly to the guest folio in real time." },
      { title: "International guests", body: "Serve international guests with familiar payment methods without adding complexity to your front desk workflow." },
      { title: "Reconciliation", body: "Flutterwave settlements are reconciled against LodgeCore's daily close automatically." },
    ],
  },
  "booking-com": {
    icon: "🌐",
    type: "Distribution",
    tagline: "Two-way sync with Booking.com — availability, rates and reservations.",
    features: [
      { title: "Live availability sync", body: "Your LodgeCore room inventory is pushed to Booking.com in real time. No overbooking, no manual updates." },
      { title: "Reservation import", body: "Bookings from Booking.com flow directly into LodgeCore as reservations — complete with guest profile, rates and special requests." },
      { title: "Rate management", body: "Manage Booking.com rates and restrictions from the LodgeCore channel control workspace." },
      { title: "Review notifications", body: "Guest review alerts from Booking.com surface in the LodgeCore workspace so your team can respond quickly." },
    ],
  },
  expedia: {
    icon: "✈️",
    type: "Distribution",
    tagline: "Connect to the Expedia Group network — Expedia, Hotels.com and more.",
    features: [
      { title: "Group network reach", body: "One connection gives your property distribution across Expedia, Hotels.com, Orbitz, Travelocity and the full Expedia Group." },
      { title: "Bidirectional sync", body: "Availability and rates flow out; reservations flow in — all in real time without manual intervention." },
      { title: "Promotion management", body: "Apply Expedia promotions and rate plans from the LodgeCore channel workspace." },
      { title: "Performance reporting", body: "Booking velocity and revenue contribution from Expedia channels is visible in LodgeCore reporting." },
    ],
  },
  whatsapp: {
    icon: "💬",
    type: "Communications",
    tagline: "Send automated guest messages and handle service requests via WhatsApp.",
    features: [
      { title: "Pre-arrival messages", body: "Automated WhatsApp messages at configurable intervals before arrival — directions, check-in instructions, upsell offers." },
      { title: "Post-departure follow-up", body: "Thank-you messages and review requests sent automatically after the guest checks out." },
      { title: "Service request handling", body: "Guest WhatsApp messages route into the LodgeCore workspace where the team can respond from a single view." },
      { title: "Template management", body: "Build and manage message templates in the LodgeCore communications workspace — no external portal needed." },
    ],
  },
  dormakaba: {
    icon: "🔑",
    type: "Access Control",
    tagline: "Issue and manage Dormakaba key cards directly from the front desk.",
    features: [
      { title: "Integrated encoding", body: "Encode guest key cards from the LodgeCore check-in workflow — no separate encoder software or manual data entry." },
      { title: "Check-out invalidation", body: "Cards are automatically invalidated when the guest checks out — no encoder visit required." },
      { title: "Room extension", body: "Extending a stay updates the card validity automatically when the reservation is modified in LodgeCore." },
      { title: "Lost card handling", body: "Reissue cards instantly from the front desk — previous cards are invalidated immediately." },
    ],
  },
  salto: {
    icon: "🚪",
    type: "Access Control",
    tagline: "Cloud-connected smart locks — mobile keys and access events from the PMS.",
    features: [
      { title: "Mobile key issuance", body: "Send digital room keys to the guest's phone at check-in — issued and revoked from the LodgeCore workspace." },
      { title: "Access event log", body: "Every door access event is visible in LodgeCore — timestamp, door ID, and credential type." },
      { title: "Remote lock management", body: "Lock or unlock any door on the property remotely from the LodgeCore operations workspace." },
      { title: "Automatic revocation", body: "Mobile keys are revoked automatically on checkout — or manually at any point during the stay." },
    ],
  },
  "open-apis": {
    icon: "⚡",
    type: "Developer",
    tagline: "Build on LodgeCore with REST APIs, webhooks and secure credentials.",
    features: [
      { title: "REST API", body: "Documented REST endpoints for reservations, guests, folios, rooms, events and operational data." },
      { title: "Webhooks", body: "Real-time event notifications for check-in, check-out, folio updates and reservation changes." },
      { title: "OAuth 2.0 auth", body: "Secure OAuth 2.0 authentication with scoped access tokens — no shared secrets." },
      { title: "Sandbox environment", body: "Test your integration against a sandboxed LodgeCore workspace before connecting to a live property." },
    ],
  },
};

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const data = integrationData[slug];
  const name = slug
    .split("-")
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .join(" ");

  return (
    <PublicShell
      eyebrow={`Integration · ${data?.type ?? "Marketplace"}`}
      title={`${name}, connected to LodgeCore.`}
      description={
        data?.tagline ??
        "Connect your existing systems with clear setup requirements, secure credentials and operational visibility."
      }
    >
      <section className="section-gap">
        <div className="contain">
          {data ? (
            <>
              {/* Feature cards */}
              <div className="section-kicker">What this integration does</div>
              <h2 className="display-md" style={{ marginTop: 14 }}>
                How <em>{name}</em> works with LodgeCore
              </h2>
              <div className="platform-capabilities" style={{ marginTop: 32 }}>
                {data.features.map((f, i) => (
                  <div key={f.title} className="capability-card">
                    <div className="cap-icon" style={{ fontSize: 22 }}>{data.icon}</div>
                    <div className="cap-text">
                      <div className="cap-num">0{i + 1}</div>
                      <h4>{f.title}</h4>
                      <p>{f.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Generic page for unknown slugs */
            <div className="feature-grid">
              {[
                { title: "Compatibility", body: "Confirm supported workflows, properties and data direction with the implementation team." },
                { title: "Secure setup", body: "Credentials and configuration are managed through the LodgeCore control plane — no manual key entry." },
                { title: "Operational visibility", body: "Keep sync status, connection health and integration ownership visible to your team at all times." },
              ].map((item) => (
                <div key={item.title} className="feature-card">
                  <h3 style={{ marginTop: 12 }}>{item.title}</h3>
                  <p style={{ marginTop: 8 }}>{item.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Setup info */}
          <div
            style={{
              marginTop: 40,
              padding: "28px 32px",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-card)",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 32,
            }}
          >
            {[
              { label: "Setup complexity", value: "Managed" },
              { label: "Data direction", value: "Bidirectional" },
              { label: "Support", value: "Included" },
            ].map((item) => (
              <div key={item.label}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="platform-cta-panel" style={{ marginTop: 40 }}>
            <div>
              <div className="section-kicker">Ready to connect?</div>
              <h2 className="display-md" style={{ marginTop: 12 }}>
                Set up <em>{name}</em> with your property
              </h2>
              <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.75 }}>
                Integration setup is handled by the LodgeCore implementation team —
                credentials, configuration and testing included. Talk to us to get started.
              </p>
            </div>
            <div className="platform-cta-actions">
              <Link href="/book-demo" className="btn btn-primary btn-lg">
                Talk to integrations →
              </Link>
              <Link href="/integrations" className="btn btn-outline btn-sm">
                ← All integrations
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
