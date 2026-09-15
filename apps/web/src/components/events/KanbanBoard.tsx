'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { updateEventLeadStatus } from '@/lib/events/crm-actions';

const COLUMNS = [
  { id: 'NEW', label: 'New Inquiries', color: 'bg-blue-500' },
  { id: 'PROPOSAL', label: 'Proposal Sent', color: 'bg-amber-500' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500' },
  { id: 'WON', label: 'Closed Won', color: 'bg-emerald-500' },
  { id: 'LOST', label: 'Closed Lost', color: 'bg-slate-500' }
];

export function KanbanBoard({ initialLeads }: { initialLeads: any[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [isPending, startTransition] = useTransition();

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    // Optimistic Update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));

    // Server Action
    startTransition(async () => {
      try {
        await updateEventLeadStatus(leadId, status);
      } catch (err) {
        // Rollback on failure (naive reload or pass back)
        console.error("Failed to update status", err);
      }
    });
  };

  return (
    <div className="w-full flex gap-4 h-[600px] overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const columnLeads = leads.filter(l => l.status === col.id);
        return (
          <div 
            key={col.id} 
            className="flex-none w-80 flex flex-col bg-slate-50/50 rounded-lg border"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="p-3 border-b bg-white rounded-t-lg flex items-center justify-between">
              <h3 className="font-semibold text-sm">{col.label} <span className="text-muted-foreground font-normal">({columnLeads.length})</span></h3>
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
            </div>
            <div className="p-2 flex-1 overflow-y-auto space-y-2">
              {columnLeads.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 opacity-50">Drop leads here</div>
              )}
              {columnLeads.map(lead => (
                <Card 
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className={`shadow-sm cursor-grab active:cursor-grabbing hover:border-primary ${isPending ? 'opacity-80' : ''}`}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="font-medium text-sm truncate">{lead.eventName}</div>
                    <div className="text-xs text-muted-foreground truncate">{lead.contactName} • {lead.expectedGuests} pax</div>
                    <div className="text-xs font-semibold text-emerald-600">
                      NGN {Number(lead.estimatedValue || 0).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
