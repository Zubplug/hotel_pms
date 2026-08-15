'use client';

import { useState } from 'react';
import { format, isPast, isFuture, isWithinInterval, differenceInDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  KeySquare, ShieldCheck, ShieldOff, Clock, CreditCard,
  ChevronDown, ChevronUp, CheckCircle2,
  CalendarDays, Fingerprint, Wifi, RefreshCw
} from 'lucide-react';
import { ExtendKeyCardDialog } from '../reservations/ExtendKeyCardDialog';
import { cn } from '@/lib/utils';

function getCredentialStatusConfig(cred: any) {
  const now = new Date();
  const validFrom = new Date(cred.validFrom);
  const validUntil = new Date(cred.validUntil);

  if (cred.status === 'REVOKED') return { label: 'Revoked', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', icon: ShieldOff };
  if (cred.status === 'EXPIRED' || isPast(validUntil)) return { label: 'Expired', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', icon: Clock };
  if (cred.status === 'PENDING' || isFuture(validFrom)) return { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: Clock };
  if (isWithinInterval(now, { start: validFrom, end: validUntil })) return { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: ShieldCheck };
  return { label: cred.status, color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', icon: CreditCard };
}

function getCredentialTypeIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'rfid': return CreditCard;
    case 'nfc': return Wifi;
    default: return KeySquare;
  }
}

function getOperationStatusColor(status: string) {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
    case 'ACTIVE': return 'text-emerald-600';
    case 'FAILED': return 'text-red-600';
    case 'WAITING_FOR_CARD':
    case 'ENCODING':
    case 'CARD_DETECTED':
    case 'DISPATCHING': return 'text-amber-600';
    default: return 'text-slate-500';
  }
}

function getOperationLabel(op: string) {
  const map: Record<string, string> = {
    CREATE_CREDENTIAL: 'Create Credential',
    ENCODE_CARD: 'Encode Card',
    VERIFY_CARD: 'Verify Card',
    REVOKE_CREDENTIAL: 'Revoke Card',
    READ_CARD: 'Read Card',
  };
  return map[op] || op;
}

function CredentialCard({ cred, reservation }: { cred: any; reservation: any }) {
  const config = getCredentialStatusConfig(cred);
  const TypeIcon = getCredentialTypeIcon(cred.credentialType);
  const StatusIcon = config.icon;
  const [showExtend, setShowExtend] = useState(false);

  const validUntil = new Date(cred.validUntil);
  const validFrom = new Date(cred.validFrom);
  const daysLeft = differenceInDays(validUntil, new Date());
  const isActive = config.label === 'Active';
  const isExpiringSoon = isActive && daysLeft <= 1;
  const isExpired = config.label === 'Expired';

  return (
    <>
      <div className={cn(
        'border-2 rounded-2xl p-5 space-y-4 transition-all duration-300 relative overflow-hidden',
        isActive ? 'border-emerald-200 bg-emerald-50/50' : isExpired ? 'border-slate-200 opacity-70 bg-white' : cred.status === 'REVOKED' ? 'border-red-200 opacity-70 bg-white' : 'border-slate-200 bg-white'
      )}>
        {isActive && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -mr-16 -mt-16 pointer-events-none" />
        )}
        
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-3 rounded-xl shadow-sm',
              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 capitalize text-lg tracking-tight">{cred.credentialType?.toUpperCase() || 'KEY'} Card</p>
                <Badge variant="outline" className={cn('px-2.5 py-0.5 rounded-full font-semibold shadow-sm border-2', config.color)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', config.dot)} />
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-0.5">ID: <span className="font-mono">{cred.id.slice(0, 8).toUpperCase()}</span></p>
            </div>
          </div>
          <StatusIcon className={cn('w-6 h-6 shrink-0 mt-1', isActive ? 'text-emerald-500' : 'text-slate-400')} />
        </div>

        {/* Validity bar */}
        {isActive && (
          <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm relative z-10 flex justify-between text-sm font-medium">
            <span className="text-slate-600">Valid from {format(validFrom, 'MMM d, yyyy')}</span>
            <span className={cn(isExpiringSoon ? 'text-amber-600 font-bold' : 'text-emerald-700')}>
              {isExpiringSoon ? `⚠️ Expires in ${daysLeft === 0 ? 'less than a day' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}` : `Expires ${format(validUntil, 'MMM d, yyyy')}`}
            </span>
          </div>
        )}

        {/* Grid of details */}
        <div className="grid grid-cols-2 gap-4 text-sm relative z-10 bg-white/60 p-4 rounded-xl border border-slate-100">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <CalendarDays className="w-3.5 h-3.5" /> Valid From
            </p>
            <p className="font-bold text-slate-800">{format(validFrom, 'MMM d, yyyy p')}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <CalendarDays className="w-3.5 h-3.5" /> Valid Until
            </p>
            <p className={cn('font-bold', isExpiringSoon ? 'text-amber-600' : 'text-slate-800')}>{format(validUntil, 'MMM d, yyyy p')}</p>
          </div>
          {cred.issuedAt && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Issued At
              </p>
              <p className="font-bold text-slate-800">{format(new Date(cred.issuedAt), 'MMM d, yyyy p')}</p>
            </div>
          )}
          {cred.revokedAt && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <ShieldOff className="w-3.5 h-3.5" /> Revoked At
              </p>
              <p className="font-bold text-red-600">{format(new Date(cred.revokedAt), 'MMM d, yyyy p')}</p>
            </div>
          )}
          {cred.cardSerialNumber && (
            <div className="col-span-2 pt-2 border-t border-slate-100 mt-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Fingerprint className="w-3.5 h-3.5" /> Card Serial Number
              </p>
              <p className="font-mono text-sm font-bold text-slate-700 tracking-wider bg-slate-100 px-2 py-1 rounded inline-block">{cred.cardSerialNumber}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isActive && reservation.status === 'CHECKED_IN' && (
          <div className="pt-2 relative z-10">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-2 border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-50 hover:text-emerald-800 shadow-sm"
              onClick={() => setShowExtend(true)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Extend / Re-encode Card
            </Button>
          </div>
        )}
      </div>

      <ExtendKeyCardDialog
        open={showExtend}
        onOpenChange={setShowExtend}
        reservation={reservation}
      />
    </>
  );
}

function OperationRow({ op }: { op: any }) {
  const statusColor = getOperationStatusColor(op.status);
  const responseData = op.command?.responseData as Record<string, any> | null;

  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
      <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm', statusColor.replace('text-', 'bg-'))} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-800 tracking-tight">{getOperationLabel(op.operation)}</p>
          <p className="text-xs font-semibold text-slate-400">{format(new Date(op.requestedAt), 'MMM d, HH:mm:ss')}</p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className={cn('text-[10px] uppercase font-black px-2 py-0', statusColor.replace('text-', 'bg-').replace('600', '100'), statusColor)}>
            {op.status}
          </Badge>
          {op.errorMessage && (
            <span className="text-xs font-medium text-red-500 truncate bg-red-50 px-2 py-0.5 rounded-full">— {op.errorMessage}</span>
          )}
        </div>
        {responseData && op.operation === 'READ_CARD' && (
          <div className="mt-2.5 flex flex-wrap gap-3 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
            {responseData.roomNo && <span className="flex items-center gap-1.5"><KeySquare className="w-3.5 h-3.5 text-slate-400" /> Room: <span className="font-bold text-slate-800">{responseData.roomNo}</span></span>}
            {responseData.cardSnr && <span className="flex items-center gap-1.5"><Fingerprint className="w-3.5 h-3.5 text-slate-400" /> SNR: <span className="font-mono font-bold text-slate-800">{responseData.cardSnr}</span></span>}
            {responseData.guestName && <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-slate-400" /> Guest: <span className="font-bold text-slate-800">{responseData.guestName}</span></span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function FrontDeskCardInformationSection({ reservation }: { reservation: any }) {
  const [showAllOps, setShowAllOps] = useState(false);

  const credentials = reservation.lockCredentials || [];
  const operations = reservation.lockOperations || [];
  const visibleOps = showAllOps ? operations : operations.slice(0, 5);

  if (credentials.length === 0 && operations.length === 0) {
    return (
      <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden mt-6">
        <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-200 p-2 rounded-xl">
              <KeySquare className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Key Cards</h3>
          </div>
        </div>
        <CardContent className="p-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-slate-100 p-5 rounded-full shadow-inner">
              <CreditCard className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-lg">No key cards issued</p>
              <p className="text-sm font-medium text-slate-500 mt-1">Cards will appear here after check-in is processed.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl shadow-sm">
              <KeySquare className="w-5 h-5 text-blue-700" />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Key Cards</h3>
          </div>
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 text-sm rounded-full shadow-sm">
            {credentials.length} {credentials.length === 1 ? 'Card' : 'Cards'} Active
          </Badge>
        </div>
        <CardContent className="p-6 space-y-4 bg-slate-50/30">
          {credentials.length > 0 ? (
            credentials.map((cred: any) => (
              <CredentialCard key={cred.id} cred={cred} reservation={reservation} />
            ))
          ) : (
            <p className="text-sm font-medium text-slate-500 text-center py-6">No credentials issued yet</p>
          )}
        </CardContent>
      </Card>

      {operations.length > 0 && (
        <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-200 p-2 rounded-xl shadow-sm">
                <Clock className="w-5 h-5 text-slate-700" />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Hardware Activity Log</h3>
            </div>
            <Badge variant="outline" className="font-bold text-slate-500 rounded-full bg-white border-slate-200 shadow-sm">
              {operations.length} events
            </Badge>
          </div>
          <CardContent className="p-6 bg-slate-50/30">
            <div className="divide-y-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
              {visibleOps.map((op: any) => (
                <OperationRow key={op.id} op={op} />
              ))}
              {operations.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full mt-3 h-12 rounded-xl text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setShowAllOps(!showAllOps)}
                >
                  {showAllOps ? (
                    <><ChevronUp className="w-5 h-5 mr-2" /> Show Less</>
                  ) : (
                    <><ChevronDown className="w-5 h-5 mr-2" /> Show {operations.length - 5} More Events</>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
