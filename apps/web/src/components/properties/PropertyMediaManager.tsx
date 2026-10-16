'use client';

import React from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Media = { id: string; url: string; altText?: string | null };

export function PropertyMediaManager({ propertyId, propertyName, initialMedia }: { propertyId: string; propertyName: string; initialMedia: Media[] }) {
  const [media, setMedia] = React.useState(initialMedia || []);
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
      form.append('altText', `${propertyName} property image`);
      const response = await fetch(`/api/v1/properties/${propertyId}/media`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to upload property image');
      setMedia((current) => [...current, payload.data]);
      toast.success('Property image published to the approved media library');
    } catch (error: any) { toast.error(error.message || 'Unable to upload property image'); }
    finally { setBusy(false); }
  }

  async function remove(mediaId: string) {
    if (!window.confirm('Remove this property image from Reach?')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/media`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to remove property image');
      setMedia((current) => current.filter((item) => item.id !== mediaId));
      toast.success('Property image removed from the approved media library');
    } catch (error: any) { toast.error(error.message || 'Unable to remove property image'); }
    finally { setBusy(false); }
  }

  return <CardSection>
    <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="font-semibold">Property media</h3><p className="text-sm text-muted-foreground">Upload the main property photography used by eligible Reach property cards and details.</p></div><Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}><ImagePlus className="mr-2 h-4 w-4" /> Add image</Button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} /></div>
    {busy && <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Saving media…</div>}
    {media.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{media.map((item) => <div key={item.id} className="group relative overflow-hidden rounded-lg border bg-background"><img src={item.url} alt={item.altText || `${propertyName} property image`} className="aspect-[4/3] w-full object-cover" /><button type="button" aria-label="Remove property image" onClick={() => remove(item.id)} disabled={busy} className="absolute right-2 top-2 rounded-md bg-white/90 p-2 text-red-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No property photography has been published yet.</div>}
  </CardSection>;
}

function CardSection({ children }: { children: React.ReactNode }) { return <section className="mt-6 rounded-xl border bg-muted/20 p-4">{children}</section>; }
