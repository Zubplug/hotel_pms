'use client';

import { useState } from 'react';

type Property = { id: string; name: string; code: string; address: string; city: string; state: string; country: string; phone: string; email: string; website: string | null; isActive: boolean; createdAt: string };
type FormState = Omit<Property, 'id' | 'code' | 'isActive' | 'createdAt'>;
const blank: FormState = { name: '', address: '', city: '', state: '', country: 'Nigeria', phone: '', email: '', website: '' };

export function PropertyManager({ initialProperties, limit }: { initialProperties: Property[]; limit: number | null }) {
  const [properties, setProperties] = useState(initialProperties);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const active = properties.filter(property => property.isActive).length;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!form) return; setSaving(true); setMessage('');
    const response = await fetch(editing ? `/api/portal/properties/${editing}` : '/api/portal/properties', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) { setMessage(data.error || 'Unable to save property.'); return; }
    setProperties(current => editing ? current.map(property => property.id === editing ? { ...property, ...data.property } : property) : [...current, data.property]); setForm(null); setEditing(null);
  };
  const toggle = async (property: Property) => {
    const response = await fetch(`/api/portal/properties/${property.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...property, isActive: !property.isActive }) });
    const data = await response.json().catch(() => ({})); if (!response.ok) { setMessage(data.error || 'Unable to update property.'); return; }
    setProperties(current => current.map(item => item.id === property.id ? { ...item, ...data.property } : item));
  };
  return <>
    <div className="portal-page-header"><div><div className="portal-page-kicker">Customer workspace</div><h1 className="portal-page-title">Properties</h1><p className="portal-page-sub" style={{ marginBottom: 0 }}>{active} active · {properties.length - active} inactive · {limit === null ? 'unlimited plan capacity' : `${limit} active allowed`}</p></div><button className="btn btn-primary btn-sm" onClick={() => { setForm(blank); setEditing(null); setMessage(''); }}>Add property →</button></div>
    {message && <p className="form-error" role="alert">{message}</p>}
    {form && <div className="portal-card" style={{ marginBottom: 16 }}><div className="portal-card-title">{editing ? 'Edit property' : 'Add property'}</div><form onSubmit={submit} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>{Object.entries(form).map(([key, value]) => <label key={key} className="form-group"><span className="form-label">{key === 'website' ? 'Website (optional)' : key.replace(/([A-Z])/g, ' $1')}</span><input className="form-input" required={!['website', 'email'].includes(key)} type={key === 'email' ? 'email' : key === 'website' ? 'url' : 'text'} value={String(value)} onChange={event => setForm(current => current ? { ...current, [key]: event.target.value } : current)} /></label>)}<div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}><button disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Save property'}</button><button type="button" className="btn btn-outline btn-sm" onClick={() => { setForm(null); setEditing(null); }}>Cancel</button></div></form></div>}
    <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Property</th><th>Code</th><th>Location</th><th>Contact</th><th>Status</th><th /></tr></thead><tbody>{properties.map(property => <tr key={property.id}><td><strong>{property.name}</strong></td><td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{property.code}</span></td><td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{[property.address, property.city, property.state, property.country].filter(Boolean).join(', ') || '—'}</td><td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{property.phone || property.email || '—'}</td><td><span className={`portal-badge ${property.isActive ? 'badge-active' : 'badge-inactive'}`}>{property.isActive ? 'Active' : 'Inactive'}</span></td><td><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-outline btn-sm" onClick={() => { setForm({ name: property.name, address: property.address, city: property.city, state: property.state, country: property.country, phone: property.phone, email: property.email, website: property.website || '' }); setEditing(property.id); setMessage(''); }}>Edit</button><button className="btn btn-outline btn-sm" onClick={() => toggle(property)}>{property.isActive ? 'Deactivate' : 'Reactivate'}</button></div></td></tr>)}</tbody></table>{!properties.length && <div className="portal-empty"><div className="portal-empty-title">No properties configured</div><div className="portal-empty-body">Add your first property to begin onboarding.</div></div>}</div>
  </>;
}
