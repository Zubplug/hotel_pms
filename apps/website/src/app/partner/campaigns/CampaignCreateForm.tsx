'use client';

import { useState } from 'react';
import Link from 'next/link';

type PropertyOption = { id: string; name: string };

export function CampaignCreateForm({ properties, initialPropertyId }: { properties: PropertyOption[]; initialPropertyId?: string }) {
  const [propertyId, setPropertyId] = useState(initialPropertyId && properties.some((property) => property.id === initialPropertyId) ? initialPropertyId : '');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('STAY');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setCreatedUrl('');
    try {
      const response = await fetch('/api/partner/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ propertyId, name, category }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Unable to create campaign');
      setCreatedUrl(payload.campaign?.targetUrl || '');
      setMessage('Campaign created successfully. Your referral link is ready to share.');
      setName('');
    } catch (error: any) {
      setMessage(error?.message || 'Unable to create campaign');
    } finally {
      setBusy(false);
    }
  }

  return <div className="reach-card" style={{ marginTop: 18 }}>
    <div className="reach-card-head"><div><span className="reach-eyebrow">Create</span><h2>Generate a referral link</h2><p>Choose an eligible property and create a trackable campaign link.</p></div></div>
    <form className="reach-campaign-form" onSubmit={submit}>
      <label>Property<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} required><option value="">Choose a property</option>{properties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
      <label>Campaign name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekend escape campaign" minLength={2} maxLength={120} required /></label>
      <label>Referral category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="STAY">Accommodation</option><option value="VENUE">Venue</option><option value="EVENT">Event</option><option value="CORPORATE">Corporate</option></select></label>
      <button className="reach-button primary" disabled={busy || !propertyId}>{busy ? 'Creating…' : 'Create campaign →'}</button>
    </form>
    {message && <p className="reach-form-message" role="status">{message}</p>}
    {createdUrl && <div className="reach-link-preview"><span>Your new referral link</span><input readOnly value={createdUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => void navigator.clipboard.writeText(createdUrl)}>Copy</button><Link href="/partner/links" className="reach-button secondary small">View links</Link></div>}
  </div>;
}
