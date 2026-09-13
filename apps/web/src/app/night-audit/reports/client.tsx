'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';

export default function ReportsGeneratorPage({ managerMode = false }: { managerMode?: boolean }) {
  const { propertyId } = useProperty();
  
  const [businessDate, setBusinessDate] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId) {
      fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`)
        .then(res => res.json())
        .then(res => {
          if (res.data?.analytics?.trend?.length > 0) {
            const trend = res.data.analytics.trend;
            const lastAudit = trend[trend.length - 1];
            setBusinessDate(String(lastAudit.businessDate).slice(0, 10));
          } else if (res.data?.businessDate) {
            setBusinessDate(String(res.data.businessDate).slice(0, 10));
          } else {
            setBusinessDate(new Date().toISOString().slice(0, 10));
          }
        })
        .catch(err => {
          console.error('Failed to fetch business date:', err);
          setBusinessDate(new Date().toISOString().slice(0, 10));
        });
    }
  }, [propertyId]);

  const reports = [
    { title: "Daily Manager's Report", slug: 'managers-flash', desc: "Overview of revenue, occupancy, and ADR.", icon: FileText, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { title: "Detailed Revenue Report", slug: 'detailed-revenue', desc: "Breakdown of revenue by department and code.", icon: FileSpreadsheet, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    { title: "Trial Balance", slug: 'trial-balance', desc: "Accounting trial balance for the business date.", icon: FileText, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
    { title: "Cashier Shift Summary", slug: 'cashier-summary', desc: "Consolidated view of all shift drops and variances.", icon: FileText, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
    { title: "In-House Guest List", slug: 'in-house-guests', desc: "Roster of all guests currently checked in.", icon: FileText, color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-900/30" },
    { title: "Departures & Arrivals", slug: 'departures-arrivals', desc: "Expected movements for the upcoming day.", icon: FileText, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
    { title: "Payment Reconciliation", slug: 'payment-reconciliation', desc: "All payments and refunds by method.", icon: FileSpreadsheet, color: "text-teal-500", bg: "bg-teal-100 dark:bg-teal-900/30" },
    { title: "Transaction Journal", slug: 'transaction-journal', desc: "Chronological ledger of all postings.", icon: FileText, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" },
    { title: "Exceptions Report", slug: 'exceptions-report', desc: "Voids, refunds, discounts, and comps.", icon: FileText, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
    { title: "POS Reconciliation", slug: 'pos-reconciliation', desc: "POS sales, variances, and room charges.", icon: FileSpreadsheet, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
    { title: "Room-Charge Detail", slug: 'room-charge-detail', desc: "All ancillary charges posted to guest folios.", icon: FileText, color: "text-cyan-500", bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
            Reports Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and export daily audit reports.
          </p>
        </div>
        <Link href="/night-audit/reconciliation">
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Open reconciliation
          </Button>
        </Link>
      </div>

      <div className="w-full">
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 text-sm text-indigo-950">
            <p className="font-semibold">Night audit report pack</p>
            <p className="mt-1 text-indigo-800/70">Use the standard reports below for the close review. Custom and scheduled reporting belongs in the management reporting workspace.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report, idx) => (
              <Card key={idx} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${report.bg}`}>
                      <report.icon className={`h-6 w-6 ${report.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{report.desc}</CardDescription>
                </CardContent>
                <CardFooter className="pt-2 flex gap-2 border-t mt-4 bg-muted/10 rounded-b-xl">
                  <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground hover:text-foreground" onClick={() => {
                    if (businessDate) {
                      const reportBasePath = managerMode ? '/general-manager/night-audit/reports/print' : '/night-audit/reports/print';
                      window.location.href = `${reportBasePath}/${report.slug}?propertyId=${propertyId}&businessDate=${businessDate}`;
                    } else {
                      alert('Business date is required to view reports.');
                    }
                  }}>
                    <FileText className="h-4 w-4 mr-2" /> View Report
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
      </div>
    </div>
  );
}
