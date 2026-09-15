import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KanbanBoard } from '@/components/events/KanbanBoard';
import { AddLeadDialog } from '@/components/events/AddLeadDialog';
import { prisma } from '@hotel-pms/db';

export const metadata: Metadata = {
  title: 'Event CRM | LodgeCore',
};

export default async function EventCrmPage() {
  const leads = await prisma.eventLead.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event CRM</h1>
          <p className="text-muted-foreground mt-1">Track inquiries, generate proposals, and manage the sales pipeline.</p>
        </div>
        <AddLeadDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline (Kanban)</CardTitle>
          <CardDescription>Drag and drop leads to update their status.</CardDescription>
        </CardHeader>
        <CardContent>
          <KanbanBoard initialLeads={leads} />
        </CardContent>
      </Card>
    </div>
  );
}
