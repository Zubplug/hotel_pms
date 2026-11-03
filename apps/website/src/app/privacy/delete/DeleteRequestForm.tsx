"use client";

import { FormEvent, useState } from "react";

export function DeleteRequestForm() {
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public/account-deletion/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        contact: form.get("contact"),
        reason: form.get("reason"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("error");
      setMessage(body.error?.message || body.message || "Unable to submit the request.");
      return;
    }
    setState("success");
    setMessage(body.data?.message || "Your request was sent to the property manager. No data has been deleted.");
    event.currentTarget.reset();
  }

  if (state === "success") {
    return <div style={{ padding: "18px 20px", border: "1px solid rgba(62,245,160,.28)", borderRadius: 14, background: "rgba(62,245,160,.07)", color: "var(--text-secondary)", lineHeight: 1.7 }}><strong style={{ color: "var(--mint)", display: "block", marginBottom: 6 }}>Request submitted for manager review</strong>{message}<br /><span style={{ fontSize: 12 }}>Your account and data remain unchanged while the property manager reviews the request.</span></div>;
  }

  return <form onSubmit={submit} style={{ display: "grid", gap: 14 }}><label className="form-group"><span className="form-label">Full name</span><input className="form-input" name="fullName" required minLength={2} placeholder="Your full name" /></label><label className="form-group"><span className="form-label">Account email or phone number</span><input className="form-input" name="contact" required placeholder="Email or phone registered to LodgeCore" /></label><label className="form-group"><span className="form-label">Reason <small style={{ color: "var(--text-muted)" }}>(optional)</small></span><textarea className="form-input" name="reason" rows={4} placeholder="Optional context for the property manager" style={{ resize: "vertical" }} /></label>{state === "error" && <p className="form-error">{message}</p>}<button className="btn btn-primary" disabled={state === "saving"}>{state === "saving" ? "Submitting request…" : "Submit for manager review →"}</button><p style={{ color: "var(--text-muted)", fontSize: 11, lineHeight: 1.6, margin: 0 }}>We use your registered email or phone to locate your active LodgeCore account and its property access. Submitting this form does not delete your account or any data.</p></form>;
}
