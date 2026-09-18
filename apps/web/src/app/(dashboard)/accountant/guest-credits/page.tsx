import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wallet, Users } from 'lucide-react';

const formatCurrency = (amount: number, currency: string) => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const formatDate = (date: Date) => 
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);

export default async function GuestCreditsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fguest-credits');
  
  const propertyId = session.user.propertyId;
  if (!propertyId) return <div className="p-8 text-slate-300">No property is assigned to this user.</div>;

  const entries = await prisma.cityLedgerEntry.findMany({
    where: {
      propertyId,
      type: 'REFUND_OWED',
      status: 'OPEN'
    },
    include: {
      guest: {
        select: { id: true, firstName: true, lastName: true, phone: true, email: true }
      },
      allocations: {
        select: { id: true, amount: true, folioId: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const byGuest = new Map<string, {
    guestId: string;
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    availableAmount: number;
    currency: string;
    lastActivityAt: Date;
    creditEntryIds: string[];
  }>();

  let totalOutstanding = 0;
  const currencyCode = entries.length > 0 ? entries[0].currency : 'NGN';

  for (const entry of entries) {
    const guestId = entry.guestId;
    if (!guestId) continue;

    const allocated = entry.allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
    const available = Number(entry.amount) - allocated;

    if (available <= 0.01) continue;

    if (!byGuest.has(guestId)) {
      byGuest.set(guestId, {
        guestId,
        guestName: entry.guest ? `${entry.guest.firstName} ${entry.guest.lastName}`.trim() : 'Unknown Guest',
        guestPhone: entry.guest?.phone ?? '',
        guestEmail: entry.guest?.email ?? '',
        availableAmount: 0,
        currency: entry.currency,
        lastActivityAt: entry.createdAt,
        creditEntryIds: []
      });
    }

    const rec = byGuest.get(guestId)!;
    rec.availableAmount += available;
    if (entry.createdAt > rec.lastActivityAt) rec.lastActivityAt = entry.createdAt;
    rec.creditEntryIds.push(entry.id);
    
    totalOutstanding += available;
  }

  const guestsWithCredit = Array.from(byGuest.values()).sort((a, b) => b.availableAmount - a.availableAmount);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Guest Credits</h1>
        <p className="text-slate-400">View and track all outstanding guest credit balances (Refunds Owed).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Outstanding Credit</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalOutstanding, currencyCode)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Guests with Balances</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{guestsWithCredit.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Active Guest Credits</CardTitle>
          <CardDescription className="text-slate-400">Guests with a net positive credit balance.</CardDescription>
        </CardHeader>
        <CardContent>
          {guestsWithCredit.length === 0 ? (
            <div className="text-center p-8 text-slate-400 border border-slate-800 border-dashed rounded-lg">
              No outstanding guest credits found.
            </div>
          ) : (
            <div className="rounded-md border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-950/50">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Guest Name</TableHead>
                    <TableHead className="text-slate-400">Contact</TableHead>
                    <TableHead className="text-slate-400">Available Balance</TableHead>
                    <TableHead className="text-slate-400">Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guestsWithCredit.map((guest) => (
                    <TableRow key={guest.guestId} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <TableCell className="font-medium text-slate-200">{guest.guestName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {guest.guestEmail ? <span className="text-sm text-slate-300">{guest.guestEmail}</span> : <span className="text-sm text-slate-500 italic">No email</span>}
                          {guest.guestPhone ? <span className="text-xs text-slate-400">{guest.guestPhone}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold px-2 py-1">
                          {formatCurrency(guest.availableAmount, guest.currency)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {formatDate(guest.lastActivityAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
