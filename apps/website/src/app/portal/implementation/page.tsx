"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";

type Project = {
  id: string;
  name?: string;
  status?: string;
  startDate?: string | null;
  targetGoLiveDate?: string | null;
  propertySetups: { id: string; status?: string; propertyName?: string }[];
  dataMigrations: { id: string; status?: string; type?: string }[];
  trainings: { id: string; status?: string; module?: string; scheduledDate?: string | null }[];
};

const statusClass: Record<string, string> = {
  COMPLETED: "badge-active",
  IN_PROGRESS: "badge-pending",
  PENDING: "badge-inactive",
  SCHEDULED: "badge-normal",
};

function phaseCount(items: { status?: string }[], done = "COMPLETED") {
  return `${items.filter((i) => i.status === done).length} / ${items.length}`;
}

export default function ImplementationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/implementation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setProjects(d?.projects ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Implementation</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            {loading ? "Loading…" : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {loading && (
        <div className="portal-empty" style={{ marginTop: 16 }}>
          <div className="portal-empty-icon">⏳</div>
          <div className="portal-empty-title">Loading projects…</div>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="portal-empty">
          <div className="portal-empty-icon">🚀</div>
          <div className="portal-empty-title">No implementation projects yet</div>
          <div className="portal-empty-body">
            Your LodgeCore implementation project will appear here once the team has created it.
            Contact support if you expected to see a project.
          </div>
        </div>
      )}

      {projects.map((proj) => (
        <div key={proj.id} className="impl-project">
          <div className="impl-project-header">
            <div>
              <div className="impl-project-name">{proj.name ?? "Implementation project"}</div>
              {proj.startDate && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Started {new Date(proj.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {proj.targetGoLiveDate && (
                    <> · Target go-live {new Date(proj.targetGoLiveDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                  )}
                </div>
              )}
            </div>
            <span className={`portal-badge ${statusClass[proj.status ?? ""] ?? "badge-pending"}`}>
              {proj.status ?? "In progress"}
            </span>
          </div>

          <div className="impl-phase-grid">
            <div className="impl-phase">
              <div className="impl-phase-label">Property setup</div>
              <div className="impl-phase-value">{phaseCount(proj.propertySetups)}</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {proj.propertySetups.slice(0, 4).map((ps) => (
                  <div key={ps.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {ps.propertyName ?? "Property"}
                    </span>
                    <span className={`portal-badge ${statusClass[ps.status ?? ""] ?? "badge-inactive"}`} style={{ fontSize: 8 }}>
                      {ps.status ?? "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="impl-phase">
              <div className="impl-phase-label">Data migration</div>
              <div className="impl-phase-value">{phaseCount(proj.dataMigrations)}</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {proj.dataMigrations.slice(0, 4).map((dm) => (
                  <div key={dm.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {dm.type ?? "Migration"}
                    </span>
                    <span className={`portal-badge ${statusClass[dm.status ?? ""] ?? "badge-inactive"}`} style={{ fontSize: 8 }}>
                      {dm.status ?? "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="impl-phase">
              <div className="impl-phase-label">Training</div>
              <div className="impl-phase-value">{phaseCount(proj.trainings)}</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {proj.trainings.slice(0, 4).map((tr) => (
                  <div key={tr.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {tr.module ?? "Module"}
                      {tr.scheduledDate && (
                        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                          {" "}{new Date(tr.scheduledDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </span>
                    <span className={`portal-badge ${statusClass[tr.status ?? ""] ?? "badge-inactive"}`} style={{ fontSize: 8 }}>
                      {tr.status ?? "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Contact prompt */}
      <div className="portal-card" style={{ marginTop: 16, background: "transparent", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="portal-card-title" style={{ marginBottom: 4 }}>Questions about your implementation?</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Your implementation team is reachable through the support channel.</p>
        </div>
        <a href="/portal/support" className="btn btn-outline btn-sm">Open a ticket →</a>
      </div>
    </PortalShell>
  );
}
