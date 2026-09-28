'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Layers3, Loader2, Pencil, Plus, Power, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Building = { id: string; name: string; code: string; description?: string | null; floorsCount: number; isActive: boolean; _count?: { rooms: number } };
type Floor = { id: string; number: number; name: string; code?: string | null; isActive: boolean; _count?: { rooms: number } };

export function BuildingManagementDialog({ propertyId, open, onOpenChange }: { propertyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Building | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [floorForm, setFloorForm] = useState({ number: '1', name: '', code: '' });
  const [form, setForm] = useState({ name: '', code: '', description: '', floorsCount: '1' });
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['buildings', propertyId],
    queryFn: async () => { const response = await fetch(`/api/v1/properties/${propertyId}/buildings`); if (!response.ok) throw new Error('Could not load buildings'); const json = await response.json(); return (json.data || []) as Building[]; },
    enabled: open && !!propertyId,
  });
  const floorsQuery = useQuery({
    queryKey: ['building-floors', selectedBuilding?.id],
    queryFn: async () => { const response = await fetch(`/api/v1/buildings/${selectedBuilding!.id}/floors`); if (!response.ok) throw new Error('Could not load floors'); const json = await response.json(); return (json.data || []) as Floor[]; },
    enabled: open && !!selectedBuilding,
  });

  const startNew = () => { setEditing(null); setForm({ name: '', code: '', description: '', floorsCount: '1' }); };
  const startEdit = (building: Building) => { setEditing(building); setForm({ name: building.name, code: building.code, description: building.description || '', floorsCount: String(building.floorsCount || 1) }); };
  const selectBuilding = (building: Building) => { setSelectedBuilding(building); setFloorForm({ number: String((building.floorsCount || 0) + 1), name: '', code: '' }); };
  const toggleActive = async (building: Building) => {
    try {
      const response = await fetch(`/api/v1/buildings/${building.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !building.isActive }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message || 'Could not update building status'); }
      await queryClient.invalidateQueries({ queryKey: ['buildings', propertyId] });
      toast.success(building.isActive ? 'Building deactivated' : 'Building activated');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update building status'); }
  };
  const addFloor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBuilding) return;
    try {
      const response = await fetch(`/api/v1/buildings/${selectedBuilding.id}/floors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, buildingId: selectedBuilding.id, number: Number(floorForm.number), name: floorForm.name, code: floorForm.code || undefined }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message || 'Could not add floor'); }
      await floorsQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['buildings', propertyId] });
      setFloorForm({ number: String(Number(floorForm.number) + 1), name: '', code: '' });
      toast.success('Floor added');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add floor'); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/v1/buildings/${editing.id}` : `/api/v1/properties/${propertyId}/buildings`, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, floorsCount: Number(form.floorsCount), ...(editing ? {} : { propertyId }) }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message || 'Could not save building'); }
      await queryClient.invalidateQueries({ queryKey: ['buildings', propertyId] });
      setEditing(null);
      toast.success(editing ? 'Building updated' : 'Building added');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save building'); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) { onOpenChange(nextOpen); if (!nextOpen) { setEditing(null); setSelectedBuilding(null); } } }}>
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-white/10 bg-[#0d1b2a] text-slate-100 sm:max-w-3xl">
      <DialogHeader><DialogTitle className="text-xl text-white">Manage buildings</DialogTitle><DialogDescription className="text-slate-400">Maintain the physical building structure for this assigned property.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4"><div><p className="text-sm font-semibold text-slate-200">Property buildings</p><p className="mt-1 text-xs text-slate-500">Buildings, floors, and room capacity remain tied to this property.</p></div><Button type="button" size="sm" onClick={startNew} className="bg-emerald-300 text-slate-950 hover:bg-emerald-200"><Plus className="mr-2 h-4 w-4" />Add building</Button></div>
        {isLoading ? <div className="flex items-center justify-center py-10 text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading buildings…</div> : !data?.length ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No buildings configured</p><p className="mt-1 text-xs text-slate-500">Add the first building to define the property’s physical layout.</p></div> : <div className="space-y-2">{data.map((building) => <div key={building.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${selectedBuilding?.id === building.id ? 'border-emerald-300/40 bg-emerald-300/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'}`}><button type="button" onClick={() => selectBuilding(building)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="rounded-xl bg-sky-300/10 p-2.5 text-sky-300"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{building.name} <span className="ml-1 text-xs font-normal text-slate-500">· {building.code}</span></p><p className="mt-1 text-xs text-slate-500">{building.floorsCount} floors · {building._count?.rooms || 0} rooms · {building.isActive ? 'Active' : 'Inactive'}</p></div></button><div className="flex shrink-0 items-center gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => startEdit(building)} className="text-slate-400 hover:bg-white/10 hover:text-white" aria-label={`Edit ${building.name}`}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => void toggleActive(building)} className={building.isActive ? 'text-amber-300 hover:bg-amber-300/10' : 'text-emerald-300 hover:bg-emerald-300/10'} aria-label={`${building.isActive ? 'Deactivate' : 'Activate'} ${building.name}`}><Power className="h-4 w-4" /></Button></div></div>)}</div>}
        {selectedBuilding && <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Layers3 className="h-4 w-4 text-emerald-300" />{selectedBuilding.name} structure</p><p className="mt-1 text-xs text-slate-500">Add floors here; rooms can then be assigned through the room inventory workflow.</p></div><span className="text-xs text-slate-500">{floorsQuery.data?.length || 0} floors</span></div>{floorsQuery.isLoading ? <div className="py-5 text-center text-xs text-slate-500">Loading floors…</div> : <div className="space-y-2">{(floorsQuery.data || []).map((floor) => <div key={floor.id} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"><span className="text-sm text-slate-300">Level {floor.number} · {floor.name}</span><span className="text-xs text-slate-500">{floor._count?.rooms || 0} rooms</span></div>)}</div>}<form onSubmit={addFloor} className="grid gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-[90px_1fr_110px_auto]"><Input required min="0" type="number" aria-label="Floor number" value={floorForm.number} onChange={(event) => setFloorForm({ ...floorForm, number: event.target.value })} placeholder="No." className="border-white/10 bg-slate-900 text-slate-100" /><Input required aria-label="Floor name" value={floorForm.name} onChange={(event) => setFloorForm({ ...floorForm, name: event.target.value })} placeholder="Floor name" className="border-white/10 bg-slate-900 text-slate-100" /><Input aria-label="Floor code" value={floorForm.code} onChange={(event) => setFloorForm({ ...floorForm, code: event.target.value.toUpperCase() })} placeholder="Code" className="border-white/10 bg-slate-900 text-slate-100" /><Button type="submit" className="bg-emerald-300 text-slate-950 hover:bg-emerald-200"><Plus className="mr-2 h-4 w-4" />Add floor</Button></form></section>}
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Building2 className="h-4 w-4 text-emerald-300" />{editing ? `Edit ${editing.name}` : 'Add a building'}</div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label className="text-slate-300">Building name</Label><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Main Tower" className="border-white/10 bg-slate-900 text-slate-100" /></div><div className="space-y-2"><Label className="text-slate-300">Code</Label><Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="e.g. MAIN" className="border-white/10 bg-slate-900 text-slate-100" /></div><div className="space-y-2"><Label className="text-slate-300">Floors</Label><Input required min="1" type="number" value={form.floorsCount} onChange={(event) => setForm({ ...form, floorsCount: event.target.value })} className="border-white/10 bg-slate-900 text-slate-100" /></div><div className="space-y-2 sm:col-span-2"><Label className="text-slate-300">Description</Label><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional operational description" className="border-white/10 bg-slate-900 text-slate-100" /></div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={startNew} className="border-white/10 bg-transparent text-slate-300">Clear</Button><Button type="submit" disabled={saving || !form.name.trim() || !form.code.trim()} className="bg-emerald-300 text-slate-950 hover:bg-emerald-200">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editing ? 'Save building' : 'Add building'}</Button></div></form>
      </div>
    </DialogContent>
  </Dialog>;
}
