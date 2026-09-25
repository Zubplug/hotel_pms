'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { mapChannelRatePlan, mapChannelRoom, syncRemoteRooms, syncRemoteRatePlans } from '../../actions';

export function SyncRoomsButton({ providerSlug }: { providerSlug: string }) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncRemoteRooms(providerSlug);
      if (res.success) {
        toast.success('Successfully fetched remote rooms.');
      } else {
        toast.error(res.error || 'Failed to fetch remote rooms.');
      }
    } catch (e) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
      {isSyncing ? 'Fetching...' : 'Fetch Remote Rooms'}
    </Button>
  );
}

export function SyncRatesButton({ providerSlug }: { providerSlug: string }) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncRemoteRatePlans(providerSlug);
      if (res.success) {
        toast.success('Successfully fetched remote rate plans/offers.');
      } else {
        toast.error(res.error || 'Failed to fetch remote rates.');
      }
    } catch (e) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
      {isSyncing ? 'Fetching...' : 'Fetch Remote Rates'}
    </Button>
  );
}

export function ManualRoomMapping({ mappingId, value, options }: { mappingId: string; value: string | null; options: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(value || '');
  const [saving, setSaving] = useState(false);
  return <div className="flex items-center justify-end gap-2">
    <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={selected} onChange={(event) => setSelected(event.target.value)}>
      <option value="">Select LodgeCore room type</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    <Button size="sm" disabled={!selected || saving} onClick={async () => { setSaving(true); const result = await mapChannelRoom(mappingId, selected); result.success ? toast.success('Room mapping saved.') : toast.error(result.error || 'Could not save mapping.'); setSaving(false); }}>{saving ? 'Saving…' : 'Save'}</Button>
  </div>;
}

export function ManualRateMapping({ mappingId, value, options }: { mappingId: string; value: string | null; options: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(value || '');
  const [saving, setSaving] = useState(false);
  return <div className="flex items-center justify-end gap-2">
    <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={selected} onChange={(event) => setSelected(event.target.value)}>
      <option value="">Select LodgeCore rate plan</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    <Button size="sm" disabled={!selected || saving} onClick={async () => { setSaving(true); const result = await mapChannelRatePlan(mappingId, selected); result.success ? toast.success('Rate-plan mapping saved.') : toast.error(result.error || 'Could not save mapping.'); setSaving(false); }}>{saving ? 'Saving…' : 'Save'}</Button>
  </div>;
}
