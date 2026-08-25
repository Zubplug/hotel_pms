import { LodgeCoreDataProvider } from './DataProvider';
import { invokeDesktop } from './IpcBridge';

const syncOperations = new Map<string, any>();

const normalizeRoomLookupReservation = (raw: any) => {
  if (!raw) return null;
  const rooms = raw.reservationRooms || raw.rooms || [];
  return {
    ...raw,
    id: raw.id || raw.reservationId,
    primaryGuest: raw.primaryGuest || raw.guest || null,
    reservationRooms: rooms,
    folios: raw.folios || (raw.folio ? [raw.folio] : []),
    balance: raw.balance ?? raw.folioBalance ?? raw.folio?.outstandingBalance ?? 0,
  };
};

export const DesktopDataProvider: LodgeCoreDataProvider = {
  auth: {
    getSession: async () => {
      return invokeDesktop('auth.getSession');
    },
    provisionDevice: async (deviceToken: string) => {
      return invokeDesktop('auth.provisionDevice', { deviceToken });
    },
    getActiveStaff: async () => {
      return invokeDesktop('auth.getActiveStaff');
    },
    login: async (staffId: string, pin: string, bankingModel?: string) => {
      return invokeDesktop('auth.login', { staffId, pin, bankingModel });
    },
    logout: async () => {
      return invokeDesktop('auth.logout');
    },
    lock: async () => {
      return invokeDesktop('auth.lock');
    },
    clearSession: async () => {
      return invokeDesktop('auth.clearSession');
    }
  },
  system: {
    getTerminalStatus: async () => {
      return invokeDesktop('system.getTerminalStatus');
    },
    provisionTerminal: async (data: any) => {
      return invokeDesktop('system.provisionTerminal', data);
    },
    forceSync: async () => {
      return invokeDesktop('system.forceSync');
    },
    getSyncHealth: async () => {
      return invokeDesktop('system.getSyncHealth');
    },
    getOutboxEvents: async () => {
      return invokeDesktop('sync.outbox');
    },
    getSyncEvents: async () => {
      return invokeDesktop('sync.events');
    },
    retryDeadLetters: async () => {
      return invokeDesktop('sync.retryDeadLetters');
    }
  },
  properties: {
    list: () => invokeDesktop('properties.list')
  },
  hardware: {
    poll: async (operationId) => {
      const status = operationId.includes('FAILED') ? 'FAILED' : 'SUCCESS';
      const responseData = syncOperations.get(operationId);
      return { success: true, data: { operation: { status, command: { responseData } } } };
    }
  },
  dashboard: {
    async get(propertyId: string) {
      return invokeDesktop('dashboard.get', { propertyId });
    }
  },
  refunds: {
    list: async (propertyId: string) => invokeDesktop('refunds.list', { propertyId }),
    request: async (data: any) => invokeDesktop('refunds.request', data),
  },

  guests: {
    list: async () => {
      return invokeDesktop('guests.list');
    },
    search: async (query: string) => {
      return invokeDesktop('guests.search', { query });
    }
  },
  
  roomTypes: {
    list: async (propertyId: string) => {
      return invokeDesktop('roomTypes.list', { propertyId });
    },
    create: async (data: any) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("Internet connection is required to create a new room type.");
      }
      const res = await fetch('/api/v1/room-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },
  
  reservations: {
    list: async (propertyId: string, params?: any) => {
      return invokeDesktop('reservations.list', { propertyId, params });
    },
    get: async (id: string) => {
      return invokeDesktop('reservations.get', { id });
    },
    lookupByRoom: async (roomNo: string, propertyId: string) => {
      try {
        const res = await invokeDesktop('reservations.lookupByRoom', { roomNo, propertyId });
        if (res && res.success && res.data) {
          return normalizeRoomLookupReservation(res.data);
        }
        return null;
      } catch (err) {
        return null;
      }
    },
    create: async (data: any) => {
      // Cloud required for creating new reservations to avoid double booking
      return invokeDesktop("reservations.create", { data: JSON.stringify(data) });
    },
    update: async (id: string, data: any) => {
      return invokeDesktop('reservations.update', { reservationId: id, ...data });
    },
    cancel: async (id: string, reason: string) => {
      return invokeDesktop('reservations.cancel', { id, reason });
    },
    markLateArrival: async (id: string, notes: string) => invokeDesktop('reservations.lateArrival', { id, notes }),
    assessNoShow: async (id: string) => invokeDesktop('reservations.noShow', { id }),
    reinstate: async (id: string, reason: string) => invokeDesktop('reservations.reinstate', { id, reason }),
    checkIn: async (id: string, userId: string, deviceId: string, options?: { bypassKeycard?: boolean }) => {
      const bypass = options?.bypassKeycard === true;
      let encodedRoomId = '';
      let encodeRes: any = { success: true, data: { status: 'SUCCESS' } };

      if (!bypass) {
        // 1. Fetch reservation to get Room ID for encoder
        const resDetailsRaw = await invokeDesktop('reservations.get', { id });
        const resDetails = typeof resDetailsRaw === 'string' ? JSON.parse(resDetailsRaw) : resDetailsRaw;
        const reservation = resDetails?.data?.reservation || resDetails?.data || resDetails?.reservation || resDetails;
        const roomId = reservation?.reservationRooms?.find((room: any) => room?.status === 'ACTIVE')?.roomId
          || reservation?.reservationRooms?.[0]?.roomId
          || reservation?.roomId
          || reservation?.rooms?.find((room: any) => room?.status === 'ACTIVE')?.roomId
          || reservation?.rooms?.[0]?.roomId;
        
        if (!roomId) {
            return { success: false, error: 'No room assigned for check-in encoding.' };
        }
        
        // 2. Trigger Hardware Encode FIRST
        encodeRes = await invokeDesktop('keycards.encode', { roomId, lockCode: '', reservationId: id });
        if (!encodeRes.success) {
            const errorMessage = typeof encodeRes.error === 'string' ? encodeRes.error : encodeRes.error?.message;
            return { success: false, error: 'Hardware Error: ' + (errorMessage || encodeRes.data?.errorMessage || 'Failed to encode keycard.') };
        }
        encodedRoomId = roomId;
      }
      
      // 3. Process Check-In in Local DB
      const res = await invokeDesktop('reservations.checkIn', { 
        id, 
        userId, 
        deviceId, 
        bypassKeycard: bypass, 
        encodedRoomId, 
        encodeData: encodeRes.data ? JSON.stringify(encodeRes.data) : undefined 
      });
      
      if (!res.success) {
         return { success: false, error: res.error || 'Check-in database update failed.' };
      }
      
      const opId = 'sync_encode_' + Date.now();
      if (!bypass) {
         syncOperations.set(opId, encodeRes.data);
      }
      
      // 4. Return in the identical format as Web API
      return {
        success: true,
        data: {
          operationId: opId,
          status: 'SUCCESS',
          operation: {
            id: opId,
            status: 'SUCCESS',
            command: { responseData: encodeRes.data }
          }
        }
      };
    },
    checkOut: async (id: string, userId: string, deviceId: string) => {
      return invokeDesktop('reservations.checkOut', { id, userId, deviceId });
    },
    extendStay: async (id: string, newCheckOutDate: string) => {
      return invokeDesktop('reservations.extendStay', { reservationId: id, newCheckOutDate });
    },
    previewExtendStay: async (id: string, newCheckOutDate: string) => {
      return invokeDesktop('reservations.previewExtendStay', { reservationId: id, newCheckOutDate });
    },
    reassignRoom: async (id: string, data: any) => {
      return invokeDesktop('reservations.reassignRoom', { reservationId: id, ...data });
    }
  },
  
  rooms: {
    list: async (propertyId: string, params?: any) => {
      return invokeDesktop('rooms.list', { propertyId, params });
    },
    getAvailable: async (propertyId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
      // Cloud required for availability checks
      return invokeDesktop("rooms.getAvailable", { propertyId, roomTypeId, checkIn, checkOut });
    },
    getActiveReservation: async (roomId: string) => {
      return invokeDesktop('rooms.getActiveReservation', { roomId });
    },
    updateStatus: async (roomId: string, newStatus: string, source: string) => {
      return invokeDesktop('rooms.updateStatus', { roomId, newStatus, source });
    },
    create: async (data: any) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("Internet connection is required to create a new physical room.");
      }
      const res = await fetch('/api/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },
  
  folios: {
    get: async (id: string) => {
      return invokeDesktop('folios.get', { id });
    },
    addCharge: async (folioId: string, charge: any) => {
      return invokeDesktop('folios.addCharge', { folioId, charge });
    },
    addPayment: async (folioId: string, payment: any) => {
      return invokeDesktop('folios.addPayment', { folioId, payment });
    }
  },
  
  keycards: {
    encode: async (roomId, lockCode, reservationId) => {
      const res = await invokeDesktop('keycards.encode', { roomId, lockCode, reservationId });
      return {
        success: res.success,
        error: typeof res.error === 'string' ? { message: res.error } : res.error,
        data: {
          operation: {
            id: (() => { const id = 'sync_encode_' + Date.now(); syncOperations.set(id, res.data); return id; })(),
            status: res.success ? 'SUCCESS' : 'FAILED',
            errorMessage: res.data?.errorMessage || res.error,
            command: { responseData: res.data }
          }
        }
      };
    },
    read: async () => {
      const res = await invokeDesktop('keycards.read');
      return {
        success: res.success,
        error: typeof res.error === 'string' ? { message: res.error } : res.error,
        data: {
          operation: {
            id: (() => { const id = 'sync_read_' + Date.now(); syncOperations.set(id, res.data); return id; })(),
            status: res.success ? 'SUCCESS' : 'FAILED',
            errorMessage: res.data?.errorMessage || res.error,
            command: { responseData: res.data }
          }
        }
      };
    },
    cancel: async () => {
      const res = await invokeDesktop('keycards.cancel');
      return {
        success: res.success,
        error: typeof res.error === 'string' ? { message: res.error } : res.error,
        data: {
          operation: {
            id: (() => { const id = 'sync_cancel_' + Date.now(); syncOperations.set(id, res.data); return id; })(),
            status: res.success ? 'SUCCESS' : 'FAILED',
            errorMessage: res.data?.errorMessage || res.error,
            command: { responseData: res.data }
          }
        }
      };
    }
  },
  housekeeping: {
    list: async (propertyId: string) => {
      const res = await invokeDesktop('housekeeping.list', { propertyId });
      return res?.data || [];
    },
    updateTask: async (taskId: string, status: string) => {
      await invokeDesktop('housekeeping.updateTask', { taskId, status });
    }
  },
  maintenance: {
    list: async (propertyId: string) => {
      const res = await invokeDesktop('maintenance.list', { propertyId });
      return res?.data || [];
    },
    createTicket: async (ticket: any) => {
      const res = await invokeDesktop('maintenance.createTicket', { data: JSON.stringify(ticket) });
      return res?.data;
    },
    resolveTicket: async (ticketId: string, resolution?: any) => {
      await invokeDesktop('maintenance.resolveTicket', { ticketId, resolution: JSON.stringify(resolution || {}) });
    }
  },
  receipts: {
    generate: async (folioId) => {
      return invokeDesktop('receipts.generate', { folioId });
    }
  },
  pos: {
    getProducts: async (propertyId: string) => {
      return invokeDesktop('pos.getProducts', { propertyId });
    },
    getCategories: async (propertyId: string) => {
      return invokeDesktop('pos.getCategories', { propertyId });
    },
    getActiveStaff: async (propertyId: string) => {
      return invokeDesktop('pos.getActiveStaff', { propertyId });
    },
    validateSupervisorPin: async (pin: string, propertyId?: string) => { return invokeDesktop("pos.validateSupervisorPin", { pin, propertyId }); },

    getCurrentOperator: async (sessionId: string, operatorToken?: string | null) => {
      return invokeDesktop('pos.getCurrentOperator', { sessionId, operatorToken });
    },
    authenticateOperator: async (staffId: string, pin: string, propertyId: string, sessionId: string, outletId: string, deviceId: string) => {
      return invokeDesktop('pos.authenticateOperator', { staffId, pin, propertyId, sessionId, outletId, deviceId });
    },
    startSession: async (data: { userId: string; propertyId: string; deviceId: string; outletId: string; openingCash: number }) => {
      return invokeDesktop('pos.startSession', { ...data, openingBalance: data.openingCash });
    },
    startEmergencyBank: async (pin: string, reason: string, operatorToken: string) => {
      return invokeDesktop('pos.startEmergencyBank', { pin, reason, operatorToken });
    },
    getSessionContext: async (sessionId: string) => {
      const res = await invokeDesktop('pos.getSessionContext', { sessionId });
      if (!res?.success || !res.data) return res;
      
      const settlementRes = await invokeDesktop('pos.getSessionSettlementDetails', { sessionId });
      
      if (settlementRes?.success && settlementRes.data && res.data.posSession) {
        return {
          success: true,
          data: {
            ...res.data.posSession,
            outlet: res.data.outlet,
            terminal: res.data.terminal,
            primaryOperator: res.data.operator, // Map operator to primaryOperator for Cloud parity
            ...settlementRes.data
          }
        };
      }
      
      return res;
    },
    getAuthorizedOutlets: async (propertyId: string, deviceId: string) => {
      return invokeDesktop('pos.getAuthorizedOutlets', { propertyId, deviceId });
    },
    getFloorPlans: async (outletId: string, operatorToken?: string | null) => {
      return invokeDesktop('pos.getFloorPlans', { outletId });
    },
    getTables: async (floorPlanId: string) => {
      return invokeDesktop('pos.getTables', { floorPlanId });
    },
    getProductModifiers: async (productId: string) => {
      return invokeDesktop('pos.getProductModifiers', { productId });
    },
    splitCheck: async (orderId: string, itemIds: string[], userId: string) => {
      return invokeDesktop('pos.splitCheck', { orderId, itemIds, userId });
    },
    getWaiterTickets: async (outletId: string, operatorToken: string, sessionId: string) => {
      return invokeDesktop('pos.getWaiterTickets', { outletId, operatorToken, sessionId });
    },
    fireKot: async (orderId: string, itemIds: string[], operatorToken: string) => {
      return invokeDesktop('pos.fireKot', { orderId, itemIds, operatorToken });
    },
    createOrder: async (data: any, operatorToken: string) => {
      return invokeDesktop('pos.createOrder', { data, operatorToken });
    },
    updateOrderStatus: async (orderId: string, status: string, reason?: string) => {
      return invokeDesktop('pos.updateOrderStatus', { orderId, status, reason });
    },
    payOrder: async (orderId: string, paymentData: any, operatorToken: string) => {
      return invokeDesktop('pos.payOrder', { orderId, paymentData, operatorToken });
    },
    getOrder: async (orderId: string) => {
      return invokeDesktop('pos.getOrder', { orderId });
    },
    getReceipt: async (orderId: string) => {
      return invokeDesktop('pos.getReceipt', { orderId });
    },
    getServerOrders: async (range: string, statusFilter: string, sessionId?: string, operatorToken?: string) => {
      return invokeDesktop('pos.getServerOrders', { range, statusFilter, sessionId, operatorToken });
    },
    getServerSales: async (range: string, sessionId?: string, operatorToken?: string) => {
      return invokeDesktop('pos.getServerSales', { range, sessionId, operatorToken });
    },
    getCashMovements: async (sessionId: string) => {
      return invokeDesktop('pos.getCashMovements', { sessionId });
    },
    createCashMovement: async (propertyId: string, sessionId: string, amount: number, type: string, reasonCode: string, notes?: string, receiptReference?: string, authorizerId?: string) => {
      return invokeDesktop('pos.createCashMovement', { propertyId, sessionId, amount, type, reasonCode, notes, receiptReference, authorizerId });
    },
    getSessionSettlementDetails: async (sessionId: string) => {
      return invokeDesktop('pos.getSessionSettlementDetails', { sessionId });
    },
    settleSession: async (sessionId: string, actualCash: number, operatorId: string, authorizerId?: string) => {
      // In offline mode, we just pass actualCash. cashPaidOut is legacy.
      return invokeDesktop('pos.closeSession', { sessionId, actualCash, cashPaidOut: 0 });
    },
    confirmHandover: async (sessionId: string, managerPin: string) => {
      return invokeDesktop('pos.confirmHandover', { sessionId, managerPin });
    },
    getPendingHandovers: async (propertyId: string) => {
      return invokeDesktop('pos.getPendingHandovers', { propertyId });
    },
    getCashOfficeOverview: async (propertyId: string) => {
      return invokeDesktop('pos.getCashOfficeOverview', { propertyId });
    },
    openSafe: async (propertyId: string, amount: number, managerPin: string) => {
      return invokeDesktop('pos.openSafe', { propertyId, amount, managerPin });
    },
    getSafeLedger: async (propertyId: string) => {
      return invokeDesktop('pos.getSafeLedger', { propertyId });
    },
    recordBankDeposit: async (propertyId: string, amount: number, reference: string, managerPin: string) => {
      return invokeDesktop('pos.recordBankDeposit', { propertyId, amount, reference, managerPin });
    },
    // Service-first waiter flow
    fireItems: async (orderId: string, items: any[], operatorToken: string) => {
      return invokeDesktop('pos.fireItems', { orderId, items, operatorToken });
    },
    getActiveOrders: async (sessionId: string, operatorToken: string, filter?: string) => {
      return invokeDesktop('pos.getActiveOrders', { sessionId, operatorToken, filter });
    },
    getProductionBatches: async (outletId: string, station: string) => {
      return invokeDesktop('pos.getProductionBatches', { outletId, station });
    },
    updateBatchStatus: async (batchId: string, status: string) => {
      return invokeDesktop('pos.updateBatchStatus', { batchId, status });
    },
  },
  laundry: {
    getItems: async (propertyId: string) => {
      return invokeDesktop('laundry.getItems', { propertyId });
    },
    getOrders: async (propertyId: string, status?: string) => {
      return invokeDesktop('laundry.getOrders', { propertyId, status });
    },
    createOrder: async (data: any) => {
      return invokeDesktop('laundry.createOrder', { data: JSON.stringify(data) });
    },
    updateOrderStatus: async (orderId: string, status: string) => {
      return invokeDesktop('laundry.updateOrderStatus', { orderId, status });
    },
    deliverOrder: async (orderId: string) => {
      return invokeDesktop('laundry.deliverOrder', { orderId });
    }
  }
};
