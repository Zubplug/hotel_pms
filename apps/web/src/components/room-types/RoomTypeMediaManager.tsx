'use client';

import React from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function RoomTypeMediaManager({ roomTypeId, roomTypeName, initialPhotos }: { roomTypeId: string; roomTypeName: string; initialPhotos: string[] }) {
  const [photos, setPhotos] = React.useState(initialPhotos || []);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('altText', `${roomTypeName} room`);
      const response = await fetch(`/api/v1/room-types/${roomTypeId}/photos`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to upload image');
      setPhotos(payload.data.roomType.photos || []);
      toast.success('Room image added to the shared room-type media library');
    } catch (error: any) { toast.error(error.message || 'Unable to upload image'); }
    finally { setBusy(false); }
  }

  async function remove(url: string) {
    if (!window.confirm('Remove this image from the room type?')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/room-types/${roomTypeId}/photos`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to remove image');
      setPhotos(payload.data.photos || []);
      toast.success('Room image removed');
    } catch (error: any) { toast.error(error.message || 'Unable to remove image'); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-xl border bg-muted/20 p-4">
    <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="font-semibold">Room-type media</h3><p className="text-sm text-muted-foreground">These images are shared with the PMS and Booking Engine. Reach can use approved copies; standalone API/site implementations may choose their own media.</p></div><Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}><ImagePlus className="mr-2 h-4 w-4" /> Add image</Button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} /></div>
    {busy && <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Saving media…</div>}
    {photos.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{photos.map((photo) => <div key={photo} className="group relative overflow-hidden rounded-lg border bg-background"><img src={photo} alt={`${roomTypeName} room`} className="aspect-[4/3] w-full object-cover" /><button type="button" aria-label="Remove room image" onClick={() => remove(photo)} disabled={busy} className="absolute right-2 top-2 rounded-md bg-white/90 p-2 text-red-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No room images have been uploaded yet.</div>}
  </section>;
}
