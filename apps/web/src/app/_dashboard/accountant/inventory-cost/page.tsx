import React from 'react';
import {
  PackageSearch,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Coffee,
  Wine,
  Percent,
  Download
} from 'lucide-react';

const InventoryCostingPage = () => {
  const cogsData = [
    { category: 'Food (Perishables)', opening: 12000, purchases: 45000, closing: 10000, cogs: 47000, sales: 150000, costPercentage: 31.3 },
    { category: 'Food (Dry Storage)', opening: 18000, purchases: 12000, closing: 16000, cogs: 14000, sales: 45000, costPercentage: 31.1 },
    { category: 'Beverage (Alcoholic)', opening: 25000, purchases: 30000, closing: 22000, cogs: 33000, sales: 165000, costPercentage: 20.0 },
    { category: 'Beverage (Non-Alc)', opening: 5000, purchases: 8000, closing: 4500, cogs: 8500, sales: 42500, costPercentage: 20.0 },
  ];

  const varianceAnalysis = [
    { item: 'Premium Beef Cuts', type: 'Food', actualCost: 35.50, standardCost: 32.00, variance: -3.50, variancePercent: -10.9, status: 'unfavorable' },
    { item: 'House Red Wine', type: 'Beverage', actualCost: 8.20, standardCost: 8.50, variance: 0.30, variancePercent: 3.5, status: 'favorable' },
    { item: 'Fresh Salmon', type: 'Food', actualCost: 18.00, standardCost: 16.50, variance: -1.50, variancePercent: -9.1, status: 'unfavorable' },
    { item: 'Craft Beer Kegs', type: 'Beverage', actualCost: 110.00, standardCost: 115.00, variance: 5.00, variancePercent: 4.3, status: 'favorable' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-rose-400">
              Inventory Costing
            </h1>
            <p className="text-slate-400 mt-1">COGS summary and variance analysis for Food & Beverage</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Coffee className="w-5 h-5 text-amber-400" />
              <h3 className="font-medium">Total Food Cost</h3>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-white">31.2%</span>
              <span className="text-rose-400 ml-2 text-xs flex items-center inline-flex">
                <TrendingUp className="w-3 h-3 mr-1" /> +1.2%
              </span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Wine className="w-5 h-5 text-rose-400" />
              <h3 className="font-medium">Total Bev Cost</h3>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-white">20.0%</span>
              <span className="text-emerald-400 ml-2 text-xs flex items-center inline-flex">
                <TrendingDown className="w-3 h-3 mr-1" /> -0.5%
              </span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <PackageSearch className="w-5 h-5 text-emerald-400" />
              <h3 className="font-medium">Inventory Value</h3>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-white">₦52,500</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Percent className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium">Gross Profit Margin</h3>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-white">74.2%</span>
            </div>
          </div>
        </div>

        {/* COGS Summary Table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Cost of Goods Sold (COGS) Summary</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-sm">
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium text-right">Opening Inv.</th>
                  <th className="pb-3 font-medium text-right">Purchases</th>
                  <th className="pb-3 font-medium text-right">Closing Inv.</th>
                  <th className="pb-3 font-medium text-right">COGS</th>
                  <th className="pb-3 font-medium text-right">Sales</th>
                  <th className="pb-3 font-medium text-right">Cost %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cogsData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        {row.category.includes('Food') ? (
                          <Coffee className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Wine className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="font-medium text-slate-200">{row.category}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right text-slate-300">₦{row.opening.toLocaleString()}</td>
                    <td className="py-4 text-right text-slate-300">₦{row.purchases.toLocaleString()}</td>
                    <td className="py-4 text-right text-slate-300">₦{row.closing.toLocaleString()}</td>
                    <td className="py-4 text-right font-medium text-white">₦{row.cogs.toLocaleString()}</td>
                    <td className="py-4 text-right text-slate-300">₦{row.sales.toLocaleString()}</td>
                    <td className="py-4 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded bg-white/5 border ₦{
                        row.costPercentage > 30 ? 'border-rose-500/30 text-rose-400' : 'border-emerald-500/30 text-emerald-400'
                      }`}>
                        {row.costPercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Variance Analysis */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-lg border border-rose-500/30">
                <TrendingUp className="w-5 h-5 text-rose-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Item Variance Analysis</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {varianceAnalysis.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {item.type === 'Food' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Food</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Beverage</span>
                    )}
                    <h3 className="font-medium text-slate-200">{item.item}</h3>
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-4 mt-2">
                    <span>Std: ₦{item.standardCost.toFixed(2)}</span>
                    <span>Act: ₦{item.actualCost.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold flex items-center justify-end gap-1 ₦{
                    item.status === 'favorable' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {item.status === 'favorable' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    {Math.abs(item.variancePercent)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)} per unit
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default InventoryCostingPage;
