import Link from "next/link";

const pages: Record<string, [string, string]> = {
  security: ["Security", "Protecting hotel operations with encryption, audit logging, role-based access and resilient backups."],
  privacy: ["Privacy policy", "Learn how LodgeCore handles personal and operational data."],
  terms: ["Terms of service", "The terms that govern use of LodgeCore services."],
  sla: ["Service level agreement", "Operational commitments, support response and service availability."],
  status: ["System status", "Current service health and platform availability."],
  about: ["About LodgeCore", "Hotel technology built around the way hospitality teams actually work."],
  careers: ["Careers", "Help us build the operating system for modern hotels."],
  partners: ["Partners", "Work with LodgeCore as an implementation, hardware or referral partner."],
  "case-studies": ["Customer stories", "See how hotel teams use LodgeCore to operate with more clarity."],
  resources: ["Resources", "Guides, articles and practical hotel operations knowledge."],
  help: ["Help centre", "Find answers and get support for your LodgeCore workspace."],
  documentation: ["Documentation", "Product and implementation documentation for LodgeCore teams."],
  api: ["Developer platform", "Build on LodgeCore with APIs, webhooks and secure credentials."],
  contact: ["Contact LodgeCore", "Tell us what your property needs and our team will respond."],
  "start-trial": ["Start a trial", "Explore LodgeCore with a guided trial for your property."],
  "request-quote": ["Request a quote", "Tell us about your operation and receive a tailored proposal."],
  hardware: ["Hotel hardware", "E-locks, key-card systems, POS hardware and deployment support."],
};

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const [title, description] = pages[(await params).slug] || ["LodgeCore", "Connected hotel operations from one intelligent platform."];
  return <main className="min-h-screen bg-[#07111f] px-6"><header className="mx-auto flex max-w-7xl items-center justify-between py-6"><Link href="/" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><Link href="/book-demo" className="rounded-full bg-sky-300 px-4 py-2 text-sm font-bold text-[#07111f]">Talk to sales</Link></header><section className="mx-auto max-w-5xl py-24"><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">LodgeCore</p><h1 className="mt-5 text-6xl font-bold tracking-tight text-white">{title}</h1><p className="mt-6 max-w-2xl text-xl leading-8 text-slate-400">{description}</p><div className="mt-12 rounded-2xl border border-white/10 bg-white/[.04] p-7 text-sm leading-7 text-slate-300">This page is connected to the LodgeCore platform and will contain the published policy, documentation or service information for this area.</div></section></main>;
}
