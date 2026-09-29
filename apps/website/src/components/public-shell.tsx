import Link from "next/link";

export function PublicHeader() {
  return <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><Link href="/" className="text-xl font-black tracking-tight text-[#07111f]">Lodge<span className="text-[#1677c8]">Core</span></Link><nav className="hidden gap-6 text-sm font-semibold text-slate-600 md:flex"><Link href="/platform/pms">Platform</Link><Link href="/hardware">Hardware</Link><Link href="/integrations">Integrations</Link><Link href="/pricing">Pricing</Link></nav><div className="flex items-center gap-4"><Link href="/portal" className="hidden text-sm font-semibold text-slate-600 sm:block">Sign in</Link><Link href="/book-demo" className="rounded-full bg-[#1677c8] px-4 py-2 text-sm font-bold text-white">Book a demo</Link></div></div></header>;
}

export function PublicFooter() {
  return <footer className="border-t border-slate-200 bg-[#07111f] px-6 py-12 text-slate-400"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row"><div><Link href="/" className="text-xl font-black text-white">Lodge<span className="text-sky-300">Core</span></Link><p className="mt-3 text-sm">Everything. One App.</p></div><div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-4"><Link href="/platform/pms">Platform</Link><Link href="/hardware">Hardware</Link><Link href="/integrations">Integrations</Link><Link href="/documentation">Documentation</Link><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></div></div><p className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-5 text-xs">© {new Date().getFullYear()} LodgeCore. Hospitality operations, connected.</p></footer>;
}

export function PublicShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f7fafc] text-[#07111f]"><PublicHeader /><section className="mx-auto max-w-7xl px-6 pb-16 pt-20 md:pt-28"><p className="eyebrow">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-5xl font-black leading-[.98] tracking-[-.06em] md:text-7xl">{title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{description}</p>{children}</section><PublicFooter /></main>;
}
