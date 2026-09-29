"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

function Button({ children, secondary = false, href = "/book-demo" }: { children: React.ReactNode; secondary?: boolean; href?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 ${secondary ? "border border-slate-300/30 text-white hover:border-sky-300" : "bg-sky-400 text-white hover:bg-white"}`}>
      {children}
    </Link>
  );
}

// Data for interactive tabs
const productViews = {
  "Front Desk": {
    title: "Front Desk Operations",
    desc: "Manage arrivals, departures, and current guests in real time.",
    content: (
      <div className="grid gap-4 md:grid-cols-2 p-5">
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10">
          <p className="text-xs uppercase text-slate-400 mb-3">Room Rack</p>
          {["101 · VIP Arrival", "102 · Occupied", "103 · Due Out", "104 · Dirty"].map((r, i) => (
            <div key={r} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 text-sm">
              <span>{r}</span>
              <span className={`text-[10px] px-2 py-1 rounded ${i === 1 ? 'bg-sky-500/20 text-sky-300' : 'bg-white/5'}`}>Action</span>
            </div>
          ))}
        </div>
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10">
          <p className="text-xs uppercase text-slate-400 mb-3">Quick Actions</p>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 bg-white/5 rounded text-sm hover:bg-white/10">Check-in Guest</button>
            <button className="w-full text-left px-3 py-2 bg-white/5 rounded text-sm hover:bg-white/10">Process Payment</button>
            <button className="w-full text-left px-3 py-2 bg-white/5 rounded text-sm hover:bg-white/10">Print Registration</button>
          </div>
        </div>
      </div>
    )
  },
  "Reservations": {
    title: "Reservations & Booking",
    desc: "Centralized view of all channels, direct bookings, and groups.",
    content: (
      <div className="p-5">
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10 mb-4 flex justify-between">
          <div><p className="text-xs text-slate-400">Total Today</p><p className="text-xl font-bold">24</p></div>
          <div><p className="text-xs text-slate-400">Direct</p><p className="text-xl font-bold text-sky-400">42%</p></div>
          <div><p className="text-xs text-slate-400">OTA</p><p className="text-xl font-bold">58%</p></div>
        </div>
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10">
          <p className="text-xs uppercase text-slate-400 mb-2">Rate Calendar Overview</p>
          <div className="flex gap-2 h-16 items-end">
            {[40, 60, 50, 80, 90, 70, 50].map((h, i) => (
              <div key={i} className="flex-1 bg-sky-500/40 rounded-t" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  "POS": {
    title: "Point of Sale",
    desc: "Restaurant and bar operations fully synced with guest folios.",
    content: (
      <div className="grid gap-4 md:grid-cols-[1fr_200px] p-5">
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10">
          <p className="text-xs uppercase text-slate-400 mb-3">Menu / Items</p>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-white/5 h-16 rounded flex items-center justify-center text-xs">Item {i}</div>)}
          </div>
        </div>
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10 flex flex-col">
          <p className="text-xs uppercase text-slate-400 mb-2">Current Check</p>
          <div className="flex-1 border-y border-white/5 my-2 py-2 text-xs space-y-1">
            <div className="flex justify-between"><span>Item 1</span><span>$12</span></div>
            <div className="flex justify-between"><span>Item 4</span><span>$8</span></div>
          </div>
          <button className="w-full bg-sky-500 text-white rounded py-2 text-xs font-bold mt-auto">Post to Room</button>
        </div>
      </div>
    )
  },
  "Housekeeping": {
    title: "Housekeeping",
    desc: "Room status, task assignment, and maintenance tracking.",
    content: (
      <div className="p-5 grid gap-4">
        <div className="flex gap-4">
          <div className="flex-1 bg-[#122436] rounded-xl p-4 border border-emerald-500/30 text-center"><p className="text-2xl text-emerald-400 font-bold">126</p><p className="text-xs text-slate-400">Ready</p></div>
          <div className="flex-1 bg-[#122436] rounded-xl p-4 border border-sky-500/30 text-center"><p className="text-2xl text-sky-400 font-bold">12</p><p className="text-xs text-slate-400">Cleaning</p></div>
          <div className="flex-1 bg-[#122436] rounded-xl p-4 border border-orange-500/30 text-center"><p className="text-2xl text-orange-400 font-bold">6</p><p className="text-xs text-slate-400">Maintenance</p></div>
        </div>
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10">
          <p className="text-xs uppercase text-slate-400 mb-2">Task Board</p>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span>Room 306 - Full Clean</span><span className="text-sky-300">In Progress</span></div>
            <div className="flex justify-between"><span>Room 412 - Fix AC</span><span className="text-orange-300">Pending</span></div>
          </div>
        </div>
      </div>
    )
  },
  "Accounting": {
    title: "Accounting & Folios",
    desc: "City ledgers, AR, and night audit orchestration.",
    content: (
      <div className="p-5">
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10 mb-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs uppercase text-slate-400">Ledger Overview</p>
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded">Reconciled</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-slate-400 text-xs">Guest Ledger</p><p className="text-lg">₦1.2m</p></div>
            <div><p className="text-slate-400 text-xs">City Ledger</p><p className="text-lg">₦2.1m</p></div>
          </div>
        </div>
      </div>
    )
  },
  "Analytics": {
    title: "Reporting & Analytics",
    desc: "Deep insights into RevPAR, ADR, and operational efficiency.",
    content: (
      <div className="p-5">
        <div className="bg-[#122436] rounded-xl p-4 border border-white/10 h-48 flex flex-col justify-between">
          <div className="flex justify-between">
            <div><p className="text-slate-400 text-xs">RevPAR</p><p className="text-xl font-bold">₦69,700</p></div>
            <div><p className="text-slate-400 text-xs">ADR</p><p className="text-xl font-bold">₦82,400</p></div>
          </div>
          <div className="flex items-end gap-2 h-20 mt-4 border-b border-white/10 pb-2">
             {[4,7,5,8,6,9,10,8].map((h,i) => <div key={i} className="flex-1 bg-sky-400 rounded-t" style={{height: `${h}0%`}}></div>)}
          </div>
        </div>
      </div>
    )
  }
};

export default function WebsiteHome() {
  const [activeTab, setActiveTab] = useState<keyof typeof productViews>("Front Desk");
  const [plans, setPlans] = useState<{ name: string; description: string | null }[]>([]);

  useEffect(() => { 
    fetch("/api/catalog")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setPlans(d?.plans ?? []))
      .catch(() => undefined); 
  }, []);

  const currentView = productViews[activeTab];

  return (
    <main className="home-shell overflow-hidden">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061321]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="text-xl font-black tracking-tight text-white">
            Lodge<span className="text-[#1677c8]">Core</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#platform" className="hover:text-[#1677c8] transition-colors">Platform</a>
            <a href="#product" className="hover:text-[#1677c8] transition-colors">Product</a>
            <a href="#integrations" className="hover:text-[#1677c8] transition-colors">Integrations</a>
            <a href="#pricing" className="hover:text-[#1677c8] transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/portal" className="hidden text-sm font-bold text-[#07111f] sm:block hover:text-[#1677c8] transition-colors">Sign in</Link>
            <Button>Book a demo</Button>
          </div>
        </div>
      </header>

      {/* 01 HERO */}
      <section className="dark-section pt-20 pb-24 lg:pt-28">
        <div className="hero-grid mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 rounded-3xl overflow-hidden">
          <div className="py-12">
            <p className="eyebrow">The hotel operating platform</p>
            <h1 className="hero-title mt-4">Everything your hotel needs to operate.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#AAB8C8]">
              LodgeCore connects your front desk, rooms, restaurants, reservations, payments, finance, guests and hotel hardware in one powerful enterprise platform.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button>Book a demo</Button>
              <Button secondary href="#platform">Explore the platform</Button>
            </div>
            <p className="mt-7 text-sm font-medium text-slate-400">
              Built for modern hotels. Designed for uninterrupted operations.
            </p>
          </div>
          <div className="command-window">
            <div className="cmd-sidebar">
              <div className="cmd-sidebar-header">Lodge<span>Core</span></div>
              <div className="cmd-nav">
                <div className="cmd-nav-item">Dashboard</div>
                <div className="cmd-nav-item active">Front Desk</div>
                <div className="cmd-nav-item">Reservations</div>
                <div className="cmd-nav-item">Rooms</div>
                <div className="cmd-nav-item">POS</div>
                <div className="cmd-nav-item">F&B</div>
                <div className="cmd-nav-item">Housekeeping</div>
                <div className="cmd-nav-item">Accounting</div>
              </div>
            </div>
            <div className="cmd-main">
              <div className="cmd-topbar">
                <div>Today's Operations · 09:42 AM</div>
                <div className="cmd-status">All systems live</div>
              </div>
              <div className="cmd-content">
                <div className="cmd-stats">
                  <div className="cmd-stat-box"><span>Occupancy</span><strong>78%</strong></div>
                  <div className="cmd-stat-box"><span>Arrivals</span><strong>24</strong></div>
                  <div className="cmd-stat-box"><span>Departures</span><strong>18</strong></div>
                  <div className="cmd-stat-box"><span>Revenue</span><strong>₦4.82m</strong></div>
                </div>
                <div className="cmd-rack">
                  <div className="cmd-rack-header">Room Rack / Activity</div>
                  <div className="cmd-rack-row"><div className="cmd-room">201</div><div className="cmd-guest">Michael O. - Check in</div><div className="cmd-status-badge bg-ready">Ready</div></div>
                  <div className="cmd-rack-row"><div className="cmd-room">202</div><div className="cmd-guest">Sarah K. - In House</div><div className="cmd-status-badge bg-occ">Occupied</div></div>
                  <div className="cmd-rack-row"><div className="cmd-room">203</div><div className="cmd-guest">AC Repair</div><div className="cmd-status-badge bg-maint">Maint</div></div>
                  <div className="cmd-rack-row"><div className="cmd-room">204</div><div className="cmd-guest">David L. - Check out</div><div className="cmd-status-badge bg-ready">Cleaning</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 HOTEL OPERATING SYSTEM */}
      <section id="platform" className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="eyebrow">Hotel Operating System</p>
            <h2 className="section-title mx-auto text-white">One platform. Every department.</h2>
            <p className="section-copy mx-auto">
              LodgeCore replaces fragmented systems with a single, coherent architecture. Data flows seamlessly from the guest to the general ledger.
            </p>
          </div>
          <div className="arch-tree">
             <div className="arch-node">GUEST</div>
             <div className="arch-line"></div>
             <div className="arch-node">BOOKING ENGINE</div>
             <div className="arch-line"></div>
             <div className="arch-node core">LODGECORE</div>
             <div className="arch-line"></div>
             <div className="arch-split">
               <div className="arch-split-item"><div className="arch-node">FRONT DESK</div><div className="arch-line"></div><div className="arch-node">ROOMS</div></div>
               <div className="arch-split-item"><div className="arch-node">POS</div><div className="arch-line"></div><div className="arch-node">F&B</div></div>
               <div className="arch-split-item"><div className="arch-node">HOUSEKEEPING</div><div className="arch-line"></div><div className="arch-node">MAINTENANCE</div></div>
             </div>
             <div className="arch-line"></div>
             <div className="arch-node">FOLIO / PAYMENTS</div>
             <div className="arch-line"></div>
             <div className="arch-node">ACCOUNTING</div>
             <div className="arch-line"></div>
             <div className="arch-node">ANALYTICS</div>
          </div>
        </div>
      </section>

      {/* 03 PRODUCT */}
      <section id="product" className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow">See LodgeCore in action</p>
          <h2 className="section-title">Run the property from one place.</h2>
          <p className="section-copy">
            Purpose-built interfaces for the front desk, outlets, and back office. No more context switching between different apps.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {Object.keys(productViews).map((tab) => (
              <button 
                key={tab} 
                className={`tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab as keyof typeof productViews)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="product-screen mt-8">
            <div className="screen-top">
              <span>● LodgeCore</span>
              <span className="font-bold text-white">{activeTab}</span>
              <span>100% Online</span>
            </div>
            <div className="grid md:grid-cols-[1fr_2fr] gap-6">
              <div className="p-8 border-r border-white/10 bg-[#05101A]">
                <h3 className="text-2xl font-bold text-white mb-4">{currentView.title}</h3>
                <p className="text-[#AAB8C8] leading-relaxed">{currentView.desc}</p>
                <div className="mt-8 text-sm text-sky-400 font-bold flex items-center gap-2 cursor-pointer hover:text-white transition">
                  Explore feature <span aria-hidden="true">→</span>
                </div>
              </div>
              <div className="bg-[#091a2b]">
                {currentView.content}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04 GUEST JOURNEY */}
      <section className="dark-section-alt px-5 py-24 lg:px-8 border-y border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="eyebrow">Guest Journey</p>
            <h2 className="section-title">From booking to checkout.</h2>
            <p className="section-copy">
              A unified guest profile travels through every touchpoint, ensuring personalized service and accurate billing.
            </p>
          </div>
          <div className="journey mt-14">
            {["Booking Engine", "Reservation", "Front Desk", "E-lock / Key card", "Restaurant POS", "Housekeeping", "Payment + Accounting"].map((step, i) => (
              <div className="journey-step" key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{step}</b>
                {i < 6 && <i>→</i>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 OFFLINE-FIRST */}
      <section className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Offline-first operations</p>
            <h2 className="section-title">Your hotel doesn't stop when the internet does.</h2>
            <p className="section-copy">
              Internet drops shouldn't mean operational pauses. LodgeCore's desktop and POS modules keep essential functions alive offline, syncing automatically the second connectivity returns. This is a real differentiator for properties in developing regions.
            </p>
          </div>
          <div className="offline-container">
             <div className="offline-node">INTERNET CONNECTION</div>
             <div className="offline-arrow"><span>ONLINE</span><i></i>▼</div>
             <div className="offline-node active font-bold w-full">LODGECORE CLOUD</div>
             <div className="offline-arrow"><span>CONNECTION LOST</span><i></i>▼</div>
             <div className="offline-node mode w-full">
               <strong>OFFLINE MODE</strong>
               <ul>
                 <li>✓ Check-in / Check-out</li>
                 <li>✓ POS Transactions</li>
                 <li>✓ Room Operations</li>
                 <li>✓ Local Folio Postings</li>
               </ul>
             </div>
             <div className="offline-arrow"><span>CONNECTION RESTORED</span><i></i>▼</div>
             <div className="offline-node active font-bold w-full">SECURE SYNC</div>
          </div>
        </div>
      </section>

      {/* 06 HOTEL COMMERCE & 07 HOTEL OPERATIONS & 08 HOTEL FINANCE */}
      <section className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="eyebrow">The Complete Suite</p>
            <h2 className="section-title mx-auto text-white">Everything you need to sell, operate, and reconcile.</h2>
          </div>
          
          <div className="space-y-16">
            <div>
              <h3 className="text-2xl font-black text-white mb-6 border-b border-white/10 pb-4">Hotel Commerce</h3>
              <div className="grid-cards">
                <div className="card"><h3>Booking Engine</h3><p>Direct, commission-free reservations integrated instantly into your availability.</p></div>
                <div className="card"><h3>Channel Manager</h3><p>Two-way sync with OTAs (Booking.com, Expedia) to maximize distribution.</p></div>
                <div className="card"><h3>Payments</h3><p>Integrated payment gateways for deposits, card-on-file, and final settlements.</p></div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-white mb-6 border-b border-white/10 pb-4">Hotel Operations</h3>
              <div className="grid-cards">
                <div className="card"><h3>Front Desk</h3><p>Fast check-ins, room assignment, and full guest lifecycle management.</p></div>
                <div className="card"><h3>Housekeeping</h3><p>Mobile-friendly room status updates and maintenance ticketing.</p></div>
                <div className="card"><h3>POS & F&B</h3><p>Restaurant and bar point of sale, with instant room charge posting.</p></div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-white mb-6 border-b border-white/10 pb-4">Hotel Finance</h3>
              <div className="grid-cards">
                <div className="card"><h3>Folios & Cash</h3><p>Complex multi-folio routing, cash drawer management, and shift drops.</p></div>
                <div className="card"><h3>Accounts Receivable</h3><p>City ledger management and automated corporate invoicing.</p></div>
                <div className="card"><h3>Night Audit</h3><p>One-click day end routines with comprehensive financial reporting.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 09 PHYSICAL HOTEL */}
      <section className="dark-section-alt px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="eyebrow">Hardware integration</p>
            <h2 className="section-title">LodgeCore connects your digital hotel to the physical hotel.</h2>
            <p className="section-copy">
              Don't treat hardware as an afterthought. We provide seamless integration with e-locks and POS terminals, plus full lifecycle management from installation to maintenance.
            </p>
          </div>
          <div className="hardware-photo mt-12"><Image src="/lodgecore/events.png" alt="LodgeCore hotel events and spaces operations screen" fill sizes="100vw" /><div><span className="eyebrow">Physical hotel operations</span><strong>From configuration to go-live, every deployment step stays visible.</strong></div></div>
          <div className="hw-flow">
            <div className="hw-node">LodgeCore</div>
            <div className="hw-arrow">→</div>
            <div className="hw-node">Encoder</div>
            <div className="hw-arrow">→</div>
            <div className="hw-node">Key Card</div>
            <div className="hw-arrow">→</div>
            <div className="hw-node">E-Lock</div>
            <div className="hw-arrow">→</div>
            <div className="hw-node">Guest Room</div>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm text-[#AAB8C8] font-bold">
            <div>✓ Installation</div>
            <div>✓ Configuration</div>
            <div>✓ Commissioning</div>
            <div>✓ Staff training</div>
            <div>✓ Maintenance</div>
            <div>✓ Replacement</div>
          </div>
        </div>
      </section>

      {/* 10 MULTI-PROPERTY */}
      <section className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div>
            <p className="eyebrow">Multi-property control</p>
            <h2 className="section-title text-white">One platform for every property.</h2>
            <p className="section-copy">
              Centralize performance, finance and standards while each hotel keeps the tools it needs to operate day to day. Manage your entire portfolio from a single login.
            </p>
          </div>
          <div className="group-board shadow-xl">
            <div className="flex justify-between border-b border-[#31506F] pb-4 text-sm mb-4">
              <b className="text-white text-lg">LodgeCore Corporate</b>
              <span className="text-[#5CC9F5] font-bold px-3 py-1 bg-[#5CC9F5]/10 rounded-full">5 properties connected</span>
            </div>
            {[
              "Lagos · 84% occupancy · ₦4.8m",
              "Abuja · 78% occupancy · ₦3.2m",
              "Port Harcourt · 91% occupancy · ₦2.7m",
              "Accra · 82% occupancy · ₦3.9m",
              "Nairobi · 76% occupancy · ₦2.1m"
            ].map(x => (
              <div className="group-row hover:bg-white/5 px-2 transition-colors rounded" key={x}>
                <span className="text-[#AAB8C8]">{x.split('·')[0]}</span>
                <span className="text-white font-bold">{x.split('·')[1]}</span>
                <span className="text-emerald-400">{x.split('·')[2]}</span>
                <span className="text-sky-400 cursor-pointer">View property →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11 INTEGRATIONS */}
      <section id="integrations" className="dark-section-alt px-5 py-24 lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow">Marketplace</p>
          <h2 className="section-title text-white">Connect the systems you already use.</h2>
          <div className="integration-market mt-12">
            <div className="market-category">
              <h4>Payments</h4>
              <div className="market-item">Paystack</div>
              <div className="market-item">Flutterwave</div>
              <div className="market-item">Local Banks</div>
            </div>
            <div className="market-category">
              <h4>Distribution</h4>
              <div className="market-item">Beds24</div>
              <div className="market-item">Booking.com</div>
              <div className="market-item">Expedia</div>
            </div>
            <div className="market-category">
              <h4>Hardware</h4>
              <div className="market-item">Dormakaba</div>
              <div className="market-item">Salto</div>
              <div className="market-item">Xeeder</div>
            </div>
            <div className="market-category">
              <h4>Accounting</h4>
              <div className="market-item">Xero</div>
              <div className="market-item">QuickBooks</div>
              <div className="market-item">Sage</div>
            </div>
          </div>
        </div>
      </section>

      {/* 12 SECURITY & CONTROL */}
      <section className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl mb-12">
            <p className="eyebrow">Enterprise Trust</p>
            <h2 className="section-title">Built for critical hotel operations.</h2>
            <p className="section-copy">
              A hotel cannot afford software failure or data breaches. LodgeCore is built on a foundation of zero-trust security and financial control.
            </p>
          </div>
          <div className="trust-grid">
            {[
              {title: "Role-based access", desc: "Granular permissions for every staff member."},
              {title: "Audit trails", desc: "Every action, posting, and deletion is logged."},
              {title: "Offline operation", desc: "Critical modules survive internet outages."},
              {title: "Secure synchronization", desc: "Encrypted data sync when connectivity returns."},
              {title: "Data backups", desc: "Automated, redundant cloud backups."},
              {title: "Property isolation", desc: "Strict data siloing between hotel properties."},
              {title: "Financial controls", desc: "Shift drops, blind drops, and cash variance tracking."},
              {title: "Activity history", desc: "Trace changes back to the exact user and time."}
            ].map(f => (
              <div className="trust-item" key={f.title}>
                <strong>{f.title}</strong>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 13 PROPERTY TYPES */}
      <section className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow">Tailored for your business</p>
          <h2 className="section-title text-white mb-12">Designed for diverse hospitality models.</h2>
          <div className="image-feature-grid mb-12">
            <div className="image-feature"><Image src="/lodgecore/front-desk.png" alt="LodgeCore front desk operations screen" fill sizes="(max-width: 768px) 100vw, 50vw" /><span>Front desk operations</span></div>
            <div className="image-feature"><Image src="/lodgecore/f-and-b.png" alt="LodgeCore food and beverage analytics screen" fill sizes="(max-width: 768px) 100vw, 50vw" /><span>Restaurant and F&amp;B control</span></div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="prop-type">
              <h3>Luxury Hotels</h3>
              <p>Personalized guest profiles, VIP management, and high-touch service routing.</p>
            </div>
            <div className="prop-type">
              <h3>Resorts</h3>
              <p>Complex multi-outlet billing, activity scheduling, and group reservations.</p>
            </div>
            <div className="prop-type">
              <h3>Boutiques</h3>
              <p>Streamlined operations, aesthetic booking engines, and intimate guest tracking.</p>
            </div>
            <div className="prop-type">
              <h3>Serviced Apartments</h3>
              <p>Long-stay billing, recurring invoicing, and simplified housekeeping schedules.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 14 CUSTOMER PROOF */}
      <section className="dark-section-alt px-5 py-24 lg:px-8 border-y border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="eyebrow">Customer proof</p><h2 className="section-title text-white">Built to earn the trust of hotel teams.</h2><p className="section-copy">Customer stories, verified outcomes and implementation references will appear here as they are approved for publication.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {["Operations leadership", "Front desk teams", "Finance and ownership"].map((group) => <div className="proof-card" key={group}><p className="text-xs font-bold uppercase tracking-[.16em] text-[#1677c8]">Customer story slot</p><h3 className="mt-6 text-lg font-bold text-[#07111f]">{group}</h3><p className="mt-3 text-sm leading-6 text-slate-600">Verified testimonial and deployment outcome to be published after customer approval.</p><span className="mt-6 block text-xs font-bold text-[#1677c8]">Case study coming soon →</span></div>)}
          </div>
        </div>
      </section>

      {/* 15 PRICING */}
      <section id="pricing" className="dark-section px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <p className="eyebrow">SaaS Control Plane</p>
            <h2 className="section-title mx-auto text-white">Choose the plan that fits your property.</h2>
          </div>
          
          <div className="pricing-grid">
            <div className="pricing-card">
              <h3>Starter</h3>
              <p>Essential property management for independent hotels and motels.</p>
              <ul>
                <li>Core PMS</li>
                <li>Front Desk Operations</li>
                <li>Guest Management</li>
                <li>Basic Reporting</li>
              </ul>
              <Button secondary href="/pricing">View Plan</Button>
            </div>
            <div className="pricing-card professional">
              <h3>Professional</h3>
              <p>Full connected operations for growing properties and busy hotels.</p>
              <ul>
                <li>Everything in Starter</li>
                <li>Offline-first Operations</li>
                <li>Advanced Accounting</li>
                <li>Multi-user Roles</li>
                <li>Standard Integrations</li>
              </ul>
              <Button href="/pricing">View Plan</Button>
            </div>
            <div className="pricing-card">
              <h3>Enterprise</h3>
              <p>Multi-property capabilities, APIs, and dedicated infrastructure.</p>
              <ul>
                <li>Everything in Professional</li>
                <li>Multi-property Dashboard</li>
                <li>Custom API Access</li>
                <li>Dedicated Account Manager</li>
                <li>Custom SLA</li>
              </ul>
              <Button secondary href="/pricing">Contact Sales</Button>
            </div>
          </div>

          <div className="pricing-addons">
            <h4 className="font-bold text-white mb-4">Available Add-ons</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-[#AAB8C8]">
              <div>□ Point of Sale (POS)</div>
              <div>□ Channel Manager</div>
              <div>□ Booking Engine</div>
              <div>□ Advanced Events</div>
              <div>□ E-Lock Hardware Integration</div>
              <div>□ Additional Property Licenses</div>
              <div>□ Premium Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* 16 FINAL CTA */}
      <section className="dark-section px-5 py-28 text-center lg:px-8 border-t border-white/10">
        <p className="eyebrow">Ready when you are</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-5xl font-black tracking-[-.05em] text-white sm:text-7xl">
          Run your hotel with LodgeCore.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#AAB8C8]">
          One platform for rooms, reservations, restaurants, finance, guests, payments and operations.
        </p>
        <div className="mt-9 flex justify-center flex-wrap gap-4">
          <Button>Book a demo</Button>
          <Button secondary href="/start-trial">Start with LodgeCore</Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer px-5 py-12 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row">
          <div>
            <Link href="/" className="text-xl font-black text-white">Lodge<span className="text-[#5CC9F5]">Core</span></Link>
            <p className="mt-3 text-sm text-[#AAB8C8]">Everything. One App.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm text-[#AAB8C8] sm:grid-cols-4">
            <Link href="#platform" className="hover:text-white transition">Platform</Link>
            <Link href="#product" className="hover:text-white transition">Solutions</Link>
            <Link href="#hardware" className="hover:text-white transition">Hardware</Link>
            <Link href="/documentation" className="hover:text-white transition">Documentation</Link>
            <Link href="/help" className="hover:text-white transition">Help centre</Link>
            <Link href="/security" className="hover:text-white transition">Security</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-5 text-xs text-[#AAB8C8]">
          © {new Date().getFullYear()} LodgeCore. Hospitality operations, connected.
        </div>
      </footer>
    </main>
  );
}
