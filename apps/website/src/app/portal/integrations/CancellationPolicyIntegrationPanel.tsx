'use client';

import { useEffect, useState } from 'react';
import { CancellationPolicyWorkspace } from '@/app/portal/settings/booking-engine/[propertyId]/cancellation-policies/CancellationPolicyWorkspace';

type Property = { id: string; name: string };

export function CancellationPolicyIntegrationPanel() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  useEffect(() => {
    fetch('/api/portal/integrations/properties').then(response => response.json()).then(payload => {
      const next = (payload.properties || []).map((property: Property) => ({ id: property.id, name: property.name }));
      setProperties(next); if (next[0]) setPropertyId(next[0].id);
    }).catch(() => setProperties([]));
  }, []);
  return <section className="portal-card" style={{ marginTop: 24 }}>
    <div className="portal-card-title">Cancellation & refund policies <span className="portal-badge badge-active">Online integrations</span></div>
    <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 760 }}>Set the guest cancellation rules used by your Booking Engine, Standalone API, and website-development reservation flows. Policies are assigned to public rate plans and snapshotted when a reservation is created.</p>
    <div style={{ margin: '16px 0 22px', maxWidth: 420 }}><label className="be-field-label" htmlFor="policy-property">Property</label><select id="policy-property" value={propertyId} onChange={event => setPropertyId(event.target.value)} style={{ width: '100%', marginTop: 6, padding: 10 }}><option value="">Select property</option>{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
    {propertyId ? <CancellationPolicyWorkspace propertyId={propertyId} /> : <p style={{ color: 'var(--text-muted)' }}>No properties are available for this organization.</p>}
  </section>;
}
