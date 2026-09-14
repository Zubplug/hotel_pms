'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Loader2, Users } from 'lucide-react';

type Staff = { id: string; firstName: string; lastName: string; position: string; outletAccess: { outletId: string }[] };
type Outlet = { id: string; name: string };

export function OutletStaffAssignment() {
  const { propertyId } = useProperty();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    const response = await fetch(`/api/v1/fnb/staff/outlet-access?propertyId=${encodeURIComponent(propertyId)}`);
    const body = await response.json();
    if (response.ok) { setStaff(body.data?.staff || []); setOutlets(body.data?.outlets || []); }
    else setMessage(body.error || 'Unable to load outlet assignments');
    setLoading(false);
  };

  useEffect(() => { void load(); }, [propertyId]);

  const selectStaff = (id: string) => {
    setSelectedStaffId(id);
    setSelectedOutletIds(staff.find((member) => member.id === id)?.outletAccess.map((access) => access.outletId) || []);
    setMessage('');
  };

  const save = async () => {
    if (!selectedStaffId) return;
    setSaving(true); setMessage('');
    const response = await fetch(`/api/v1/fnb/staff/outlet-access?propertyId=${encodeURIComponent(propertyId || '')}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: selectedStaffId, outletIds: selectedOutletIds }) });
    const body = await response.json();
    setMessage(response.ok ? 'Outlet assignment saved. The staff member can now log into the selected outlet POS terminals.' : (body.error || 'Unable to save assignment'));
    if (response.ok) await load();
    setSaving(false);
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Users className="h-5 w-5" /></div><div><h2 className="font-semibold text-slate-900">Outlet Staff Assignment</h2><p className="mt-1 text-sm text-slate-500">Assign F&B staff to the outlets where they should appear during POS login.</p></div></div>
    {message && <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading staff and outlets…</div> : <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={selectedStaffId} onChange={(event) => selectStaff(event.target.value)}><option value="">Select staff member</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.position}</option>)}</select>
      <div className="grid gap-2 sm:grid-cols-2">{outlets.map((outlet) => <label key={outlet.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={selectedOutletIds.includes(outlet.id)} disabled={!selectedStaffId} onChange={() => setSelectedOutletIds((current) => current.includes(outlet.id) ? current.filter((id) => id !== outlet.id) : [...current, outlet.id])} />{outlet.name}</label>)}</div>
      <Button className="md:col-span-2 w-fit" disabled={!selectedStaffId || saving} onClick={() => void save()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save outlet assignment'}</Button>
    </div>}
  </section>;
}
