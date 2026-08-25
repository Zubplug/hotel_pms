'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Property = { id: string; name: string };
type OptionData = { approvers: { id: string; email: string }[]; roles: { id: string; name: string }[] };
type Rule = { stepOrder: number; minAmount: string; maxAmount: string; roleId: string; approverId: string };

export default function RefundWorkflowSettings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [options, setOptions] = useState<OptionData>({ approvers: [], roles: [] });
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/v1/properties?pageSize=100');
        const payload = await response.json();
        const loaded = payload.data || [];
        setProperties(loaded);
        if (loaded[0]) setPropertyId(loaded[0].id);
      } catch { toast.error('Unable to load properties'); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    void (async () => {
      try {
        const [workflowResponse, optionsResponse] = await Promise.all([
          fetch(`/api/v1/refund-workflows/${propertyId}`),
          fetch(`/api/v1/refund-requests/assignment-options?propertyId=${propertyId}`),
        ]);
        const workflow = await workflowResponse.json();
        const optionData = await optionsResponse.json();
        setOptions(optionData.data || { approvers: [], roles: [] });
        setRules((workflow.data || []).map((rule: { stepOrder: number; minAmount: string | null; maxAmount: string | null; roleId: string | null; approverId: string | null }) => ({ stepOrder: rule.stepOrder, minAmount: rule.minAmount || '', maxAmount: rule.maxAmount || '', roleId: rule.roleId || '', approverId: rule.approverId || '' })));
      } catch { toast.error('Unable to load refund workflow'); }
    })();
  }, [propertyId]);

  function addRule() {
    setRules(current => [...current, { stepOrder: current.length + 1, minAmount: '', maxAmount: '', roleId: '', approverId: '' }]);
  }

  function updateRule(index: number, field: keyof Rule, value: string) {
    setRules(current => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [field]: field === 'stepOrder' ? Number(value) : value } : rule));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/refund-workflows/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save workflow');
      toast.success('Refund workflow saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save workflow'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading refund workflow…</div>;
  return <div className="max-w-6xl space-y-6 p-4 pt-6 md:p-8">
    <div><h1 className="text-3xl font-bold tracking-tight">Refund Workflow</h1><p className="mt-2 text-muted-foreground">Rules are evaluated by amount. Matching rules run in step order; the gateway is called only after the final approval.</p></div>
    <div className="rounded-xl border bg-card p-5 shadow-sm"><label className="text-sm font-medium">Property</label><select value={propertyId} onChange={event => setPropertyId(event.target.value)} className="mt-2 h-10 w-full max-w-md rounded-md border bg-background px-3">{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
    <div className="rounded-xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold">Approval steps</h2><p className="text-sm text-muted-foreground">Leave the list empty to use the default amount-based routing.</p></div><div className="flex gap-2"><Button variant="outline" onClick={addRule}><Plus className="mr-2 h-4 w-4" />Add step</Button><Button onClick={save} disabled={saving || !propertyId}><Save className="mr-2 h-4 w-4" />Save workflow</Button></div></div><div className="overflow-x-auto p-5"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left"><th className="pb-3">Step</th><th className="pb-3">Minimum amount</th><th className="pb-3">Maximum amount</th><th className="pb-3">Role</th><th className="pb-3">Staff</th><th className="pb-3" /></tr></thead><tbody className="divide-y">{rules.map((rule, index) => <tr key={`${rule.stepOrder}-${index}`}><td className="py-3"><input type="number" min="1" value={rule.stepOrder} onChange={event => updateRule(index, 'stepOrder', event.target.value)} className="h-9 w-20 rounded-md border bg-background px-2" /></td><td className="py-3"><input type="number" min="0" value={rule.minAmount} onChange={event => updateRule(index, 'minAmount', event.target.value)} placeholder="No minimum" className="h-9 rounded-md border bg-background px-2" /></td><td className="py-3"><input type="number" min="0" value={rule.maxAmount} onChange={event => updateRule(index, 'maxAmount', event.target.value)} placeholder="No maximum" className="h-9 rounded-md border bg-background px-2" /></td><td className="py-3"><select value={rule.roleId} onChange={event => updateRule(index, 'roleId', event.target.value)} className="h-9 rounded-md border bg-background px-2"><option value="">Any assigned role</option>{options.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></td><td className="py-3"><select value={rule.approverId} onChange={event => updateRule(index, 'approverId', event.target.value)} className="h-9 rounded-md border bg-background px-2"><option value="">Any qualified staff</option>{options.approvers.map(approver => <option key={approver.id} value={approver.id}>{approver.email}</option>)}</select></td><td className="py-3 text-right"><Button variant="ghost" size="icon" onClick={() => setRules(current => current.filter((_, ruleIndex) => ruleIndex !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>)}</tbody></table>{rules.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No custom steps configured.</div>}</div></div>
  </div>;
}
