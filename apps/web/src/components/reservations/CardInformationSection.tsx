'use client';

import { useState } from 'react';
import { format, isPast, isFuture, isWithinInterval, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  KeySquare, ShieldCheck, ShieldOff, Clock, CreditCard,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  Hash, CalendarDays, Fingerprint, Wifi, RefreshCw
} from 'lucide-react';
import { ExtendKeyCardDialog } from './ExtendKeyCardDialog';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCredentialStatusConfig(cred: any) {
  const now = new Date();
  const validFrom = new Date(cred.validFrom);
  const validUntil = new Date(cred.validUntil);

  if (cred.status === 'REVOKED') return { label: 'Revoked', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800', dot: 'bg-red-500', icon: ShieldOff };
  if (cred.status === 'EXPIRED' || isPast(validUntil)) return { label: 'Expired', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700', dot: 'bg-gray-400', icon: Clock };
  if (cred.status === 'PENDING' || isFuture(validFrom)) return { label: 'Pending', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', icon: Clock };
  if (isWithinInterval(now, { start: validFrom, end: validUntil })) return { label: 'Active', color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800', dot: 'bg-green-500', icon: ShieldCheck };
  return { label: cred.status, color: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400', icon: CreditCard };
}

function getCredentialTypeIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'rfid': return CreditCard;
    case 'nfc': return Wifi;
    case 'pin': return Hash;
    default: return KeySquare;
  }
}

function getOperationStatusColor(status: string) {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
    case 'ACTIVE': return 'text-green-500';
    case 'FAILED': return 'text-red-500';
    case 'WAITING_FOR_CARD':
    case 'ENCODING':
    case 'CARD_DETECTED':
    case 'DISPATCHING': return 'text-amber-500';
    default: return 'text-muted-foreground';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        'border rounded-xl p-4 space-y-4 transition-all',
        isActive && 'border-green-200 dark:border-green-900 bg-green-500/5',
        isExpired && 'border-gray-200 dark:border-gray-700 opacity-70',
        cred.status === 'REVOKED' && 'border-red-200 dark:border-red-900 opacity-60',
        !isActive && !isExpired && cred.status !== 'REVOKED' && 'border-border'
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-lg',
              isActive ? 'bg-green-500/10' : 'bg-muted'
            )}>
              <TypeIcon className={cn('w-5 h-5', isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold capitalize">{cred.credentialType?.toUpperCase() || 'KEY'} Card</p>
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border',
                  config.color
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">ID: {cred.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <StatusIcon className={cn('w-5 h-5 shrink-0 mt-0.5', isActive ? 'text-green-500' : 'text-muted-foreground')} />
        </div>

        {/* Validity bar */}
        {isActive && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Valid from {format(validFrom, 'MMM d, yyyy')}</span>
              <span className={cn(isExpiringSoon ? 'text-amber-500 font-medium' : '')}>
                {isExpiringSoon ? `⚠️ Expires in ${daysLeft === 0 ? 'less than a day' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}` : `Expires ${format(validUntil, 'MMM d, yyyy')}`}
              </span>
            </div>
          </div>
        )}

        {/* Grid of details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
              <CalendarDays className="w-3 h-3" /> Valid From
            </p>
            <p className="font-medium">{format(validFrom, 'PPP p')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
              <CalendarDays className="w-3 h-3" /> Valid Until
            </p>
            <p className={cn('font-medium', isExpiringSoon && 'text-amber-500')}>{format(validUntil, 'PPP p')}</p>
          </div>
          {cred.issuedAt && (
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                <CheckCircle2 className="w-3 h-3" /> Issued At
              </p>
              <p className="font-medium">{format(new Date(cred.issuedAt), 'PPP p')}</p>
            </div>
          )}
          {cred.revokedAt && (
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                <ShieldOff className="w-3 h-3" /> Revoked At
              </p>
              <p className="font-medium text-red-500">{format(new Date(cred.revokedAt), 'PPP p')}</p>
            </div>
          )}
          {cred.cardSerialNumber && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                <Fingerprint className="w-3 h-3" /> Card Serial Number
              </p>
              <p className="font-mono text-sm font-medium tracking-wider">{cred.cardSerialNumber}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isActive && reservation.status === 'CHECKED_IN' && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setShowExtend(true)}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OperationRow({ op }: { op: any }) {
  const statusColor = getOperationStatusColor(op.status);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseData = op.command?.responseData as Record<string, any> | null;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', statusColor.replace('text-', 'bg-'))} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium">{getOperationLabel(op.operation)}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(op.requestedAt), 'MMM d, HH:mm:ss')}</p>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={cn('text-xs font-medium', statusColor)}>{op.status}</span>
          {op.errorMessage && (
            <span className="text-xs text-red-400 truncate">— {op.errorMessage}</span>
          )}
        </div>
        {/* Show card data from READ_CARD responses */}
        {responseData && op.operation === 'READ_CARD' && (
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
            {responseData.roomNo && <span>Room: <span className="font-medium text-foreground">{responseData.roomNo}</span></span>}
            {responseData.cardSnr && <span>SNR: <span className="font-mono font-medium text-foreground">{responseData.cardSnr}</span></span>}
            {responseData.guestName && <span>Guest: <span className="font-medium text-foreground">{responseData.guestName}</span></span>}
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CardInformationSection({ reservation }: { reservation: any }) {
  const [showAllOps, setShowAllOps] = useState(false);

  const credentials = reservation.lockCredentials || [];
  const operations = reservation.lockOperations || [];
  const visibleOps = showAllOps ? operations : operations.slice(0, 5);

  const activeCredential = credentials.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => c.status === 'ACTIVE'
  );

  if (credentials.length === 0 && operations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeySquare className="w-5 h-5 text-primary" /> Card Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center space-y-2">
            <div className="bg-muted p-3 rounded-full">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">No key cards issued</p>
            <p className="text-sm text-muted-foreground">Cards will appear here after check-in</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <KeySquare className="w-5 h-5 text-primary" /> Key Cards
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {credentials.length} {credentials.length === 1 ? 'card' : 'cards'} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {credentials.length > 0 ? (
            credentials.map((cred: any) => (
              <CredentialCard key={cred.id} cred={cred} reservation={reservation} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No credentials issued yet</p>
          )}
        </CardContent>
      </Card>

      {/* Hardware Operations Log */}
      {operations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-primary" /> Hardware Activity Log
              </CardTitle>
              <span className="text-xs text-muted-foreground">{operations.length} events</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y-0">
              {visibleOps.map((op: any) => (
                <OperationRow key={op.id} op={op} />
              ))}
            </div>
            {operations.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-muted-foreground"
                onClick={() => setShowAllOps(!showAllOps)}
              >
                {showAllOps ? (
                  <><ChevronUp className="w-4 h-4 mr-1" /> Show Less</>
                ) : (
                  <><ChevronDown className="w-4 h-4 mr-1" /> Show {operations.length - 5} More</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
