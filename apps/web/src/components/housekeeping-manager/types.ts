export type ViewMode = 'overview' | 'tasks' | 'maintenance' | 'rooms' | 'reports';

export type HousekeepingStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'CLEANING'
  | 'CLEAN'
  | 'INSPECTED'
  | 'CANCELLED'
  | 'MAINTENANCE_REQUIRED';

export type MaintenanceStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_PARTS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL' | 'VIP' | 'EARLY_ARRIVAL';

export type HousekeepingTask = {
  id: string;
  roomId: string;
  status: HousekeepingStatus | string;
  priority: Priority | string;
  type: string;
  notes?: string | null;
  assignedTo?: string | null;
  businessDate?: string;
  startedAt?: string | null;
  inspectedAt?: string | null;
  room?: { number?: string; roomType?: { name?: string }; status?: string; housekeepingStatus?: string };
};

export type MaintenanceTicket = {
  id: string;
  title: string;
  description: string;
  status: MaintenanceStatus | string;
  priority: Priority | string;
  roomId?: string | null;
  roomNumber?: string;
  location?: string | null;
  category?: { name?: string };
  assignedTo?: string | null;
  createdAt: string;
  scheduledAt?: string | null;
  actualCost?: number | string | null;
  notes?: string | null;
};

export type OperationalRoom = {
  id: string;
  number: string;
  displayName?: string | null;
  status: string;
  housekeepingStatus: string;
  maintenanceStatus?: string;
  roomType?: { name?: string; code?: string };
  floor?: { name?: string; number?: number };
  building?: { name?: string };
};

export type ManagerMetrics = {
  totalRooms: number;
  readyRooms: number;
  cleaningRooms: number;
  blockedRooms: number;
  cleaningQueue: number;
  inspected: number;
  openTickets: number;
  criticalTickets: number;
};
