'use client';

import React, { useState, useEffect } from 'react';
import { Store, Plus, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from 'next-auth/react';

export default function PosOutletsSettingsPage() {
  const { data: session } = useSession();
  const [outlets, setOutlets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [newOutletName, setNewOutletName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const propertyId = (session?.user as any)?.propertyId;

  const fetchOutlets = async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/pos/outlets?propertyId=${propertyId}`);
      const json = await res.json();
      if (json.data) {
        setOutlets(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, [propertyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const res = await fetch('/api/v1/pos/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, name: newOutletName })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create outlet');
      
      setOutlets(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowForm(false);
      setNewOutletName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">POS Outlets</h1>
          <p className="text-muted-foreground mt-2">
            Manage your point of sale outlets and physical locations.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Outlet</>}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Create New Outlet</CardTitle>
            <CardDescription>e.g., Main Restaurant, Pool Bar, Rooftop Lounge</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Outlet Name</label>
                <input
                  type="text"
                  value={newOutletName}
                  onChange={(e) => setNewOutletName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Enter outlet name..."
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={isSubmitting || !newOutletName.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : outlets.length === 0 ? (
        <div className="py-12 text-center border rounded-xl bg-slate-50 border-dashed">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No outlets found</h3>
          <p className="text-slate-500 mt-1">Create your first POS outlet to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {outlets.map((outlet) => (
            <Card key={outlet.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{outlet.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-1" title="Outlet ID">
                        {outlet.id.split('-')[0]}...
                      </p>
                    </div>
                  </div>
                  {outlet.isActive ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
