import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import Link from "next/link";

/* Sub-page content map for all hospitality modules */
const PAGES: Record<string, {
  title: string;
  desc: string;
  metaTitle: string;
  metaDesc: string;
  features: string[];
  related: { href: string; label: string }[];
}> = {
  pms: {
    title: "Property Management System",
    desc: "The complete PMS for hotels, resorts and serviced apartments. Manage reservations, rooms, guests, folios and operations from one connected platform.",
    metaTitle: "Hotel PMS — LodgeCore Property Management System",
    metaDesc: "LodgeCore PMS manages reservations, rooms, guests and operations for hotels and resorts. Integrated with POS, access control and smart rooms.",
    features: [
      "Reservation management with rate and availability control",
      "Walk-in, group, corporate and agent bookings",
      "Guest profiles with history and preferences",
      "Room allocation, upgrades and interconnecting rooms",
      "Check-in and check-out with ID verification",
      "Folio management, billing and payment processing",
      "Automated night audit and daily financial close",
      "Multi-currency, multi-tax and multi-rate support",
      "Housekeeping and maintenance integration",
      "Business intelligence and management reports",
    ],
    related: [
      { href: "/hospitality/pos", label: "Point of Sale" },
      { href: "/hospitality/booking", label: "Booking Engine" },
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/hospitality/accounting", label: "Finance & Accounting" },
    ],
  },
  pos: {
    title: "Point of Sale",
    desc: "Restaurant, bar, spa and retail POS connected directly to the PMS. Every transaction posts instantly to the guest folio — no manual reconciliation.",
    metaTitle: "Hotel POS — LodgeCore Point of Sale",
    metaDesc: "LodgeCore POS connects restaurant, bar and retail operations to the hotel PMS with automatic folio posting and kitchen display integration.",
    features: [
      "Table management and reservation integration",
      "Kitchen display and order routing",
      "Automatic folio posting from any outlet",
      "Split bills, service charges and covers",
      "Inventory deduction and stock tracking",
      "Multiple payment methods and settlement types",
      "Recipe costing and menu management",
      "Revenue reporting by outlet and category",
      "Handheld and mobile ordering support",
      "Integration with accounting and finance",
    ],
    related: [
      { href: "/hospitality/pms", label: "Property Management" },
      { href: "/hospitality/inventory", label: "Inventory" },
      { href: "/hospitality/accounting", label: "Finance" },
    ],
  },
  booking: {
    title: "Booking Engine",
    desc: "Direct online booking with real-time availability, rate management and OTA channel synchronisation. Reduce commissions and increase direct revenue.",
    metaTitle: "Hotel Booking Engine — LodgeCore Direct Booking",
    metaDesc: "LodgeCore booking engine enables direct online hotel bookings with rate parity, OTA channel manager and payment integration.",
    features: [
      "Real-time availability and rate display",
      "Promotional codes, packages and add-ons",
      "Multi-language and multi-currency support",
      "Channel manager with OTA synchronisation",
      "Rate parity monitoring and auto-adjustment",
      "Corporate booking portal and negotiated rates",
      "Mobile-optimised booking flow",
      "Email confirmation and pre-arrival communication",
      "PMS integration for instant reservation creation",
      "Revenue management and demand forecasting",
    ],
    related: [
      { href: "/hospitality/pms", label: "Property Management" },
      { href: "/integrations", label: "Integrations" },
    ],
  },
  accounting: {
    title: "Finance & Accounting",
    desc: "Complete hospitality accounting — folios, invoicing, payroll, cash management, general ledger and financial reporting for hotels of all sizes.",
    metaTitle: "Hotel Accounting Software — LodgeCore Finance",
    metaDesc: "LodgeCore Finance handles folios, invoicing, payroll, accounts payable/receivable and financial reporting for hospitality businesses.",
    features: [
      "Chart of accounts and general ledger",
      "Accounts payable and receivable",
      "Payroll and staff management",
      "Night audit and daily financial close",
      "City ledger and corporate account billing",
      "Tax management and VAT reporting",
      "Bank reconciliation and cash management",
      "Budget vs. actual reporting",
      "Multi-property consolidated accounts",
      "Audit trail and financial controls",
    ],
    related: [
      { href: "/hospitality/pms", label: "Property Management" },
      { href: "/hospitality/pos", label: "Point of Sale" },
      { href: "/hospitality/inventory", label: "Inventory" },
    ],
  },
  housekeeping: {
    title: "Housekeeping",
    desc: "Room readiness tracking, task assignment, laundry management and maintenance request coordination — all integrated with the PMS room status.",
    metaTitle: "Hotel Housekeeping Software — LodgeCore",
    metaDesc: "LodgeCore Housekeeping manages room readiness, attendant assignments, laundry and maintenance with real-time PMS room status integration.",
    features: [
      "Real-time room status tracking",
      "Attendant task assignment and tracking",
      "Mobile housekeeping app for attendants",
      "Laundry management and linen tracking",
      "Lost & found management",
      "Maintenance and engineering requests",
      "Inspection checklists and quality control",
      "Departure and arrival room management",
      "Guest special requests and preferences",
      "Integration with smart room energy systems",
    ],
    related: [
      { href: "/hospitality/pms", label: "Property Management" },
      { href: "/smart/smart-hotel", label: "Smart Hotel Rooms" },
    ],
  },
  inventory: {
    title: "Inventory & Procurement",
    desc: "Stock control, purchase orders, supplier management and food cost analysis for hotel F&B, housekeeping and maintenance operations.",
    metaTitle: "Hotel Inventory Management — LodgeCore",
    metaDesc: "LodgeCore Inventory manages stock, purchase orders and supplier relationships for hotel F&B, housekeeping and procurement.",
    features: [
      "Multi-store inventory management",
      "Purchase order creation and approval workflow",
      "Supplier management and price comparison",
      "Recipe costing and yield management",
      "Stock count and variance reporting",
      "Automatic reorder points and alerts",
      "Goods received and invoice matching",
      "Food cost analysis and menu engineering",
      "Housekeeping and linen stock management",
      "Integration with POS for automatic deductions",
    ],
    related: [
      { href: "/hospitality/pos", label: "Point of Sale" },
      { href: "/hospitality/accounting", label: "Finance" },
    ],
  },
  events: {
    title: "Events & Banqueting",
    desc: "Conference room management, event booking, function sheets, wedding coordination and group billing — all integrated with the PMS.",
    metaTitle: "Hotel Events & Banqueting Software — LodgeCore",
    metaDesc: "LodgeCore Events manages conference bookings, function sheets, weddings and group events with PMS and billing integration.",
    features: [
      "Meeting room and event space management",
      "Event enquiry and booking management",
      "Function sheet and event order generation",
      "Wedding and social event coordination",
      "Group accommodation and room block management",
      "AV equipment and setup management",
      "Catering and menu selection",
      "Event billing and deposit management",
      "Post-event reporting and revenue tracking",
      "Integration with PMS and POS",
    ],
    related: [
      { href: "/hospitality/pms", label: "Property Management" },
      { href: "/hospitality/pos", label: "Point of Sale" },
    ],
  },
  "multi-property": {
    title: "Multi-Property Management",
    desc: "Centralised management for hotel groups, chains, portfolios and operators managing multiple properties from one platform.",
    metaTitle: "Multi-Property Hotel Management — LodgeCore",
    metaDesc: "LodgeCore Multi-Property enables hotel groups and chains to manage multiple properties from one centralised platform with consolidated reporting.",
    features: [
      "Centralised reservation and room management",
      "Property group management and hierarchy",
      "Cross-property guest profiles and history",
      "Consolidated financial and operational reporting",
      "Centralised rate and policy management",
      "Property-level and group-level access control",
      "Shared corporate accounts and city ledger",
      "Group transfers and inter-property bookings",
      "Brand standards compliance monitoring",
      "Scalable from 2 to 200+ properties",
    ],
    related: [
      { href: "/hospitality/pms", label: "Property Management" },
      { href: "/solutions/hotels", label: "Hotels & Resorts Solution" },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return {
    title: page?.metaTitle ?? "LodgeCore Hospitality",
    description: page?.metaDesc ?? "LodgeCore hospitality software for hotels and resorts.",
  };
}

export default async function HospitalitySubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];

  if (!page) {
    return (
      <PublicShell eyebrow="LodgeCore Hospitality" title="Coming Soon" description="This page is being prepared. Contact us to learn more.">
        <section className="section-gap">
          <div className="contain" style={{ textAlign: "center" }}>
            <Link href="/hospitality" className="btn btn-outline">← Back to Hospitality</Link>
          </div>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      eyebrow="LodgeCore Hospitality"
      title={page.title}
      description={page.desc}
    >
      {/* Feature list */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
            <div>
              <div className="section-kicker">Key Capabilities</div>
              <h2 className="section-title" style={{ fontSize: "1.8rem", marginBottom: 28 }}>What&apos;s Included.</h2>
              <div className="feature-list">
                {page.features.map((f) => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* CTA card */}
              <div className="portal-card">
                <div className="portal-card-title">See it in action</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
                  Book a personalised demo and we&apos;ll show you {page.title} running in a property similar to yours.
                </p>
                <Link href="/book-demo" className="btn btn-primary" style={{ border: "none", display: "block", textAlign: "center" }}>Book a demo →</Link>
              </div>
              {/* Related */}
              <div className="portal-card" style={{ background: "transparent", border: "1px solid var(--border)" }}>
                <div className="portal-card-title">Related</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {page.related.map((r) => (
                    <Link key={r.href} href={r.href} style={{ fontSize: 13, color: "var(--accent)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      {r.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Ready to Get Started?</h2>
          <p className="cta-body">Talk to the LodgeCore team about your property&apos;s requirements.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Book a demo →</Link>
            <Link href="/hospitality" className="btn btn-outline btn-lg">All modules</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}
