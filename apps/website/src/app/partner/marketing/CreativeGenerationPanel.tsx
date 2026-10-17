"use client";

import { useEffect, useState } from "react";

type Campaign = { id: string; name: string; propertyName: string };
type Job = { id: string; template: string; status: string; outputUrl?: string | null; errorMessage?: string | null; createdAt: string; property?: { name: string }; campaign?: { name: string } | null };

export function CreativeGenerationPanel({ campaigns }: { campaigns: Campaign[] }) {
  const [template, setTemplate] = useState("SQUARE");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || "");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => { const response = await fetch("/api/partner/marketing/jobs", { cache: "no-store" }); if (response.ok) setJobs((await response.json()).jobs); };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!jobs.some((job) => job.status === "QUEUED" || job.status === "PROCESSING")) return; const timer = window.setInterval(() => void load(), 3000); return () => window.clearInterval(timer); }, [jobs]);
  const generate = async () => { setBusy(true); try { await fetch("/api/partner/marketing/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, template, idempotencyKey: crypto.randomUUID() }) }); await load(); } finally { setBusy(false); } };
  const retry = async (id: string) => { await fetch(`/api/partner/marketing/jobs/${id}/retry`, { method: "POST" }); await load(); };
  return <div className="reach-card" style={{ marginTop: 18 }}><div className="reach-card-head"><div><h2>Create a campaign banner</h2><p>Critical text, commission and referral URLs are rendered from approved database values.</p></div></div><div className="reach-link-row" style={{ gap: 10, flexWrap: "wrap" }}><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} disabled={!campaigns.length}>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.propertyName} · {campaign.name}</option>)}</select><select value={template} onChange={(event) => setTemplate(event.target.value)}><option value="SQUARE">Square · 1080 × 1080</option><option value="STORY">Story · 1080 × 1920</option><option value="LANDSCAPE">Landscape · 1200 × 675</option></select><button className="reach-button" type="button" onClick={() => void generate()} disabled={busy || !campaignId}>{busy ? "Queueing…" : "Generate banner"}</button></div>{jobs.length > 0 && <div className="reach-link-list" style={{ marginTop: 18 }}>{jobs.map((job) => <div className="reach-link-card" key={job.id}><div className="reach-link-card-head"><h2>{job.property?.name || "Property"} · {job.template}</h2><span className={`reach-pill ${job.status === "COMPLETED" ? "success" : job.status === "FAILED" ? "pending" : ""}`}>{job.status}</span></div>{job.outputUrl && <img src={job.outputUrl} alt="Generated campaign banner" style={{ maxWidth: 320, width: "100%", borderRadius: 12, marginTop: 12 }} />}{job.errorMessage && <p className="reach-property-description">{job.errorMessage}</p>}<div className="reach-link-row" style={{ marginTop: 10 }}>{job.outputUrl && <><a className="reach-button secondary small" href={job.outputUrl} target="_blank" rel="noreferrer" download>Download</a><button className="reach-button secondary small" type="button" onClick={() => void navigator.clipboard.writeText(job.outputUrl || "")}>Copy link</button></>}{job.status === "FAILED" && <button className="reach-button secondary small" type="button" onClick={() => void retry(job.id)}>Retry</button>}</div></div>)}</div>}</div>;
}
