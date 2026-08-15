'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Wrench, Clock, AlertTriangle } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  roomId: string | null;
  property: {
    rooms: { id: string, number: string }[];
  };
  category: {
    name: string;
  };
  assignedTo: string | null;
  createdAt: string;
}

export default function MaintenancePage() {
  const { propertyId } = useProperty();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTickets() {
      if (!propertyId) return;
      try {
        const res = await fetch(`/api/v1/maintenance/tickets?propertyId=${propertyId}`);
        const data = await res.json();
        if (data.success && data.data?.tickets) {
          setTickets(data.data.tickets);
        }
      } catch (err) {
        console.error('Failed to load tickets', err);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, [propertyId]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return <Badge variant="destructive">Critical</Badge>;
      case 'HIGH': return <Badge className="bg-orange-500">High</Badge>;
      case 'NORMAL': return <Badge variant="secondary">Normal</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <Badge variant="outline" className="border-blue-500 text-blue-500">Open</Badge>;
      case 'ASSIGNED': return <Badge variant="secondary">Assigned</Badge>;
      case 'IN_PROGRESS': return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'WAITING_PARTS': return <Badge className="bg-orange-500">Waiting Parts</Badge>;
      case 'RESOLVED': return <Badge className="bg-green-500">Resolved</Badge>;
      case 'CLOSED': return <Badge variant="outline">Closed</Badge>;
      case 'CANCELLED': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/maintenance/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setTickets(tickets.map(t => t.id === id ? { ...t, status: status as any } : t));
      } else {
        alert(data.error?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading maintenance tickets...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-muted-foreground">Manage property issues and repairs</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search tickets..." className="pl-8" />
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg flex items-center">
            <Wrench className="mr-2 h-5 w-5 text-muted-foreground" />
            Active Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No maintenance tickets found.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((t) => {
                  const room = t.property.rooms.find(r => r.id === t.roomId);
                  const hours = Math.floor((new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
                  
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-nowrap">
                        {room ? room.number : 'General'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.category?.name || 'General'}</div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(t.priority)}</TableCell>
                      <TableCell>{getStatusBadge(t.status)}</TableCell>
                      <TableCell className="text-muted-foreground">{t.assignedTo ? 'Assigned' : '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {hours < 1 ? '< 1h' : `${hours}h`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.status === 'OPEN' && (
                          <Button variant="outline" size="sm" onClick={() => updateTicketStatus(t.id, 'IN_PROGRESS')}>
                            Start
                          </Button>
                        )}
                        {t.status === 'IN_PROGRESS' && (
                          <Button variant="default" size="sm" onClick={() => updateTicketStatus(t.id, 'RESOLVED')}>
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
