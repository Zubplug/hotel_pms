'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock as Clock3, Download, Printer, Share2, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProperty } from '@/components/PropertyProvider';

export default function ReportsGeneratorPage() {
  const { propertyId } = useProperty();
  
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [flashReport, setFlashReport] = useState<any>(null);
  const [showFlashReport, setShowFlashReport] = useState(false);

  useEffect(() => {
    if (propertyId) {
      fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`)
        .then(res => res.json())
        .then(res => {
          if (res.data?.currentBusinessDate) setBusinessDate(res.data.currentBusinessDate);
        })
        .catch(console.error);
    }
  }, [propertyId]);

  const reports = [
    { title: "Daily Manager's Report", slug: 'managers-flash', desc: "Overview of revenue, occupancy, and ADR.", icon: FileText, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { title: "Detailed Revenue Report", slug: 'detailed-revenue', desc: "Breakdown of revenue by department and code.", icon: FileSpreadsheet, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    { title: "Trial Balance", slug: 'trial-balance', desc: "Accounting trial balance for the business date.", icon: FileText, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
    { title: "Cashier Shift Summary", slug: 'cashier-summary', desc: "Consolidated view of all shift drops and variances.", icon: FileText, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
    { title: "In-House Guest List", slug: 'in-house-guests', desc: "Roster of all guests currently checked in.", icon: FileText, color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-900/30" },
    { title: "Departures & Arrivals", slug: 'departures-arrivals', desc: "Expected movements for the upcoming day.", icon: FileText, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
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
        <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Download className="h-4 w-4" />
          Download Night Audit Pack
        </Button>
      </div>

      <Tabs defaultValue="standard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="standard">Standard Reports</TabsTrigger>
          <TabsTrigger value="custom">Custom Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>
        <TabsContent value="standard">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      window.location.href = `/night-audit/reports/print/${report.slug}?propertyId=${propertyId}&businessDate=${businessDate}`;
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
        </TabsContent>
        <TabsContent value="custom">
          <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-20" />
            <p>Custom reports coming soon</p>
          </div>
        </TabsContent>
        <TabsContent value="scheduled">
          <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <Clock3 className="mx-auto h-8 w-8 mb-2 opacity-20" />
            <p>Scheduled reports coming soon</p>
          </div>
        </TabsContent>
      </Tabs>



    </div>
  );
}
