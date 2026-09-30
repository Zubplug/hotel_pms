"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

const modules = [
  { name: "Front desk", slug: "front-desk", label: "Stay orchestration", description: "Arrivals, departures, room assignment and guest service in one focused workspace.", image: "/lodgecore/front-desk.png" },
  { name: "Food & beverage", slug: "pos", label: "Connected commerce", description: "Keep every outlet, order and room charge connected to the guest journey.", image: "/lodgecore/f-and-b.png" },
  { name: "Events & groups", slug: "events", label: "Complex stays, simplified", description: "Coordinate spaces, packages and group operations without losing the detail.", image: "/lodgecore/events.png" },
];

const foundations = [
  ["01", "One operational picture", "Reservations, rooms, guests, payments and teams share the same source of truth."],
  ["02", "Built for real connectivity", "Keep critical workflows moving through the realities of hotel operations and local infrastructure."],
  ["03", "Ready to grow with you", "Start with the core and connect the modules, properties and partners your business needs next."],
];

const integrations = ["Paystack", "Flutterwave", "Booking.com", "Expedia", "WhatsApp", "Dormakaba", "Salto", "Open APIs"];

export default function WebsiteHome() {
  const [activeModule, setActiveModule] = useState(0);
  const [plans, setPlans] = useState<{ name: string; description: string | null }[]>([]);
  const current = modules[activeModule];

  useEffect(() => {
    fetch("/api/catalog").then((response) => response.ok ? response.json() : null).then((data) => setPlans(data?.plans ?? [])).catch(() => undefined);
  }, []);

  return (
    <main className="site-shell">
      <PublicHeader />

      <section className="hero-section">
        <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="status-pill"><span /> The hotel operating system</div>
            <h1>Make every stay <em>feel effortless.</em></h1>
            <p className="hero-lede">LodgeCore gives modern hotels one intelligent place to run the property, empower the team and create a better guest experience.</p>
            <div className="hero-actions"><Link href="/book-demo" className="button button-primary">See LodgeCore in action <span>↗</span></Link><a href="#platform" className="button button-quiet">Explore the platform <span>↓</span></a></div>
            <div className="hero-note"><span className="avatar-stack"><i /><i /><i /></span><span>Designed for the people who keep hospitality moving.</span></div>
          </div>
          <div className="hero-product" aria-label="LodgeCore product preview">
            <div className="product-chrome"><span className="window-dots"><i /><i /><i /></span><span className="product-breadcrumb">LodgeCore / Overview</span><span className="live-indicator"><i /> Workspace preview</span></div>
            <div className="product-body">
              <aside className="product-sidebar"><div className="mini-logo">L<span>c</span></div><div className="side-line active" /><div className="side-line" /><div className="side-line" /><div className="side-line" /><div className="side-spacer" /><div className="side-line" /></aside>
              <div className="product-main"><div className="product-top"><div><small>WORKSPACE PREVIEW</small><h3>Property overview</h3></div><div className="property-switcher">Your property <span>⌄</span></div></div><div className="overview-grid"><div className="overview-card accent"><small>PROPERTY PULSE</small><strong>In rhythm</strong><p>See what needs attention at a glance</p><div className="pulse-line"><i /><i /><i /><i /><i /><i /><i /></div></div><div className="overview-card"><small>TEAM FOCUS</small><strong>One <span>shared view</span></strong><p>Across every department</p><div className="task-bars"><i /><i /><i /><i /></div></div></div><div className="activity-card"><div className="activity-heading"><span>Today at a glance</span><small>View workspace ↗</small></div><div className="activity-row"><b>Front desk</b><span>Guest journey</span><em>Ready</em></div><div className="activity-row"><b>Housekeeping</b><span>Room readiness</span><em>In progress</em></div><div className="activity-row"><b>Finance</b><span>Daily close</span><em>On track</em></div></div></div>
            </div>
            <div className="product-footnote"><span>●</span> A single source of truth for your property</div>
          </div>
        </div>
        <div className="scroll-cue">Scroll to explore <span>↓</span></div>
      </section>

      <section className="logo-strip"><p>Built around the way great properties operate</p><div><span>INDEPENDENT HOTELS</span><span>RESORTS</span><span>BOUTIQUES</span><span>SERVICED APARTMENTS</span><span>HOTEL GROUPS</span></div></section>

      <section id="platform" className="section section-intro"><div className="section-kicker">The LodgeCore approach</div><h2>Less system noise.<br /><em>More room for hospitality.</em></h2><p className="section-lede">The best hotel teams do not need more tabs to manage. They need a connected operating layer that makes the next right action obvious.</p><div className="foundation-grid">{foundations.map(([number, title, body]) => <article className="foundation-card" key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p><Link href="/platform/pms">Learn more <b>↗</b></Link></article>)}</div></section>

      <section id="product" className="section modules-section"><div className="module-heading"><div><div className="section-kicker">The platform</div><h2>One calm command centre<br /><em>for the whole property.</em></h2></div><p>Purpose-built workspaces for every team, connected by one shared guest and operational record.</p></div><div className="module-tabs" role="tablist" aria-label="LodgeCore workspaces">{modules.map((module, index) => <button key={module.name} role="tab" aria-selected={index === activeModule} onClick={() => setActiveModule(index)} className={index === activeModule ? "active" : ""}><span>0{index + 1}</span>{module.name}</button>)}</div><div className="module-showcase"><div className="module-copy"><div className="module-index">0{activeModule + 1} / 03</div><div className="section-kicker">{current.label}</div><h3>{current.name}</h3><p>{current.description}</p><Link href={`/platform/${current.slug}`} className="text-link">Explore {current.name} <span>↗</span></Link><div className="module-rule" /><p className="module-caption">A focused workspace for faster decisions and fewer handoffs.</p></div><div className="module-image"><Image src={current.image} alt={`${current.name} workspace`} fill sizes="(max-width: 900px) 100vw, 60vw" priority={activeModule === 0} /></div></div></section>

      <section className="section dark-panel"><div className="dark-panel-grid"><div><div className="section-kicker">The connected stay</div><h2>Every handoff is a chance to make the stay <em>better.</em></h2><p>From the first booking signal to the final folio, LodgeCore keeps teams aligned around the guest—not the gaps between systems.</p><Link href="/platform/pms" className="button button-outline">See how it connects <span>↗</span></Link></div><div className="journey-card"><div className="journey-label">One guest journey · many teams</div><div className="journey-map"><div className="journey-line" />{["Book", "Prepare", "Welcome", "Serve", "Close"].map((step, index) => <div className="journey-node" key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b><small>{["Booking engine", "Housekeeping", "Front desk", "F&B + guest care", "Folio + finance"][index]}</small></div>)}</div><div className="journey-foot"><span>Every team sees the same stay.</span><span className="journey-foot-dot" /> <span>Every action moves it forward.</span></div></div></div></section>

      <section className="section image-band"><div className="image-band-copy"><div className="section-kicker">The physical hotel</div><h2>Digital clarity.<br /><em>Human hospitality.</em></h2><p>Bring your rooms, locks, outlets, payments and people into the same operational rhythm—without asking your team to become system administrators.</p><Link href="/hardware" className="text-link">Explore hardware & integrations <span>↗</span></Link></div><div className="image-band-visual"><Image src="/lodgecore/events.png" alt="LodgeCore hotel operations workspace" fill sizes="(max-width: 900px) 100vw, 50vw" /></div></section>

      <section id="integrations" className="section integrations-section"><div className="integration-heading"><div className="section-kicker">Open by design</div><h2>Your hotel ecosystem,<br /><em>finally in sync.</em></h2><p>Connect the tools you rely on today—and the ones you will need tomorrow. LodgeCore is designed to extend, not isolate, your operation.</p><Link href="/integrations" className="text-link">View all integrations <span>↗</span></Link></div><div className="integration-cloud">{integrations.map((item, index) => <div className="integration-chip" key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</div>)}<div className="integration-core">L<span>c</span><b>+ your stack</b></div></div></section>

      <section id="pricing" className="section cta-section"><div className="cta-glow" /><div className="section-kicker">A better way to run the property</div><h2>Give your team<br /><em>the clear way forward.</em></h2><p>See what a connected operating system can do for your property.</p><div className="hero-actions"><Link href="/book-demo" className="button button-primary">Book a tailored demo <span>↗</span></Link><Link href="/pricing" className="button button-outline">View plans {plans.length > 0 ? `(${plans.length})` : ""} <span>↗</span></Link></div></section>
    </main>
  );
}
