import { LodgeCoreDataProvider } from './DataProvider';
import { invokeDesktop } from './IpcBridge';
import { OnlineDataProvider } from './OnlineDataProvider';

const syncOperations = new Map<string, any>();

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

  guests: {
    list: async () => {
      return invokeDesktop('guests.list');
    }
  },
  
  roomTypes: {
    list: async (propertyId: string) => {
      return invokeDesktop('roomTypes.list', { propertyId });
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
      return invokeDesktop('reservations.lookupByRoom', { roomNo, propertyId });
    },
    create: async (data: any) => {
      // Cloud required for creating new reservations to avoid double booking
      return invokeDesktop("reservations.create", { data: JSON.stringify(data) });
    },
    update: async (id: string, data: any) => {
      // Cloud required for complex modifications
      return OnlineDataProvider.reservations.update(id, data);
    },
    cancel: async (id: string, reason: string) => {
      // Cloud required for cancellations to manage inventory
      return OnlineDataProvider.reservations.cancel(id, reason);
    },
    checkIn: async (id: string, userId: string, deviceId: string) => {
      return invokeDesktop('reservations.checkIn', { id, userId, deviceId });
    },
    checkOut: async (id: string, userId: string, deviceId: string) => {
      return invokeDesktop('reservations.checkOut', { id, userId, deviceId });
    },
    extendStay: async (id: string, newCheckOutDate: string) => {
      // Cloud required
      return OnlineDataProvider.reservations.extendStay(id, newCheckOutDate);
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
      // Payments strictly cloud for now, unless it's a known offline terminal payment (not implemented in P1)
      return OnlineDataProvider.folios.addPayment(folioId, payment);
    }
  },
  
  keycards: {
    encode: async (roomId, lockCode, reservationId) => {
      const res = await invokeDesktop('keycards.encode', { roomId, lockCode, reservationId });
      return {
        success: res.success,
        error: res.error,
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
        error: res.error,
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
        error: res.error,
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
  housekeeping: OnlineDataProvider.housekeeping,
  maintenance: OnlineDataProvider.maintenance,
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
      return invokeDesktop('pos.getSessionContext', { sessionId });
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
  }
};
