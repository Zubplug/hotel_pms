// Shared utilities for the Pool Terminal module

// ─── Money formatting ─────────────────────────────────────────────────────────

export function formatMoney(amount: number, currency = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDuration(start: string | Date, end: string | Date | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Status colours ────────────────────────────────────────────────────────────

export type EntryStatus = 'RESERVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SafetyStatus = 'PASS' | 'ATTENTION' | 'FAILED';
export type ResourceStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';
export type FacilityStatus = 'OPEN' | 'CLOSED' | 'MAINTENANCE' | 'WEATHER_HOLD';

export const ENTRY_STATUS_STYLES: Record<EntryStatus, { bg: string; text: string; label: string }> = {
  RESERVED:  { bg: 'rgba(56,189,248,0.14)',  text: '#38bdf8', label: 'Reserved' },
  ACTIVE:    { bg: 'rgba(16,185,129,0.14)',   text: '#34d399', label: 'Active' },
  COMPLETED: { bg: 'rgba(100,116,139,0.18)',  text: '#94a3b8', label: 'Checked Out' },
  CANCELLED: { bg: 'rgba(244,63,94,0.14)',    text: '#fda4af', label: 'Cancelled' },
};

export const INCIDENT_STATUS_STYLES: Record<IncidentStatus, { bg: string; text: string; label: string }> = {
  OPEN:          { bg: 'rgba(245,158,11,0.14)',  text: '#fcd34d', label: 'Open' },
  INVESTIGATING: { bg: 'rgba(249,115,22,0.14)',  text: '#fb923c', label: 'Investigating' },
  RESOLVED:      { bg: 'rgba(16,185,129,0.14)',  text: '#34d399', label: 'Resolved' },
};

export const INCIDENT_SEVERITY_STYLES: Record<IncidentSeverity, { bg: string; text: string; dot: string }> = {
  LOW:      { bg: 'rgba(100,116,139,0.14)', text: '#94a3b8', dot: '#64748b' },
  MEDIUM:   { bg: 'rgba(245,158,11,0.14)',  text: '#fcd34d', dot: '#f59e0b' },
  HIGH:     { bg: 'rgba(249,115,22,0.14)',  text: '#fb923c', dot: '#f97316' },
  CRITICAL: { bg: 'rgba(244,63,94,0.18)',   text: '#fda4af', dot: '#ef4444' },
};

export const SAFETY_STATUS_STYLES: Record<SafetyStatus, { bg: string; text: string; label: string; icon: string }> = {
  PASS:      { bg: 'rgba(16,185,129,0.14)',  text: '#34d399', label: 'Pass',      icon: '✓' },
  ATTENTION: { bg: 'rgba(245,158,11,0.14)',  text: '#fcd34d', label: 'Attention', icon: '⚠' },
  FAILED:    { bg: 'rgba(244,63,94,0.14)',   text: '#fda4af', label: 'Failed',    icon: '✕' },
};

export const RESOURCE_STATUS_STYLES: Record<ResourceStatus, { bg: string; text: string; label: string }> = {
  AVAILABLE:   { bg: 'rgba(16,185,129,0.14)',  text: '#34d399', label: 'Available' },
  OCCUPIED:    { bg: 'rgba(56,189,248,0.14)',   text: '#38bdf8', label: 'Occupied' },
  CLEANING:    { bg: 'rgba(245,158,11,0.14)',   text: '#fcd34d', label: 'Cleaning' },
  MAINTENANCE: { bg: 'rgba(244,63,94,0.14)',    text: '#fda4af', label: 'Maintenance' },
};

export const FACILITY_STATUS_STYLES: Record<FacilityStatus, { bg: string; text: string; label: string }> = {
  OPEN:         { bg: 'rgba(16,185,129,0.14)',  text: '#34d399', label: 'Open' },
  CLOSED:       { bg: 'rgba(244,63,94,0.14)',   text: '#fda4af', label: 'Closed' },
  MAINTENANCE:  { bg: 'rgba(244,63,94,0.14)',   text: '#fda4af', label: 'Maintenance' },
  WEATHER_HOLD: { bg: 'rgba(245,158,11,0.14)',  text: '#fcd34d', label: 'Weather Hold' },
};

// ─── Safety gate logic ─────────────────────────────────────────────────────────

export interface SafetyGateResult {
  blocked: boolean;
  warning: string | null;
  reason: 'FAILED_CHECK' | 'CRITICAL_INCIDENT' | 'FACILITY_CLOSED' | null;
}

export function evaluateSafetyGate(params: {
  facilityStatus: FacilityStatus;
  latestSafetyCheck: { status: SafetyStatus; checkType: string; checkedAt: string } | null;
  openIncidents: { severity: IncidentSeverity }[];
}): SafetyGateResult {
  const { facilityStatus, latestSafetyCheck, openIncidents } = params;

  if (facilityStatus !== 'OPEN') {
    return {
      blocked: true,
      warning: `The pool facility is ${facilityStatus.replace(/_/g, ' ')}. New admissions are not permitted.`,
      reason: 'FACILITY_CLOSED',
    };
  }

  const hasCriticalIncident = openIncidents.some((i) => i.severity === 'CRITICAL');
  if (hasCriticalIncident) {
    return {
      blocked: true,
      warning: 'A CRITICAL incident is open. Resolve it before admitting new guests.',
      reason: 'CRITICAL_INCIDENT',
    };
  }

  if (latestSafetyCheck?.status === 'FAILED') {
    return {
      blocked: false, // warn but allow — operator can override
      warning: `Last safety check FAILED (${latestSafetyCheck.checkType}). Complete a passing check before admitting guests.`,
      reason: 'FAILED_CHECK',
    };
  }

  return { blocked: false, warning: null, reason: null };
}

// ─── Occupancy helpers ─────────────────────────────────────────────────────────

/** Authoritative occupancy rule: only ACTIVE entries count against capacity */
export function calcOccupancy(entries: { status: string; guestCount: number }[]): number {
  return entries.filter((e) => e.status === 'ACTIVE').reduce((sum, e) => sum + e.guestCount, 0);
}

export function occupancyPct(occupied: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((occupied / capacity) * 100));
}

export function occupancyColour(pct: number): string {
  if (pct >= 95) return '#ef4444';
  if (pct >= 80) return '#f59e0b';
  return '#38bdf8';
}

// ─── Operation ID generator ────────────────────────────────────────────────────

export function newOperationId(prefix = 'OP'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// ─── Role gate ─────────────────────────────────────────────────────────────────

export const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR'];

// ─── Guest class labels ────────────────────────────────────────────────────────

export const GUEST_CLASS_LABELS: Record<string, string> = {
  ADULT: 'Adult',
  CHILD: 'Child',
  INFANT: 'Infant',
  SENIOR: 'Senior',
  STAFF: 'Staff',
  COMPLIMENTARY: 'Complimentary',
};

// ─── API helpers ───────────────────────────────────────────────────────────────

export const POOL_API = '/api/v1/pos/swimming-pool';
