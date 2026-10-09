'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, CircleAlert, CircleCheck, Plus, Save, Trash2, Search, X, ChevronDown, CheckCircle2, ChefHat, BookOpen, AlertCircle, Info } from 'lucide-react';

/* ─── custom combobox ────────────────────────────────────────────────────── */
interface ComboBoxProps {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; sub?: string }[];
  disabled?: boolean;
  required?: boolean;
}

function ComboBox({ label, placeholder, value, onChange, options, disabled, required }: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <div ref={ref} className="relative w-full">
      {label && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}{required && <span className="ml-0.5 text-indigo-400">*</span>}</p>}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={[
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-sm transition-all',
          open
            ? 'border-indigo-400/60 bg-[#0d1e35] shadow-[0_0_0_3px_rgba(99,102,241,0.10)]'
            : 'border-white/10 bg-[#0d1832]',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-white/20 cursor-pointer',
        ].join(' ')}
      >
        <span className={selected ? 'text-slate-100 truncate' : 'text-slate-500 truncate'}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1e35] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                <X className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-500">No results</li>
            ) : filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={[
                    'flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]',
                    o.value === value ? 'bg-indigo-400/[0.08]' : '',
                  ].join(' ') + " text-left"}
                >
                  <span className={`text-sm font-medium ${o.value === value ? 'text-indigo-300' : 'text-slate-200'}`}>{o.label}</span>
                  {o.sub && <span className="mt-0.5 text-[11px] text-slate-500">{o.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Ingredient = { stockItemId: string; quantity: string; unitOfMeasure: string };
type StockItem = { id: string; name: string; baseUnit: string; costPrice: number | string; stockUnits?: { unit: string; unitsInBase: number | string }[], quantityOnHand?: number };

export default function RecipesPage() {
  const [data, setData] = useState<any>({ recipes: [], products: [], stockItems: [] });
  const [selected, setSelected] = useState<any>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [versionName, setVersionName] = useState('');
  const [targetMargin, setTargetMargin] = useState('70');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => { 
    const response = await fetch('/api/v1/inventory/recipes'); 
    const body = await response.json(); 
    if (!response.ok) throw new Error(body.error || 'Unable to load recipes'); 
    setData(body.data); 
  };
  
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);
  
  const stockById = useMemo(() => Object.fromEntries(data.stockItems.map((item: StockItem) => [item.id, item])), [data.stockItems]);
  
  const cost = ingredients.reduce((sum, item) => { 
    const stock = stockById[item.stockItemId]; 
    if (!stock) return sum; 
    const conversion = item.unitOfMeasure === stock.baseUnit ? 1 : Number(stock.stockUnits?.find((unit: any) => unit.unit === item.unitOfMeasure)?.unitsInBase || 0); 
    return sum + Number(item.quantity || 0) * conversion * Number(stock.costPrice || 0); 
  }, 0);
  
  const open = (recipe: any) => { 
    const version = recipe.versions?.[0]; 
    setSelected(recipe); 
    setVersionName(version?.versionName || ''); 
    setTargetMargin(String(recipe.targetMargin)); 
    setIngredients((version?.ingredients || []).map((item: any) => ({ stockItemId: item.stockItemId, quantity: String(item.quantity), unitOfMeasure: item.unitOfMeasure }))); 
  };
  
  const newRecipe = () => { 
    setSelected({ id: null, posProductId: '', targetMargin: 70 }); 
    setVersionName('Initial version'); 
    setTargetMargin('70'); 
    setIngredients([{ stockItemId: '', quantity: '', unitOfMeasure: '' }]); 
  };
  
  const save = async () => { 
    setLoading(true);
    try {
      const body = { posProductId: selected.posProductId, versionName, targetMargin: Number(targetMargin), ingredients }; 
      const url = selected.id ? `/api/v1/inventory/recipes/${selected.id}` : '/api/v1/inventory/recipes'; 
      const response = await fetch(url, { method: selected.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); 
      const json = await response.json(); 
      if (!response.ok) { 
        setMessage(json.error || 'Unable to save recipe'); 
        return; 
      } 
      setMessage('Recipe version saved successfully.'); 
      setTimeout(() => setMessage(''), 3000);
      setSelected(null); 
      await load(); 
    } catch (e: any) {
      setMessage(e.message || 'Error saving recipe');
    } finally {
      setLoading(false);
    }
  };
  
  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => 
    setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'stockItemId' ? value : value } : item));

  const money = (v: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(v);

  const filteredRecipes = data.recipes.filter((recipe: any) => 
    recipe.posProduct?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    recipe.versions?.[0]?.versionName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100 pb-16">
      {/* ── header ──────────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_36%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link href="/inventory/cost-control" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                <ChevronLeft className="h-3.5 w-3.5" /> Back to Cost Control
              </Link>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-400">
                <ChefHat className="h-4 w-4" /> Recipe Management
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Recipe Control</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Map POS products to stock ingredients. The system calculates live theoretical cost based on real-time inventory prices and backflushes stock on sale.
              </p>
            </div>
            
            <div>
              <button 
                onClick={newRecipe} 
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-400 transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]"
              >
                <Plus className="h-4 w-4" /> Create New Recipe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── main ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1500px] mt-8 px-5 sm:px-8">
        {message && (
          <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm font-medium text-indigo-200 flex items-center gap-3">
            <Info className="h-5 w-5 text-indigo-400" /> {message}
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] shadow-2xl overflow-hidden">
          <div className="border-b border-white/[0.07] px-6 py-5 flex items-center justify-between bg-white/[0.01]">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-400" /> Active Recipes
            </h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search recipes..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 w-64 rounded-lg border border-white/10 bg-[#0d1832] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500/50 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="rounded-full bg-white/[0.05] border border-white/[0.1] px-3 py-1 text-xs font-medium text-slate-300">
                {filteredRecipes.length} configured
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-white/[0.05]">
            {filteredRecipes.length === 0 ? (
              <div className="px-6 py-16 flex flex-col items-center justify-center text-slate-500">
                <ChefHat className="h-12 w-12 mb-4 opacity-20" />
                <p>{searchQuery ? 'No recipes match your search.' : 'No recipes configured yet.'}</p>
                {!searchQuery && (
                  <button onClick={newRecipe} className="mt-4 text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                    Create your first recipe
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-white/[0.01]">
                {filteredRecipes.map((recipe: any) => { 
                  const version = recipe.versions?.[0]; 
                  const mapped = Boolean(version?.ingredients?.length); 
                  const currentCost = costFor(version, stockById);
                  const price = Number(recipe.posProduct?.price || 0);
                  const actualMargin = price > 0 ? ((price - currentCost) / price) * 100 : 0;
                  
                  return (
                    <div key={recipe.id} className="rounded-2xl border border-white/10 bg-[#0d1832] p-5 shadow-lg flex flex-col hover:border-indigo-500/30 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-white text-lg">{recipe.posProduct?.name || 'Unknown Product'}</h3>
                          <p className="text-xs text-slate-400 mt-1">{version?.versionName || 'Draft Version'}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${mapped ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {mapped ? <CircleCheck className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} {mapped ? 'Mapped' : 'Incomplete'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Cost</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{money(currentCost)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Target Margin</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{recipe.targetMargin}%</p>
                        </div>
                        <div className="col-span-2 mt-1">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Selling Price</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{money(price)} <span className="text-xs text-slate-400 font-normal ml-1">({actualMargin.toFixed(1)}% act. margin)</span></p>
                        </div>
                      </div>

                      {version && (
                        <div className="flex-1 mb-5">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Ingredients ({version.ingredients.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {version.ingredients.slice(0, 4).map((item: any) => (
                              <span key={item.id} className="inline-flex items-center rounded-lg bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-300 border border-indigo-500/20">
                                {item.stockItem?.name || 'Unknown'} ({item.quantity} {item.unitOfMeasure})
                              </span>
                            ))}
                            {version.ingredients.length > 4 && (
                              <span className="inline-flex items-center rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-400 border border-white/10">
                                +{version.ingredients.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={() => open(recipe)} 
                        className="mt-auto w-full rounded-xl border border-white/10 bg-white/[0.02] py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white transition-all group-hover:border-indigo-500/30"
                      >
                        Edit Recipe Formula
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Recipe Modal ────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#08111f]/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#0d1832] shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 bg-[#111c2e]">
              <div>
                <h3 className="text-xl font-bold text-white">{selected.id ? 'Edit Recipe Version' : 'Create New Recipe'}</h3>
                <p className="text-sm text-slate-400 mt-1">Configure ingredients and portion formulas.</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/[0.05] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0b1728]">
              
              {/* Basic Info */}
              <div className="grid gap-6 md:grid-cols-3 p-6 rounded-2xl bg-[#111c2e] border border-white/[0.08] shadow-lg">
                <ComboBox
                  label="POS Product"
                  placeholder="Select product…"
                  value={selected.posProductId}
                  onChange={(v) => setSelected({ ...selected, posProductId: v })}
                  options={data.products.map((p: any) => ({ value: p.id, label: p.name, sub: money(p.price) }))}
                  disabled={Boolean(selected.id)}
                  required
                />
                
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Version Name <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Standard, Premium, Summer"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.10)] transition-all"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Target Margin % <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.10)] transition-all"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                  <h4 className="text-lg font-semibold text-white">Bill of Materials</h4>
                  <button 
                    onClick={() => setIngredients((current) => [...current, { stockItemId: '', quantity: '', unitOfMeasure: '' }])}
                    className="flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <Plus className="h-4 w-4" /> Add Ingredient
                  </button>
                </div>
                
                <div className="space-y-3">
                  {ingredients.map((item, index) => {
                    const stock = stockById[item.stockItemId] as StockItem | undefined;
                    const units = stock ? [stock.baseUnit, ...(stock.stockUnits || []).map((u) => u.unit)] : [];
                    const lineCost = (() => {
                      if (!stock) return 0;
                      const conversion = item.unitOfMeasure === stock.baseUnit ? 1 : Number(stock.stockUnits?.find((u: any) => u.unit === item.unitOfMeasure)?.unitsInBase || 0);
                      return Number(item.quantity || 0) * conversion * Number(stock.costPrice || 0);
                    })();

                    return (
                      <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] group hover:border-indigo-500/20 transition-all relative">
                        <div className="flex-1 w-full sm:w-auto">
                          <ComboBox
                            placeholder="Select stock ingredient…"
                            value={item.stockItemId}
                            onChange={(v) => {
                              updateIngredient(index, 'stockItemId', v);
                              updateIngredient(index, 'unitOfMeasure', '');
                            }}
                            options={data.stockItems.map((si: StockItem) => ({ value: si.id, label: si.name, sub: `On Hand: ${si.quantityOnHand} ${si.baseUnit}` }))}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <input
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                            className="h-11 w-24 rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.10)] transition-all"
                          />
                          
                          <select
                            value={item.unitOfMeasure}
                            onChange={(e) => updateIngredient(index, 'unitOfMeasure', e.target.value)}
                            className="h-11 w-32 rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-indigo-400/60 transition-all appearance-none"
                            disabled={!stock}
                          >
                            <option value="">Unit</option>
                            {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                          </select>
                          
                          <div className="w-24 text-right">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Line Cost</p>
                            <p className="text-sm font-semibold text-emerald-300">{money(lineCost)}</p>
                          </div>
                          
                          <button
                            onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-2"
                            title="Remove ingredient"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {ingredients.length === 0 && (
                    <div className="py-10 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                      <p className="text-slate-500 text-sm">No ingredients added yet.</p>
                      <button 
                        onClick={() => setIngredients([{ stockItemId: '', quantity: '', unitOfMeasure: '' }])}
                        className="mt-2 text-indigo-400 text-sm font-semibold hover:text-indigo-300"
                      >
                        Add your first ingredient
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/10 px-6 py-5 bg-[#111c2e]">
              <div className="mb-4 sm:mb-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Theoretical Cost per Serving</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{money(cost)}</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={loading || !selected.posProductId || ingredients.length === 0 || ingredients.some(i => !i.stockItemId || !i.quantity || !i.unitOfMeasure)}
                  onClick={save}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 px-8 py-2.5 rounded-xl transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                >
                  {loading ? 'Saving...' : <>Save Recipe <CheckCircle2 className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

function costFor(version: any, stockById: Record<string, StockItem>) { 
  return (version?.ingredients || []).reduce((sum: number, item: any) => { 
    const stock = stockById[item.stockItemId]; 
    if (!stock) return sum; 
    const conversion = item.unitOfMeasure === stock.baseUnit ? 1 : Number(stock.stockUnits?.find((unit: any) => unit.unit === item.unitOfMeasure)?.unitsInBase || 0); 
    return sum + Number(item.quantity) * conversion * Number(stock.costPrice || 0); 
  }, 0); 
}
