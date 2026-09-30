"use client";

import { useEffect, useState, FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";

type Installation = {
  id: string;
  installationType: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  property?: { name: string } | null;
  inventory?: { deviceType?: string; serialNumber?: string } | null;
};

const statusClass: Record<string, string> = {
  COMPLETED: "badge-active",
  IN_PROGRESS: "badge-pending",
  PENDING: "badge-inactive",
  SCHEDULED: "badge-normal",
  CANCELLED: "badge-inactive",
};

export default function HardwarePage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formDone, setFormDone] = useState(false);

  async function load() {
    const res = await fetch("/api/portal/hardware");
    if (res.ok) { const d = await res.json(); setInstallations(d.installations ?? []); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/portal/hardware", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        installationType: fd.get("installationType"),
        notes: fd.get("notes") || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) { setFormDone(true); setShowForm(false); load(); }
    else setFormError("Something went wrong. Please try again.");
  }

  const pending = installations.filter((i) => i.status !== "COMPLETED" && i.status !== "CANCELLED");
  const done = installations.filter((i) => i.status === "COMPLETED" || i.status === "CANCELLED");

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Hardware</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            {loading ? "Loading…" : `${pending.length} pending · ${done.length} completed`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm((v) => !v); setFormDone(false); }}>
          {showForm ? "Cancel" : "+ Request installation"}
        </button>
      </div>

      {/* Request form */}
      {showForm && (
        <div className="portal-card" style={{ marginBottom: 24 }}>
          <div className="portal-card-title">Request hardware installation</div>
          <form className="portal-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="hw-type">Installation type *</label>
              <select id="hw-type" name="installationType" className="portal-select" required>
                <option value="">Select type…</option>
                <option value="Electronic locks">Electronic door locks</option>
                <option value="Key encoder">Key card encoder</option>
                <option value="POS terminal">POS terminal</option>
                <option value="Receipt printer">Receipt printer</option>
                <option value="Network access point">Network access point</option>
                <option value="CCTV / access control">CCTV / access control</option>
                <option value="Other">Other (describe in notes)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="hw-notes">Notes</label>
              <textarea id="hw-notes" name="notes" rows={3} className="form-input"
                placeholder="Property location, number of units, special requirements…" />
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: "flex-start", border: "none" }}>
              {submitting ? "Submitting…" : "Submit request →"}
            </button>
          </form>
        </div>
      )}

      {formDone && (
        <div className="portal-card" style={{ marginBottom: 16, color: "var(--mint)", fontSize: 13, padding: "16px 22px" }}>
          ✓ Installation request submitted — your LodgeCore team will follow up within one business day.
        </div>
      )}

      {/* Pending */}
      <div className="portal-card" style={{ padding: 0 }}>
        <div className="portal-card-title" style={{ padding: "20px 22px 0" }}>Pending & in-progress</div>
        {loading && <div style={{ padding: "32px 22px", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>}
        {!loading && pending.length === 0 && (
          <div className="portal-empty" style={{ margin: "0 22px 22px" }}>
            <div className="portal-empty-icon">🔧</div>
            <div className="portal-empty-title">No pending installations</div>
            <div className="portal-empty-body">Request a new hardware installation and the team will follow up to schedule it.</div>
          </div>
        )}
        {pending.map((inst) => (
          <div key={inst.id} className="portal-ticket">
            <div>
              <div className="portal-ticket-num" style={{ fontSize: 11 }}>
                {inst.inventory?.deviceType ?? inst.installationType}
              </div>
            </div>
            <div>
              <div className="portal-ticket-subject">{inst.installationType}</div>
              <div className="portal-ticket-meta">
                {inst.property?.name ?? "Property TBC"} ·{" "}
                {new Date(inst.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {inst.notes && <> · {inst.notes.slice(0, 60)}{inst.notes.length > 60 ? "…" : ""}</>}
              </div>
            </div>
            <span className={`portal-badge ${statusClass[inst.status] ?? "badge-inactive"}`}>
              {inst.status.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div className="portal-card" style={{ padding: 0, marginTop: 16 }}>
          <div className="portal-card-title" style={{ padding: "20px 22px 0" }}>Completed</div>
          {done.map((inst) => (
            <div key={inst.id} className="portal-ticket" style={{ opacity: .7 }}>
              <div className="portal-ticket-num" style={{ fontSize: 11 }}>{inst.installationType}</div>
              <div>
                <div className="portal-ticket-subject">{inst.property?.name ?? "Property"}</div>
                <div className="portal-ticket-meta">
                  {new Date(inst.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <span className="portal-badge badge-active">{inst.status}</span>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
