"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { 
  Loader2, 
  Save, 
  ShoppingCart, 
  GitMerge, 
  FileBox, 
  ShieldAlert, 
  Users, 
  Layers, 
  AlertCircle,
  Settings2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type FlowConfig = {
  enabled: boolean;
  approverRoles: string[];
  steps: number;
  minAmount: number;
  selfApproveBlocked: boolean;
};

type ApprovalFlows = {
  PURCHASE_ORDER: FlowConfig;
  INVENTORY_ADJUSTMENT: FlowConfig;
  STOCK_TRANSFER: FlowConfig;
  [key: string]: FlowConfig;
};

type ConfigData = {
  propertyId: string;
  approvalFlows: ApprovalFlows;
  availableRoles: string[];
};

const FLOW_META: Record<string, { title: string; description: string; icon: any }> = {
  PURCHASE_ORDER: {
    title: "Purchase Orders",
    description: "Approvals required for external procurement and purchasing.",
    icon: ShoppingCart,
  },
  INVENTORY_ADJUSTMENT: {
    title: "Stock Adjustments",
    description: "Approvals for manual stock corrections, damages, or shrinkage.",
    icon: FileBox,
  },
  STOCK_TRANSFER: {
    title: "Stock Transfers",
    description: "Approvals for moving items between internal stores and outlets.",
    icon: GitMerge,
  },
};

export default function ApprovalFlowsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!session?.user?.propertyId) return;
      try {
        const res = await fetch(`/api/v1/properties/${session.user.propertyId}/approval-config`);
        if (!res.ok) throw new Error("Failed to fetch configuration");
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        toast.error("Failed to load approval configuration.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [session?.user?.propertyId]);

  const handleSave = async () => {
    if (!data || !session?.user?.propertyId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/properties/${session.user.propertyId}/approval-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalFlows: data.approvalFlows }),
      });
      if (!res.ok) throw new Error("Failed to save configuration");
      toast.success("Approval configuration saved successfully.");
    } catch (err) {
      toast.error("Failed to save approval configuration.");
    } finally {
      setSaving(false);
    }
  };

  const updateFlow = (flowKey: string, updates: Partial<FlowConfig>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        approvalFlows: {
          ...prev.approvalFlows,
          [flowKey]: { ...prev.approvalFlows[flowKey], ...updates },
        },
      };
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-10 w-64 mb-4 rounded-lg" />
            <Skeleton className="h-5 w-96 rounded-md" />
          </div>
          <Skeleton className="h-12 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-[450px] w-full rounded-2xl" />
          <Skeleton className="h-[450px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[400px] text-center animate-in fade-in zoom-in-95">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Configuration Unavailable</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Could not load the approval flow settings for your property. Please check your connection or try again later.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/50 bg-clip-text text-transparent">
            Approval Flows
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Configure rules and thresholds for operational approvals.
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          size="lg" 
          className="shadow-lg hover:shadow-primary/25 transition-all duration-300 font-medium tracking-wide rounded-xl px-8"
        >
          {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
          Save Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {Object.entries(data.approvalFlows).map(([key, flow]) => {
          const meta = FLOW_META[key] || { title: key, description: "Custom approval flow", icon: Settings2 };
          const Icon = meta.icon;
          const isEnabled = flow.enabled;

          return (
            <Card 
              key={key} 
              className={`
                relative overflow-hidden transition-all duration-500 border-x-0 border-b-0 border-t-2 rounded-2xl
                ${isEnabled 
                  ? 'border-t-primary shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)]' 
                  : 'border-t-muted bg-muted/20 opacity-80 hover:opacity-100'}
              `}
            >
              {/* Premium gradient background effect */}
              {isEnabled && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
              )}
              
              <CardHeader className="pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`
                      p-4 rounded-2xl transition-colors duration-500
                      ${isEnabled ? 'bg-primary/10 text-primary shadow-inner shadow-primary/20' : 'bg-muted text-muted-foreground'}
                    `}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div>
                      <CardTitle className="text-xl tracking-tight">{meta.title}</CardTitle>
                      <CardDescription className="mt-1.5 text-sm leading-relaxed">{meta.description}</CardDescription>
                    </div>
                  </div>
                  <Switch 
                    checked={isEnabled} 
                    onCheckedChange={(c) => updateFlow(key, { enabled: c })} 
                    className="mt-2 scale-110"
                  />
                </div>
              </CardHeader>

              <CardContent>
                <div className={`space-y-8 transition-all duration-500 ${!isEnabled && 'opacity-40 pointer-events-none select-none grayscale-[30%]'}`}>
                  
                  {/* Approver Roles */}
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Authorized Approvers
                    </Label>
                    <div className="flex flex-wrap gap-2.5 p-4 bg-secondary/30 backdrop-blur-md rounded-xl border border-border/50 shadow-inner">
                      {data.availableRoles.map(role => {
                        const isSelected = flow.approverRoles.includes(role);
                        return (
                          <div 
                            key={role}
                            onClick={() => {
                              const newRoles = isSelected 
                                ? flow.approverRoles.filter(r => r !== role) 
                                : [...flow.approverRoles, role];
                              updateFlow(key, { approverRoles: newRoles });
                            }}
                            className={`
                              cursor-pointer px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-2 border
                              ${isSelected 
                                ? 'bg-primary/15 text-primary border-primary/30 shadow-sm' 
                                : 'bg-background/50 text-muted-foreground border-border/50 hover:border-primary/40 hover:bg-muted'}
                            `}
                          >
                            <div className={`
                              w-2 h-2 rounded-full transition-all duration-300
                              ${isSelected ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]' : 'bg-muted-foreground/30'}
                            `} />
                            {role.replace(/_/g, ' ')}
                          </div>
                        )
                      })}
                      {data.availableRoles.length === 0 && (
                        <p className="text-sm text-muted-foreground italic py-2">No roles available.</p>
                      )}
                    </div>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Minimum Amount */}
                    <div className="space-y-4">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Minimum Threshold
                      </Label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium group-focus-within:text-primary transition-colors">$</span>
                        <Input 
                          type="number"
                          placeholder="0 = Always require"
                          className="pl-9 h-11 bg-secondary/30 border-border/50 focus:bg-background focus:border-primary/50 transition-all rounded-xl"
                          value={flow.minAmount === 0 ? '' : flow.minAmount}
                          onChange={(e) => updateFlow(key, { minAmount: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Amount required to trigger the workflow. Leave empty or 0 to require approval for all requests.</p>
                    </div>

                    {/* Approval Steps */}
                    <div className="space-y-4">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        Approval Steps
                      </Label>
                      <div className="flex gap-2 h-11 p-1 bg-secondary/40 backdrop-blur-sm rounded-xl border border-border/50">
                        {[1, 2].map(step => (
                          <button
                            key={step}
                            onClick={() => updateFlow(key, { steps: step })}
                            className={`
                              flex-1 rounded-lg text-sm font-semibold transition-all duration-300
                              ${flow.steps === step 
                                ? 'bg-background shadow-md text-foreground border border-border/40' 
                                : 'text-muted-foreground hover:bg-background/40 border border-transparent'}
                            `}
                          >
                            {step === 1 ? 'Single Step' : 'Dual Step'}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Number of sequential approvals needed before authorization is granted.</p>
                    </div>
                  </div>

                  {/* Block Self Approval */}
                  <div className="flex items-center justify-between p-5 bg-rose-500/5 border border-rose-500/10 rounded-xl hover:bg-rose-500/10 transition-colors duration-300 group">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold text-rose-500 group-hover:text-rose-600 transition-colors">Block Self-Approval</Label>
                      <p className="text-xs text-rose-500/70 group-hover:text-rose-500/90 transition-colors">Prevent creators from approving their own requests, even if they have the required role.</p>
                    </div>
                    <Switch 
                      checked={flow.selfApproveBlocked} 
                      onCheckedChange={(c) => updateFlow(key, { selfApproveBlocked: c })} 
                    />
                  </div>

                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
