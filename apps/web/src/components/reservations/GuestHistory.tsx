import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GuestHistory({ guest }: { guest: any }) {
  const pastReservations = guest?.reservations || [];

  if (!pastReservations || pastReservations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No past reservations found for this guest.
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number, currency?: string | null) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'NGN' }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" /> Guest Stay History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pastReservations.map((res: any) => (
            <div key={res.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/30 rounded-lg border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">#{res.confirmationNumber}</span>
                  <Badge variant={res.status === 'CHECKED_OUT' ? 'default' : res.status === 'CANCELLED' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {res.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">at {res.property?.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(res.checkIn), 'MMM d, yyyy')} - {format(new Date(res.checkOut), 'MMM d, yyyy')}
                </div>
                <div className="text-xs font-medium mt-1">
                  Room: {res.reservationRooms?.[0]?.room?.number || 'Unassigned'} • {res.adults} Adults, {res.children} Children
                </div>
              </div>
              
              <div className="mt-3 sm:mt-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3">
                <div className="font-bold text-primary">
                  {formatCurrency(res.ratePlanSnapshot?.total || 0, res.currency || 'NGN')}
                </div>
                <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                  <Link href={`/reservations/${res.id}`}>
                    View Folio <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
