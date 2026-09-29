"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function PortalLogin() {
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(false);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false, callbackUrl: "/portal/dashboard" });
    if (!result?.ok) setError(true); else window.location.href = result.url || "/portal/dashboard";
  }
  return <main className="min-h-screen bg-[#07111f] px-6"><section className="mx-auto max-w-md py-32"><Link href="/" className="text-xl font-bold text-white">Lodge<span className="text-sky-300">Core</span></Link><h1 className="mt-12 text-4xl font-bold text-white">Customer login</h1><p className="mt-3 text-slate-400">Access your subscriptions, implementation and support workspace.</p><form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-7"><label className="block text-sm text-slate-300">Email<input required type="email" name="email" className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-white" /></label><label className="block text-sm text-slate-300">Password<input required type="password" name="password" className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-white" /></label><button className="w-full rounded-full bg-sky-300 px-5 py-3 text-sm font-bold text-[#07111f]">Sign in</button>{error && <p className="text-sm text-rose-300">Invalid credentials or account access is unavailable.</p>}</form></section></main>;
}
