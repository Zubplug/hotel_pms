"use client";
import { FormEvent, useEffect, useState } from "react";

type Property = { id: string; name: string };
type Profile = { propertyId?: string; bankCode?: string; accountNumberLast4?: string; accountName?: string };
type Bank = { code: string; name: string };

export function PayoutSettingsForm({ properties, profile }: { properties: Property[]; profile: Profile }) {
  const [propertyId, setPropertyId] = useState(profile.propertyId || properties[0]?.id || "");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState(profile.bankCode || "");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(profile.accountName || "");
  const [verification, setVerification] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoadingBanks(true);
    setBanks([]);
    fetch(`/api/partner/payout-profile/verify?propertyId=${encodeURIComponent(propertyId)}`)
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => { if (!cancelled) { setBanks(response.ok ? data.banks || [] : []); if (!response.ok) setVerification(data.error || "Flutterwave is not configured for this property"); } })
      .catch(() => { if (!cancelled) setVerification("Unable to load this property's Flutterwave banks"); })
      .finally(() => { if (!cancelled) setLoadingBanks(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId || !bankCode || accountNumber.length !== 10) return;
    const timer = window.setTimeout(async () => {
      setVerification("Verifying account with Flutterwave…");
      setAccountName("");
      const response = await fetch("/api/partner/payout-profile/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId, bankCode, accountNumber }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) { setAccountName(data.accountName || ""); setVerification("Account verified by Flutterwave"); }
      else { setVerification(data.error || "Account could not be verified"); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [propertyId, bankCode, accountNumber]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accountName) { setMessage("Enter a valid account number so Flutterwave can verify the account name."); return; }
    setBusy(true); setMessage("");
    const response = await fetch("/api/partner/payout-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId, bankCode, accountNumber }) });
    const data = await response.json().catch(() => ({}));
    setMessage(data.error || (response.ok ? "Verified payout details saved securely." : "Unable to save payout details."));
    setBusy(false);
  }

  return <form onSubmit={submit} className="reach-card"><div className="reach-card-head"><div><h2>Settlement account</h2><p>The property’s configured Flutterwave account supplies the bank list and verifies your account name. Your full account number is never shown after saving.</p></div></div><div className="reach-form-grid"><div className="reach-field"><label htmlFor="propertyId">Property</label><select id="propertyId" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setBankCode(""); setAccountName(""); setVerification(""); }} required><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div><div className="reach-field"><label htmlFor="bankCode">Bank</label><select id="bankCode" value={bankCode} onChange={(e) => { setBankCode(e.target.value); setAccountName(""); setVerification(""); }} disabled={!banks.length || loadingBanks} required><option value="">{loadingBanks ? "Loading banks…" : banks.length ? "Select bank" : "Flutterwave bank list unavailable"}</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></div><div className="reach-field"><label htmlFor="accountNumber">10-digit account number</label><input id="accountNumber" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder={profile.accountNumberLast4 ? `Saved account ending ${profile.accountNumberLast4}; re-enter to change` : "Enter account number"} required />{verification && <small>{verification}</small>}</div><div className="reach-field"><label htmlFor="accountName">Verified account name</label><input id="accountName" value={accountName} readOnly placeholder="Automatically returned by Flutterwave" required /></div></div><div className="reach-form-actions"><button className="reach-button primary" disabled={busy || !accountName}>{busy ? "Saving…" : "Save verified payout details"}</button>{message && <span className="reach-form-message">{message}</span>}</div></form>;
}
