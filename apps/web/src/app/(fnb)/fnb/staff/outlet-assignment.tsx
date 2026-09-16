'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { Loader2, Users, UserRoundCog, X, ArrowRight } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

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

  const selectedStaff = staff.find((member) => member.id === selectedStaffId);

  return <>
    <section className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-orange-50 p-2 text-orange-700"><Users className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#24130d]">Outlet staff assignment</h2><p className="mt-1 text-sm text-slate-500">Control which F&B outlets staff can access during POS login.</p></div></div>
      <Button onClick={() => { setIsOpen(true); setMessage(''); }} className="shrink-0 bg-[#24130d] text-white hover:bg-[#3d2318]"><UserRoundCog className="mr-2 h-4 w-4" />Reassign staff<ArrowRight className="ml-2 h-4 w-4" /></Button>
    </section>
    {message && !isOpen && <p className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-700">{message}</p>}
    {isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reassign-staff-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-5"><div><h2 id="reassign-staff-title" className="text-lg font-semibold text-slate-900">Reassign Staff to Outlets</h2><p className="mt-1 text-sm text-slate-500">Selected outlets will be available on the staff member’s POS login screen.</p></div><button aria-label="Close" onClick={() => setIsOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
        <div className="space-y-5 p-6">{loading ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading staff and outlets…</div> : <><div><label className="mb-2 block text-sm font-medium text-slate-700">Staff member</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" value={selectedStaffId} onChange={(event) => selectStaff(event.target.value)}><option value="">Select staff member</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.position}</option>)}</select></div><div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-slate-700">POS outlet access</label><span className="text-xs text-slate-500">{selectedOutletIds.length} selected</span></div><div className="grid gap-2 sm:grid-cols-2">{outlets.map((outlet) => <label key={outlet.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${selectedOutletIds.includes(outlet.id) ? 'border-emerald-300 bg-emerald-50/60 text-emerald-900' : 'border-slate-200 hover:border-slate-300'} ${!selectedStaffId ? 'cursor-not-allowed opacity-50' : ''}`}><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={selectedOutletIds.includes(outlet.id)} disabled={!selectedStaffId} onChange={() => setSelectedOutletIds((current) => current.includes(outlet.id) ? current.filter((id) => id !== outlet.id) : [...current, outlet.id])} />{outlet.name}</label>)}</div></div>{selectedStaff && <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{selectedStaff.firstName} {selectedStaff.lastName} will appear on the selected outlet POS terminals after the next successful sync.</p>}{message && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}</>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4"><Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button><Button disabled={!selectedStaffId || saving || loading} onClick={() => void save()} className="bg-emerald-600 text-white hover:bg-emerald-700">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save Assignment'}</Button></div>
      </div>
    </div>}
  </>;
}
