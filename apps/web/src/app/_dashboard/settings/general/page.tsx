'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProperty } from '@/components/PropertyProvider';

type PropertyForm = {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
  baseCurrency: string;
  checkInTime: string;
  checkOutTime: string;
};

const emptyForm: PropertyForm = {
  name: '', code: '', address: '', city: '', state: '', country: '', phone: '', email: '', website: '',
  timezone: 'Africa/Lagos', baseCurrency: 'NGN', checkInTime: '14:00', checkOutTime: '12:00',
};

export default function GeneralSettingsPage() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    fetch(`/api/v1/properties/${propertyId}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || 'Unable to load property settings');
        const property = body.data;
        setForm({ ...emptyForm, ...Object.fromEntries(Object.keys(emptyForm).map(key => [key, property[key] ?? emptyForm[key as keyof PropertyForm]])) } as PropertyForm);
      })
      .catch(error => setMessage({ text: error instanceof Error ? error.message : 'Unable to load property settings', error: true }))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const update = (key: keyof PropertyForm, value: string) => setForm(current => ({ ...current, [key]: value }));

  const save = async () => {
    if (!propertyId) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, code: form.code.toUpperCase(), baseCurrency: form.baseCurrency.toUpperCase() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to save property settings');
      setForm(current => ({ ...current, ...body.data }));
      setMessage({ text: 'Property settings saved successfully.' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to save property settings', error: true });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof PropertyForm, label: string, type = 'text') => (
    <label className="space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <Input type={type} value={form[key]} onChange={event => update(key, event.target.value)} />
    </label>
  );

  return <div className="mx-auto max-w-5xl space-y-8 pb-10">
    <div className="flex items-start gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Building2 className="h-6 w-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Property administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight">General property settings</h1><p className="mt-2 text-sm text-muted-foreground">Manage the identity, contact details, operating hours, and regional defaults used across LodgeCore.</p></div></div>
    {message && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-4 w-4" />{message.text}</div>}
    {propertyLoading || loading ? <div className="flex justify-center rounded-2xl border bg-card p-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : !propertyId ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a property to manage its settings.</CardContent></Card> : <div className="space-y-6">
      <Card><CardHeader><CardTitle>Property identity</CardTitle><CardDescription>These details appear in guest-facing documents, reports, and operational workflows.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{field('name', 'Property name')}{field('code', 'Property code')}<div className="sm:col-span-2">{field('address', 'Address')}</div>{field('city', 'City')}{field('state', 'State')}{field('country', 'Country')}</CardContent></Card>
      <Card><CardHeader><CardTitle>Contact details</CardTitle><CardDescription>Keep the property contact information current for communication and reporting.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{field('phone', 'Phone number', 'tel')}{field('email', 'Email address', 'email')}<div className="sm:col-span-2">{field('website', 'Website', 'url')}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Operating defaults</CardTitle><CardDescription>These defaults influence business dates, reservations, and currency display.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{field('timezone', 'Timezone')}{field('baseCurrency', 'Base currency')}{field('checkInTime', 'Check-in time', 'time')}{field('checkOutTime', 'Check-out time', 'time')}</CardContent></Card>
      <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !propertyId} className="gap-2"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save property settings'}</Button></div>
    </div>}
  </div>;
}
