"use client";

import Link from "next/link";
import { useEffect, useState, FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";

type Ticket = {
  id: string;
  number: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  description: string;
};

const priorityClass: Record<string, string> = {
  URGENT: "badge-urgent",
  HIGH: "badge-high",
  NORMAL: "badge-normal",
  LOW: "badge-inactive",
};

const statusClass: Record<string, string> = {
  OPEN: "badge-active",
  IN_PROGRESS: "badge-pending",
  CLOSED: "badge-inactive",
  RESOLVED: "badge-inactive",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/portal/support");
    if (res.ok) {
      const d = await res.json();
      setTickets(d.tickets ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = {
      subject: fd.get("subject"),
      description: fd.get("description"),
      priority: fd.get("priority") || "NORMAL",
    };
    const res = await fetch("/api/portal/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
      setShowForm(false);
      load();
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  const open = tickets.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED");
  const closed = tickets.filter((t) => t.status === "CLOSED" || t.status === "RESOLVED");

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Support</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            {loading ? "Loading…" : `${open.length} open · ${closed.length} closed`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm((v) => !v); setSubmitted(false); }}>
          {showForm ? "Cancel" : "+ New ticket"}
        </button>
      </div>

      {/* New ticket form */}
      {showForm && (
        <div className="portal-card" style={{ marginBottom: 24 }}>
          <div className="portal-card-title">New support ticket</div>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--mint)" }}>
              ✓ Ticket submitted — we'll be in touch within one business day.
            </div>
          ) : (
            <form className="portal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="ticket-subject">Subject *</label>
                <input id="ticket-subject" name="subject" required className="form-input" placeholder="Describe the issue briefly" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ticket-description">Description *</label>
                <textarea id="ticket-description" name="description" required rows={5} className="form-input"
                  placeholder="Provide as much detail as possible — steps to reproduce, screenshots, expected vs actual behaviour…" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ticket-priority">Priority</label>
                <select id="ticket-priority" name="priority" className="portal-select">
                  <option value="LOW">Low — general question or feedback</option>
                  <option value="NORMAL" selected>Normal — issue affecting a workflow</option>
                  <option value="HIGH">High — blocking a team or department</option>
                  <option value="URGENT">Urgent — property operations stopped</option>
                </select>
              </div>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: "flex-start", border: "none" }}>
                {submitting ? "Submitting…" : "Submit ticket →"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Open tickets */}
      <div className="portal-card" style={{ padding: 0 }}>
        <div className="portal-card-title" style={{ padding: "20px 22px 0" }}>Open tickets</div>
        {loading && (
          <div style={{ padding: "32px 22px", color: "var(--text-muted)", fontSize: 13 }}>Loading tickets…</div>
        )}
        {!loading && open.length === 0 && (
          <div className="portal-empty" style={{ margin: "0 22px 22px" }}>
            <div className="portal-empty-icon">🎧</div>
            <div className="portal-empty-title">No open tickets</div>
            <div className="portal-empty-body">Everything is clear. Open a new ticket if you need help from the LodgeCore team.</div>
          </div>
        )}
        {open.map((t) => (
          <div key={t.id} className="portal-ticket">
            <div className="portal-ticket-num">{t.number}</div>
            <div>
              <div className="portal-ticket-subject">{t.subject}</div>
              <div className="portal-ticket-meta">
                {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span className={`portal-badge ${priorityClass[t.priority] || "badge-normal"}`}>{t.priority}</span>
              <span className={`portal-badge ${statusClass[t.status] || "badge-normal"}`}>{t.status.replace("_", " ")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Closed tickets */}
      {closed.length > 0 && (
        <div className="portal-card" style={{ padding: 0, marginTop: 16 }}>
          <div className="portal-card-title" style={{ padding: "20px 22px 0" }}>
            Resolved & closed
          </div>
          {closed.map((t) => (
            <div key={t.id} className="portal-ticket" style={{ opacity: .65 }}>
              <div className="portal-ticket-num">{t.number}</div>
              <div>
                <div className="portal-ticket-subject">{t.subject}</div>
                <div className="portal-ticket-meta">{new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
              <span className="portal-badge badge-closed">{t.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* SLA info */}
      <div className="portal-card" style={{ marginTop: 16, background: "transparent", border: "1px solid var(--border)" }}>
        <div className="portal-card-title" style={{ marginBottom: 12 }}>Support commitments</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {[
            { label: "Urgent response", value: "< 2 hours" },
            { label: "High response",   value: "< 8 hours" },
            { label: "Normal response", value: "1 business day" },
          ].map((row) => (
            <div key={row.label}>
              <div className="portal-stat-label">{row.label}</div>
              <div className="portal-stat-value" style={{ fontSize: "1.1rem" }}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
