import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

/* ── Platform page content ──────────────────────────────── */
const copy: Record<
  string,
  {
    title: string;
    description: string;
    eyebrow: string;
    capabilities: { icon: string; title: string; body: string }[];
    relatedModules: { href: string; name: string }[];
  }
> = {
  pms: {
    eyebrow: "Property Management System",
    title: "The operating core for your property.",
    description:
      "A complete property management workspace for reservations, front desk, guests, rooms and the daily rhythm of your hotel. All in one connected platform.",
    capabilities: [
      { icon: "📅", title: "Reservations & room rack", body: "A live view of every booking, room and availability window. Drag-and-drop room assignment with real-time conflict detection." },
      { icon: "👤", title: "Guest profiles & folios", body: "A complete guest record from first contact through final folio — preferences, history, charges and communications in one place." },
      { icon: "🛎", title: "Front desk workflows", body: "Arrivals, check-in, check-out and mid-stay service requests handled from a single focused workspace." },
      { icon: "📊", title: "Night audit & reporting", body: "Automated daily close with full audit trail, revenue summary and exception reports — accurate every time." },
    ],
    relatedModules: [
      { href: "/platform/front-desk", name: "Front Desk" },
      { href: "/platform/accounting", name: "Finance" },
      { href: "/platform/housekeeping", name: "Housekeeping" },
    ],
  },
  "front-desk": {
    eyebrow: "Front Desk",
    title: "A clearer front desk, from arrival to departure.",
    description:
      "Give your team one calm, connected workspace for arrivals, room status, payments and guest service — designed to reduce friction and make the next action obvious.",
    capabilities: [
      { icon: "✈️", title: "Live arrivals & departures", body: "See every arrival and departure in real time, with guest profiles, room status and folio balance all visible at a glance." },
      { icon: "🏠", title: "Room assignment & status", body: "Assign rooms, view live housekeeping status and communicate maintenance needs — without leaving the desk view." },
      { icon: "💳", title: "Folio & payment control", body: "Split folios, post charges from any department, process payments and issue receipts — all within the same workflow." },
      { icon: "📡", title: "Offline-ready workflows", body: "Check-ins, check-outs and payments continue to work during connectivity interruptions. Data syncs automatically when the connection is restored." },
    ],
    relatedModules: [
      { href: "/platform/pms", name: "PMS" },
      { href: "/platform/housekeeping", name: "Housekeeping" },
      { href: "/platform/pos", name: "Food & Beverage" },
    ],
  },
  pos: {
    eyebrow: "Food & Beverage",
    title: "Every outlet, connected to the stay.",
    description:
      "Connect restaurants, bars, kitchens and room charges without duplicating work across systems. Every order, every outlet, every charge — part of the same guest record.",
    capabilities: [
      { icon: "🍽", title: "Multi-outlet POS", body: "Restaurant, bar, poolside, room service — one platform manages every outlet with consistent menu control and reporting." },
      { icon: "👨‍🍳", title: "Kitchen display system", body: "Orders route from any outlet to the correct kitchen station in real time, with timing visibility across the service team." },
      { icon: "🏨", title: "Room charge posting", body: "Guests authorise charges to their room folio — no cash, no paper, no reconciliation errors between departments." },
      { icon: "📈", title: "Outlet reporting", body: "Revenue, covers, average spend and void reports for every outlet — available the moment service closes." },
    ],
    relatedModules: [
      { href: "/platform/pms", name: "PMS" },
      { href: "/platform/front-desk", name: "Front Desk" },
      { href: "/platform/events", name: "Events & Groups" },
    ],
  },
  housekeeping: {
    eyebrow: "Housekeeping",
    title: "Make room readiness visible.",
    description:
      "Coordinate housekeeping, inspections and maintenance with a live view of what the property needs next — always in sync with arrivals and departures.",
    capabilities: [
      { icon: "🔄", title: "Live room status board", body: "Every room's current state — clean, dirty, inspected, do-not-disturb, out-of-order — visible to every team in real time." },
      { icon: "📋", title: "Task assignment", body: "Assign rooms to attendants by section, priority or check-out time. Staff see their own task list and update status from any device." },
      { icon: "✅", title: "Inspection checklists", body: "Supervisors inspect rooms against configurable checklists and mark them ready from a mobile device — no radio, no paper." },
      { icon: "🔧", title: "Maintenance handoffs", body: "Log maintenance issues directly from housekeeping. Engineering sees open tasks in real time and updates completion status." },
    ],
    relatedModules: [
      { href: "/platform/pms", name: "PMS" },
      { href: "/platform/front-desk", name: "Front Desk" },
    ],
  },
  accounting: {
    eyebrow: "Finance & Accounting",
    title: "Know where every naira goes.",
    description:
      "Bring operational transactions, cash control, reconciliation and financial reporting into one picture — with every entry traceable to its source.",
    capabilities: [
      { icon: "📄", title: "Folios & city ledger", body: "Guest folios, company accounts and city ledger balances — managed in one place, always reconciled to the operational record." },
      { icon: "💰", title: "Cash management", body: "Float control, cashier shifts, denomination reconciliation and variance reporting across every point of sale." },
      { icon: "🔁", title: "Reconciliation", body: "Automated matching of operational transactions against payment gateway settlements — exceptions surfaced, not buried." },
      { icon: "🌙", title: "Night audit", body: "Automated daily close with configurable audit procedures, revenue journal and management summary — completed in minutes, not hours." },
    ],
    relatedModules: [
      { href: "/platform/pms", name: "PMS" },
      { href: "/platform/pos", name: "Food & Beverage" },
    ],
  },
};

const fallback = {
  eyebrow: "LodgeCore platform",
  title: "Hotel operations, connected.",
  description:
    "Purpose-built workflows that bring your property, people and performance together in one intelligent operating system.",
  capabilities: [
    { icon: "🏨", title: "Designed for hotel teams", body: "Workflows built around how front desk, housekeeping, F&B and finance actually operate — not how software vendors imagine it." },
    { icon: "🔗", title: "Connected operational data", body: "Reservations, rooms, guests, payments and reporting all share the same source of truth." },
    { icon: "🚀", title: "Implementation support", body: "LodgeCore's team works with your property to configure, train and go live — typically within 2–4 weeks." },
    { icon: "⚙️", title: "Control-plane ready", body: "Multi-property groups manage configuration, plans and users from a central admin workspace." },
  ],
  relatedModules: [
    { href: "/platform/pms", name: "PMS" },
    { href: "/platform/front-desk", name: "Front Desk" },
    { href: "/platform/pos", name: "Food & Beverage" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const page = copy[(await params).slug] || fallback;
  return { title: page.title, description: page.description };
}

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const page = copy[slug] || fallback;

  return (
    <PublicShell eyebrow={page.eyebrow} title={page.title} description={page.description}>
      <section className="section-gap">
        <div className="contain">
          {/* Capabilities */}
          <div className="section-kicker">Core capabilities</div>
          <h2 className="display-md" style={{ marginTop: 14 }}>
            What <em>{page.eyebrow}</em> does
          </h2>
          <div className="platform-capabilities">
            {page.capabilities.map((cap, i) => (
              <div key={cap.title} className="capability-card">
                <div className="cap-icon">{cap.icon}</div>
                <div className="cap-text">
                  <div className="cap-num">0{i + 1}</div>
                  <h4>{cap.title}</h4>
                  <p>{cap.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Related modules */}
          {page.relatedModules.length > 0 && (
            <div style={{ marginTop: 52 }}>
              <div className="section-kicker">Connected modules</div>
              <div className="feature-grid" style={{ marginTop: 20 }}>
                {page.relatedModules.map((mod) => (
                  <Link key={mod.href} href={mod.href} className="feature-card" style={{ textDecoration: "none" }}>
                    <div className="feature-num">Module</div>
                    <h3 style={{ marginTop: 20 }}>{mod.name}</h3>
                    <p>Connect this workspace to {page.eyebrow} for a complete operational picture.</p>
                    <span className="text-link" style={{ marginTop: 20 }}>Explore {mod.name} →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA Panel */}
          <div className="platform-cta-panel" style={{ marginTop: 52 }}>
            <div>
              <div className="section-kicker">See it in context</div>
              <h2 className="display-md" style={{ marginTop: 12 }}>
                One operating picture for the <em>whole property.</em>
              </h2>
              <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.75 }}>
                LodgeCore connects {page.eyebrow} to reservations, guests, payments,
                finance and the teams delivering the stay — in one shared workspace.
              </p>
            </div>
            <div className="platform-cta-actions">
              <Link href="/book-demo" className="btn btn-primary btn-lg">Book a demo →</Link>
              <Link href="/pricing" className="btn btn-outline btn-sm">View plans</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
