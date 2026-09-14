'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Search, Filter, AlertCircle, Percent, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, PackageSearch } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

function buildHierarchy(warehouses: any[]) {
  const map = new Map();
  warehouses.forEach(w => map.set(w.id, { ...w, children: [] }));
  const roots: any[] = [];
  warehouses.forEach(w => {
    if (w.parentWarehouseId && map.has(w.parentWarehouseId)) {
      map.get(w.parentWarehouseId).children.push(map.get(w.id));
    } else {
      roots.push(map.get(w.id));
    }
  });
  
  const flattened: any[] = [];
  const traverse = (node: any, depth: number) => {
    flattened.push({ ...node, depth });
    node.children.forEach((child: any) => traverse(child, depth + 1));
  };
  roots.forEach(r => traverse(r, 0));
  return flattened;
}

function VarianceVisualBar({ variance, maxVariance }: { variance: number; maxVariance: number }) {
  if (maxVariance === 0) return <div className="w-24 mx-auto" />;
  const percentage = Math.min(Math.abs(variance) / maxVariance, 1) * 100;
  const isOverage = variance > 0;
  const isShortage = variance < 0;

  return (
    <div className="flex items-center w-24 mx-auto opacity-90 group-hover:opacity-100 transition-opacity">
      <div className="flex-1 flex justify-end pr-1">
        {isShortage && <div className="h-1.5 bg-red-500/80 rounded-l-full" style={{ width: `${percentage}%` }} />}
      </div>
      <div className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
      <div className="flex-1 flex justify-start pl-1">
        {isOverage && <div className="h-1.5 bg-emerald-500/80 rounded-r-full" style={{ width: `${percentage}%` }} />}
      </div>
    </div>
  );
}

export function FnbInventoryClient() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch Warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/v1/inventory/warehouses');
        if (res.ok) {
          const json = await res.json();
          const items = json.data?.items || json.data || [];
          const hierarchy = buildHierarchy(items);
          setWarehouses(hierarchy);
          if (hierarchy.length > 0) {
            setSelectedWarehouseId(hierarchy[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadWarehouses();
  }, []);

  // Fetch Report
  const fetchReport = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/reports/avt?warehouseId=${selectedWarehouseId}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedWarehouseId]);

  const items = data?.items || [];
  const summary = data?.summary || { totalItems: 0, itemsCounted: 0, shortageValue: 0, overageValue: 0, netVarianceValue: 0 };
  
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item: any) => 
      item.itemCode.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const maxVariance = useMemo(() => {
    return Math.max(...filteredItems.map((i: any) => Math.abs(i.varianceQuantity || 0)), 1);
  }, [filteredItems]);

  const countedPercentage = summary.totalItems > 0 ? (summary.itemsCounted / summary.totalItems) * 100 : 0;

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
      <PageHeader 
        title="Physical vs Book Stock" 
        description={`Inventory variance analysis for ${data?.warehouse?.name || 'the selected outlet'}.`}
        actions={
          <div className="flex items-center gap-3">
            <Select value={selectedWarehouseId} onValueChange={(v) => setSelectedWarehouseId(v || '')}>
              <SelectTrigger className="w-[280px] bg-background/60 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-sm">
                <SelectValue placeholder="Select Warehouse..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {'\u00A0'.repeat(w.depth * 4)}
                    {w.depth > 0 ? '├─ ' : ''}
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={fetchReport} 
              disabled={loading || !selectedWarehouseId}
              className="bg-background/60 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {/* Net Variance */}
        <Card className="border-slate-200 dark:border-slate-800/60 shadow-sm bg-gradient-to-b from-background to-slate-50/50 dark:from-background dark:to-slate-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Variance Value</CardTitle>
            <div className={`p-1.5 rounded-md ${summary.netVarianceValue < 0 ? 'bg-red-500/10 text-red-500' : summary.netVarianceValue > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tracking-tight ${summary.netVarianceValue < 0 ? 'text-red-600 dark:text-red-400' : summary.netVarianceValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {formatCurrency(summary.netVarianceValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Overall financial impact</p>
          </CardContent>
        </Card>

        {/* Shortage */}
        <Card className="border-red-100 dark:border-red-900/30 shadow-sm bg-red-50/30 dark:bg-red-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Shortage Value</CardTitle>
            <div className="p-1.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">{formatCurrency(summary.shortageValue)}</div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1 font-medium">Loss / Shrinkage</p>
          </CardContent>
        </Card>

        {/* Overage */}
        <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">Overage Value</CardTitle>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.overageValue)}</div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 font-medium">Found / Unrecorded Stock</p>
          </CardContent>
        </Card>

        {/* Items Counted */}
        <Card className="border-slate-200 dark:border-slate-800/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Audit Progress</CardTitle>
            <div className="p-1.5 rounded-md bg-slate-500/10 text-slate-500">
              <Percent className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-700 dark:text-slate-300">
              {summary.itemsCounted} <span className="text-lg text-slate-400 dark:text-slate-500 font-medium">/ {summary.totalItems}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${countedPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search stock items..." 
                  className="pl-9 bg-background border-slate-200 dark:border-slate-700 focus-visible:ring-emerald-500/20 shadow-sm" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="border-slate-200 dark:border-slate-700 shadow-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            {loading && <div className="flex items-center text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Syncing data</div>}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto relative">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 font-semibold text-slate-600 dark:text-slate-300 h-11">Stock Item</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Physical</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Book</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-center w-32">Visual Var</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Var Qty</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Var %</TableHead>
                <TableHead className="pr-6 font-semibold text-slate-600 dark:text-slate-300 h-11 text-right">Var Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3">
                      <PackageSearch className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">No items found matching your criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filteredItems.map((item: any) => {
                const hasCount = item.physicalQuantity !== null;
                const varianceLabel = hasCount ? (item.varianceQuantity > 0 ? `+${item.varianceQuantity}` : item.varianceQuantity) : '--';
                const percentLabel = hasCount ? (item.variancePercentage > 0 ? `+${item.variancePercentage.toFixed(1)}%` : `${item.variancePercentage.toFixed(1)}%`) : '--';
                const isShortage = hasCount && item.varianceQuantity < 0;
                const isOverage = hasCount && item.varianceQuantity > 0;
                
                return (
                  <TableRow key={item.stockItemId} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-100 dark:border-slate-800/50">
                    <TableCell className="pl-6 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{item.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                            {item.itemCode}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {hasCount ? item.physicalQuantity : <span className="text-slate-300 dark:text-slate-600">--</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider">{item.unit}</div>
                    </TableCell>
                    
                    <TableCell className="text-right py-3">
                      <div className="font-medium text-slate-500 dark:text-slate-400">
                        {item.bookQuantity}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider">{item.unit}</div>
                    </TableCell>

                    <TableCell className="text-center py-3">
                       {hasCount && <VarianceVisualBar variance={item.varianceQuantity} maxVariance={maxVariance} />}
                    </TableCell>

                    <TableCell className="text-right py-3">
                      <span className={`inline-flex items-center justify-end font-semibold text-sm ${isShortage ? 'text-red-600 dark:text-red-400' : isOverage ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {varianceLabel}
                      </span>
                    </TableCell>
                    
                    <TableCell className="text-right py-3">
                      <span className={`text-sm ${isShortage ? 'text-red-500 dark:text-red-400/80' : isOverage ? 'text-emerald-500 dark:text-emerald-400/80' : 'text-slate-400'}`}>
                        {percentLabel}
                      </span>
                    </TableCell>
                    
                    <TableCell className="pr-6 text-right py-3">
                      <span className={`text-sm font-medium ${isShortage ? 'text-red-600 dark:text-red-400' : isOverage ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {hasCount ? formatCurrency(item.varianceValue) : '--'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
