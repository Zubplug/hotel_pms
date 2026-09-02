'use client';

import React, { useState, useEffect } from 'react';
import { Store, Plus, Loader2, CheckCircle2, XCircle, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useProperty } from '@/components/PropertyProvider';

export default function PosSettingsPage() {
  const { status } = useSession();
  const { propertyId } = useProperty();

  const [outlets, setOutlets] = useState<any[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [newOutletName, setNewOutletName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [outletsRes, propertyRes] = await Promise.all([
        fetch(`/api/v1/pos/outlets?propertyId=${propertyId}`),
        fetch(`/api/v1/properties/${propertyId}`)
      ]);
      
      const outletsJson = await outletsRes.json();
      const propertyJson = await propertyRes.json();
      
      if (outletsJson.data) setOutlets(outletsJson.data);
      if (propertyJson.data) setProperty(propertyJson.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    fetchData();
  }, [propertyId, status]);

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
      toast.success('Outlet created successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBankingModel = async (newModel: string) => {
    if (!propertyId || !property) return;
    
    const currentSettings = property.settings || {};
    const updatedSettings = {
      ...currentSettings,
      pos: {
        ...(currentSettings.pos || {}),
        bankingModel: newModel
      }
    };

    try {
      const res = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings })
      });
      
      if (!res.ok) throw new Error('Failed to update property settings');
      
      setProperty({ ...property, settings: updatedSettings });
      toast.success('Banking model updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    }
  };

  const currentBankingModel = property?.settings?.pos?.bankingModel || 'CENTRAL_CASHIER';

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Point of Sale Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage POS configurations, banking models, and physical outlets.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Banking Model Configuration */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                    <HandCoins className="w-5 h-5 text-indigo-500" /> Financial Banking Model
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-500">
                    Determine how cash accountability and shift reconciliation work across your F&B outlets.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-start gap-8">
                <div className="flex-1 space-y-4">
                  <div className={`p-4 rounded-xl border-2 transition-all ${currentBankingModel === 'SERVER_BANKING' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-white'}`}>
                    <h3 className="font-semibold text-slate-900">Server Banking (Waiters are Cashiers)</h3>
                    <p className="text-sm text-slate-500 mt-1">Waiters carry their own float. They are fully accountable for their cash sales and must drop physical cash to a manager at the end of their shift.</p>
                  </div>
                  <div className={`p-4 rounded-xl border-2 transition-all ${currentBankingModel === 'CENTRAL_CASHIER' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-white'}`}>
                    <h3 className="font-semibold text-slate-900">Station Banking (Central Cashier)</h3>
                    <p className="text-sm text-slate-500 mt-1">Waiters only fire orders to the kitchen. All guests pay at a central cashier station (e.g., the bar). Only the cashier is accountable for physical cash.</p>
                  </div>
                </div>
                <div className="w-64 pt-2 shrink-0">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Active Model</label>
                  <Select value={currentBankingModel} onValueChange={handleUpdateBankingModel}>
                    <SelectTrigger className="h-12 bg-white">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVER_BANKING">Server Banking</SelectItem>
                      <SelectItem value="CENTRAL_CASHIER">Station Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outlets Configuration */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">Physical Outlets</h2>
              <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm" className="gap-2">
                {showForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Outlet</>}
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 mb-4">
                {error}
              </div>
            )}

            {showForm && (
              <Card className="border-indigo-100 bg-indigo-50/50 mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Create New Outlet</CardTitle>
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
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Enter outlet name..."
                        autoFocus
                      />
                    </div>
                    <Button type="submit" disabled={isSubmitting || !newOutletName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Outlet'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {outlets.length === 0 ? (
              <div className="py-12 text-center border rounded-xl bg-slate-50 border-dashed">
                <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">No outlets found</h3>
                <p className="text-slate-500 mt-1">Create your first POS outlet to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {outlets.map((outlet) => (
                  <Card key={outlet.id} className="hover:border-indigo-500/30 transition-colors shadow-sm">
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
        </div>
      )}
    </div>
  );
}
