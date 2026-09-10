"use client";

import React, { useState } from "react";
import { 
  FileCheck, 
  History, 
  Download, 
  Filter, 
  Search,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck
} from "lucide-react";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("statutory");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-emerald-400">Reports & Compliance</h1>
            <p className="text-slate-400 mt-1">Manage statutory filings and track system audit logs.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {[
            { id: "statutory", label: "Statutory Reports", icon: FileCheck },
            { id: "audit", label: "Audit Trails", icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-t-lg"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-6 shadow-2xl">
          {activeTab === "statutory" && <StatutoryReports />}
          {activeTab === "audit" && <AuditTrails />}
        </div>
      </div>
    </div>
  );
}

function StatutoryReports() {
  const reports = [
    { id: "TAX-2026-Q3", name: "Q3 2026 VAT Return", type: "Tax Filing", dueDate: "2026-10-15", status: "pending" },
    { id: "PAY-2026-09", name: "September Payroll Taxes", type: "Payroll", dueDate: "2026-10-05", status: "submitted" },
    { id: "CORP-2025", name: "2025 Corporate Tax Return", type: "Annual", dueDate: "2026-03-31", status: "approved" },
    { id: "TOUR-2026-08", name: "August Tourism Levy", type: "Local Tax", dueDate: "2026-09-15", status: "submitted" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="text-emerald-400 w-5 h-5" />
          Compliance Filings
        </h2>
        <button className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg transition-colors text-sm font-medium">
          <Download className="w-4 h-4" />
          Export Schedule
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-sm mb-1">Upcoming Deadlines</div>
          <div className="text-2xl font-bold text-rose-400">2</div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-sm mb-1">Submitted (YTD)</div>
          <div className="text-2xl font-bold text-white">14</div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-sm mb-1">Compliance Score</div>
          <div className="text-2xl font-bold text-emerald-400">100%</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/80 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Report Name</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Due Date</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">{report.name}</td>
                <td className="px-6 py-4 text-slate-400">{report.type}</td>
                <td className="px-6 py-4 text-slate-400">{report.dueDate}</td>
                <td className="px-6 py-4">
                  {report.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  )}
                  {report.status === 'submitted' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <AlertCircle className="w-3.5 h-3.5" /> Submitted
                    </span>
                  )}
                  {report.status === 'approved' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="View Details">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors" title="Download Document">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTrails() {
  const audits = [
    { id: "LOG-001", user: "Sarah Jenkins", role: "Chief Accountant", action: "Approved Journal Entry #4092", time: "10 mins ago", ip: "192.168.1.45" },
    { id: "LOG-002", user: "System", role: "Automated", action: "Generated Night Audit Report", time: "2 hours ago", ip: "Internal" },
    { id: "LOG-003", user: "Michael Chen", role: "Finance Manager", action: "Exported Q3 P&L Statement", time: "5 hours ago", ip: "192.168.1.112" },
    { id: "LOG-004", user: "Sarah Jenkins", role: "Chief Accountant", action: "Modified tax rate settings", time: "1 day ago", ip: "192.168.1.45" },
    { id: "LOG-005", user: "System", role: "Automated", action: "Payroll Integration Sync", time: "1 day ago", ip: "API Gateway" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search audit logs..." 
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors text-sm text-slate-300">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors text-sm text-slate-300">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="relative border-l border-slate-800 ml-3 space-y-8 py-4">
        {audits.map((audit) => (
          <div key={audit.id} className="relative pl-8">
            <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-slate-950" />
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 hover:bg-slate-900/60 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-emerald-400">{audit.user}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">{audit.role}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {audit.time}
                </div>
              </div>
              <p className="text-sm text-slate-300">{audit.action}</p>
              <div className="mt-3 text-xs text-slate-600 font-mono">
                Source: {audit.ip} • Event ID: {audit.id}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-center pt-4">
        <button className="px-4 py-2 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors">
          Load More Events
        </button>
      </div>
    </div>
  );
}
