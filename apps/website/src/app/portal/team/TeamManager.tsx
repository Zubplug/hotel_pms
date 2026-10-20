'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Property = { id: string; name: string };
type Manager = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  propertyAccess: string[];
  createdAt: string;
  user: { middleName: string | null } | null;
  employeeInvitations: { createdAt: string; expiresAt: string; acceptedAt: string | null }[];
};

export function TeamManager({ properties, allProperties, managers }: { properties: Property[]; allProperties: (Property & { isActive: boolean })[]; managers: Manager[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(properties.map(property => property.id));
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  const close = () => {
    if (!saving) setOpen(false);
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus('');

    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/portal/team/general-manager', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: form.get('firstName'),
        middleName: form.get('middleName'),
        lastName: form.get('lastName'),
        email: form.get('email'),
        phone: form.get('phone'),
        propertyIds: selected,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setStatus(data.error || 'Unable to create account.');
      return;
    }

    setStatus(data.invitationWarning || 'General Manager invitation sent successfully.');
    event.currentTarget.reset();
    setOpen(false);
    router.refresh();
  }

  async function resendInvitation(staffId: string) {
    setResending(staffId);
    setStatus('');
    const response = await fetch(`/api/portal/team/general-manager/${staffId}/resend`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    setResending(null);
    if (!response.ok) { setStatus(data.error || 'Unable to resend invitation.'); return; }
    setStatus(data.invitationSent === false ? (data.invitationWarning || 'Account saved, but the invitation email could not be sent.') : 'A new activation link has been sent.');
    router.refresh();
  }

  const propertyName = (id: string) => allProperties.find(property => property.id === id)?.name || 'Unknown property';
  const invitationState = (manager: Manager) => {
    const invitation = manager.employeeInvitations[0];
    if (invitation?.acceptedAt) return { label: 'Activated', className: 'badge-active' };
    if (invitation && new Date(invitation.expiresAt) > new Date()) return { label: 'Invitation pending', className: 'badge-active' };
    return { label: 'Invitation expired', className: 'badge-inactive' };
  };

  return (
    <>
      <div className="portal-card">
        <div className="portal-card-title">General Manager access</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
          Create a PMS account for a General Manager and assign access to one or more properties.
          They will receive an activation invitation and sign in through the PMS login page.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {properties.length} {properties.length === 1 ? 'property is' : 'properties are'} available for assignment.
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setSelected(properties.map(property => property.id)); setStatus(''); setOpen(true); }} disabled={!properties.length}>
            Create General Manager →
          </button>
        </div>
        {status && <p role="status" style={{ margin: '16px 0 0', color: status.includes('successfully') ? 'var(--mint)' : '#ff7b8e', fontSize: 12 }}>{status}</p>}
      </div>

      <div className="portal-card" style={{ marginTop: 18 }}>
        <div className="portal-card-title">General Managers</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>Review account details, property access, and activation status.</p>
        {managers.length ? <div style={{ display: 'grid', gap: 12 }}>{managers.map(manager => {
          const state = invitationState(manager);
          const invitation = manager.employeeInvitations[0];
          const fullName = [manager.firstName, manager.user?.middleName, manager.lastName].filter(Boolean).join(' ');
          return <div key={manager.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div><div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fullName}</div><div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 5 }}>{manager.email}{manager.phone ? ` · ${manager.phone}` : ''}</div></div>
              <span className={`portal-badge ${state.className}`}>{state.label}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>{manager.propertyAccess.map(id => <span key={id} className="portal-badge">{propertyName(id)}</span>)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{invitation ? invitation.acceptedAt ? `Activated ${new Date(invitation.acceptedAt).toLocaleDateString()}` : `Link expires ${new Date(invitation.expiresAt).toLocaleString()}` : 'No invitation record'}</div>
              {!invitation?.acceptedAt && <button type="button" className="btn btn-outline btn-sm" onClick={() => resendInvitation(manager.id)} disabled={resending === manager.id}>{resending === manager.id ? 'Sending…' : 'Resend activation link'}</button>}
            </div>
          </div>;
        })}</div> : <div className="portal-empty"><div className="portal-empty-title">No General Managers yet</div><div className="portal-empty-body">Create a manager account to grant PMS access.</div></div>}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="general-manager-modal-title"
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(2,7,19,.78)', backdropFilter: 'blur(10px)' }}
        >
          <div className="portal-card" onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: '28px 26px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
              <div>
                <div className="section-kicker">PMS access management</div>
                <h2 id="general-manager-modal-title" style={{ margin: '8px 0 0', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 24 }}>Create General Manager</h2>
                <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Set up the manager’s identity and property access.</p>
              </div>
              <button type="button" aria-label="Close General Manager dialog" onClick={close} disabled={saving} style={{ color: 'var(--text-muted)', fontSize: 24, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={submit} style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <label className="form-group"><span className="form-label">First name</span><input required name="firstName" className="form-input" /></label>
              <label className="form-group"><span className="form-label">Middle name (optional)</span><input name="middleName" className="form-input" /></label>
              <label className="form-group"><span className="form-label">Last name</span><input required name="lastName" className="form-input" /></label>
              <label className="form-group"><span className="form-label">Work email</span><input required type="email" name="email" className="form-input" /></label>
              <label className="form-group"><span className="form-label">Phone (optional)</span><input name="phone" type="tel" className="form-input" /></label>
              <div style={{ gridColumn: '1/-1' }}>
                <span className="form-label">Property access</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {properties.map(property => (
                    <label key={property.id} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      <input type="checkbox" checked={selected.includes(property.id)} onChange={() => setSelected(current => current.includes(property.id) ? current.filter(id => id !== property.id) : [...current, property.id])} />
                      {property.name}
                    </label>
                  ))}
                </div>
              </div>
              {status && <p role="alert" className="form-error" style={{ gridColumn: '1/-1', margin: 0 }}>{status}</p>}
              <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={close} disabled={saving}>Cancel</button>
                <button disabled={saving || selected.length === 0} className="btn btn-primary btn-sm">{saving ? 'Creating…' : 'Create and send invitation →'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
