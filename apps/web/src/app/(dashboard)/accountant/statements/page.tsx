"use client";

import React, { useState } from "react";
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download, 
  Calendar,
  Filter,
  BarChart3
} from "lucide-react";

export default function StatementsPage() {
  const [activeTab, setActiveTab] = useState("pl");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-emerald-400">Financial Statements</h1>
            <p className="text-slate-400 mt-1">View and export your core financial summaries.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Sep 2026</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium">
              <Download className="w-4 h-4" />
              <span className="text-sm">Export All</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto pb-2 gap-2 border-b border-slate-800">
          {[
            { id: "pl", label: "Profit & Loss", icon: TrendingUp },
            { id: "bs", label: "Balance Sheet", icon: FileText },
            { id: "cf", label: "Cash Flow", icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-6">
          {activeTab === "pl" && <ProfitAndLossStatement />}
          {activeTab === "bs" && <BalanceSheet />}
          {activeTab === "cf" && <CashFlowStatement />}
        </div>
      </div>
    </div>
  );
}

function ProfitAndLossStatement() {
  const plData = [
    { category: "Room Revenue", amount: 145000, type: "income" },
    { category: "F&B Revenue", amount: 45000, type: "income" },
    { category: "Other Operating Income", amount: 12000, type: "income" },
    { category: "Payroll Expenses", amount: -65000, type: "expense" },
    { category: "Administrative & General", amount: -15000, type: "expense" },
    { category: "Marketing & Sales", amount: -8000, type: "expense" },
    { category: "Utilities", amount: -12000, type: "expense" },
    { category: "Maintenance", amount: -9000, type: "expense" },
  ];

  const totalIncome = plData.filter(d => d.type === "income").reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = plData.filter(d => d.type === "expense").reduce((acc, curr) => acc + curr.amount, 0);
  const netIncome = totalIncome + totalExpense;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="Total Revenue" amount={totalIncome} type="positive" />
        <SummaryCard title="Total Expenses" amount={Math.abs(totalExpense)} type="negative" />
        <SummaryCard title="Net Income" amount={netIncome} type={netIncome >= 0 ? "positive" : "negative"} />
      </div>

      <div className="mt-8 rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/80 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium text-right">Amount (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {plData.map((item, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 text-slate-300">{item.category}</td>
                <td className={`px-6 py-4 text-right font-medium ${item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900/50 border-t border-slate-700">
            <tr>
              <td className="px-6 py-4 font-bold text-white">Net Income</td>
              <td className={`px-6 py-4 text-right font-bold ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function BalanceSheet() {
  const assets = [
    { item: "Cash and Cash Equivalents", amount: 250000 },
    { item: "Accounts Receivable", amount: 45000 },
    { item: "Inventory", amount: 15000 },
    { item: "Property & Equipment", amount: 1200000 },
  ];
  
  const liabilities = [
    { item: "Accounts Payable", amount: 35000 },
    { item: "Accrued Expenses", amount: 12000 },
    { item: "Long-term Debt", amount: 450000 },
  ];

  const equity = [
    { item: "Owner's Equity", amount: 800000 },
    { item: "Retained Earnings", amount: 213000 },
  ];

  const totalAssets = assets.reduce((acc, curr) => acc + curr.amount, 0);
  const totalLiabilities = liabilities.reduce((acc, curr) => acc + curr.amount, 0);
  const totalEquity = equity.reduce((acc, curr) => acc + curr.amount, 0);

  const Section = ({ title, data, total }: { title: string, data: any[], total: number }) => (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-emerald-400 border-b border-slate-800 pb-2">{title}</h3>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex justify-between py-2 text-sm text-slate-300">
            <span>{item.item}</span>
            <span>{item.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
          </div>
        ))}
        <div className="flex justify-between py-3 text-sm font-bold text-white border-t border-slate-800 mt-2">
          <span>Total {title}</span>
          <span>{total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        <Section title="Assets" data={assets} total={totalAssets} />
      </div>
      <div className="space-y-8">
        <Section title="Liabilities" data={liabilities} total={totalLiabilities} />
        <Section title="Equity" data={equity} total={totalEquity} />
        
        <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg flex justify-between items-center">
          <span className="font-medium text-slate-300">Liabilities + Equity</span>
          <span className="font-bold text-emerald-400">
            {(totalLiabilities + totalEquity).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </span>
        </div>
      </div>
    </div>
  );
}

function CashFlowStatement() {
  const sections = [
    {
      title: "Operating Activities",
      items: [
        { name: "Net Income", amount: 93000 },
        { name: "Depreciation", amount: 15000 },
        { name: "Changes in Working Capital", amount: -5000 },
      ]
    },
    {
      title: "Investing Activities",
      items: [
        { name: "Purchase of Equipment", amount: -25000 },
      ]
    },
    {
      title: "Financing Activities",
      items: [
        { name: "Loan Repayment", amount: -10000 },
        { name: "Dividends Paid", amount: -20000 },
      ]
    }
  ];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {sections.map((section, i) => {
        const subtotal = section.items.reduce((acc, curr) => acc + curr.amount, 0);
        return (
          <div key={i} className="bg-slate-900/30 rounded-lg p-5 border border-slate-800">
            <h3 className="text-emerald-400 font-medium mb-4">{section.title}</h3>
            <div className="space-y-3 text-sm">
              {section.items.map((item, j) => (
                <div key={j} className="flex justify-between text-slate-300">
                  <span>{item.name}</span>
                  <span className={item.amount < 0 ? 'text-rose-400' : 'text-slate-300'}>
                    {item.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between font-bold text-sm">
              <span className="text-white">Net Cash from {section.title}</span>
              <span className={subtotal < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {subtotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ title, amount, type }: { title: string, amount: number, type: 'positive' | 'negative' }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-2">{title}</h3>
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-white">
          {amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </span>
        {type === 'positive' ? (
          <div className="flex items-center text-xs font-medium text-emerald-400 mb-1">
            <TrendingUp className="w-3 h-3 mr-1" />
            +12.5%
          </div>
        ) : (
          <div className="flex items-center text-xs font-medium text-rose-400 mb-1">
            <TrendingDown className="w-3 h-3 mr-1" />
            -4.2%
          </div>
        )}
      </div>
    </div>
  );
}
