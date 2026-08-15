import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationTimeline({ auditLogs }: { auditLogs: any[] }) {
  if (!auditLogs || auditLogs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No timeline events found.
        </CardContent>
      </Card>
    );
  }

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATED')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (action.includes('UPDATED')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (action.includes('CANCELLED')) return 'bg-red-100 text-red-800 border-red-200';
    if (action.includes('CHECK_IN')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (action.includes('CHECK_OUT')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (action.includes('PAYMENT')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Reservation Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative border-l-2 border-muted ml-3 space-y-6">
          {auditLogs.map((log) => (
            <div key={log.id} className="relative pl-6">
              <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 border-primary" />
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getActionColor(log.action)}>
                    {formatAction(log.action)}
                  </Badge>
                  <span className="text-sm font-medium">{log.userEmail}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                </span>
              </div>
              
              {log.newValue && (
                <div className="mt-2 text-xs bg-muted/30 rounded p-3 overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre-wrap font-mono">
                    {JSON.stringify(log.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
