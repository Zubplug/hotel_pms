"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function BookDemoPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("sending");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, source: "BOOK_DEMO" }) });
    setState(response.ok ? "sent" : "error");
    if (response.ok) event.currentTarget.reset();
  }
  return <main className="min-h-screen bg-[#07111f] px-6"><header className="mx-auto flex max-w-7xl justify-between py-6"><Link href="/" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><Link href="/" className="text-sm text-slate-400">Back to website</Link></header><section className="mx-auto grid max-w-5xl gap-14 py-20 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">Start a conversation</p><h1 className="mt-5 text-5xl font-bold tracking-tight text-white">See LodgeCore in your operation.</h1><p className="mt-6 leading-7 text-slate-400">Tell us a little about your property. Our team will follow up with a tailored walkthrough.</p></div><form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-7">{[["name", "Full name", "text"], ["email", "Work email", "email"], ["company", "Company / property group", "text"], ["phone", "Phone number", "tel"], ["roomCount", "Number of rooms", "number"]].map(([name, label, type]) => <label key={name} className="block text-sm text-slate-300">{label}<input required={name === "name" || name === "email"} name={name} type={type} className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-white outline-none focus:border-sky-300" /></label>)}<label className="block text-sm text-slate-300">How can we help?<textarea name="message" rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-white outline-none focus:border-sky-300" /></label><label className="flex gap-3 text-xs leading-5 text-slate-400"><input required name="consent" type="checkbox" value="true" />I agree to LodgeCore using these details to contact me about its products and services.</label><button disabled={state === "sending"} className="w-full rounded-full bg-sky-300 px-5 py-3 text-sm font-bold text-[#07111f] disabled:opacity-60">{state === "sending" ? "Sending…" : "Request a demo"}</button>{state === "sent" && <p className="text-sm text-emerald-300">Thanks—we received your request.</p>}{state === "error" && <p className="text-sm text-rose-300">We could not submit your request. Please try again.</p>}</form></section></main>;
}
