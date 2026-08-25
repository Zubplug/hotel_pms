import { LodgeCoreDataProvider } from './DataProvider';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetchResult<T = any>(url: string, options: RequestInit = {}): Promise<{ data: T; error: string | null }> {
  const fullUrl = url.startsWith('/') && BASE_URL ? `${BASE_URL}${url}` : url;
  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`API Error ${res.status}: ${errorBody}`);
    }
    const data = await res.json();
    return { data: (data.data || data) as T, error: (data.error || null) as string | null };
  } catch (err: any) {
    return { data: null as unknown as T, error: err.message };
  }
}

async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<any> {
  const res = await apiFetchResult<T>(url, options);
  if (res.error) throw new Error(res.error);
  return { success: true, data: res.data };
}

export const OnlineDataProvider: LodgeCoreDataProvider = {
  auth: {
    async getSession() {
      const res = await fetch('/api/auth/session');
      return res.json();
    },
    async provisionDevice(deviceToken) {
      throw new Error('Provisioning is only supported on Desktop');
    },
    async getActiveStaff() {
      throw new Error('getActiveStaff is only supported on Desktop offline auth');
    },
    async login(staffId: string, pin: string, bankingModel?: string): Promise<{ success: boolean; error?: string; posSessionId?: string; bankingModel?: string }> {
      throw new Error('login is only supported on Desktop offline auth');
    }
  },
  properties: {
    async list() {
      return apiFetch(`/api/v1/properties`);
    }
  },
  hardware: {
    poll: async (operationId) => {
      return apiFetch(`/api/v1/hardware/operations/${operationId}`);
    }
  },
  dashboard: {
    async get(propertyId: string) {
      return apiFetch(`/api/v1/frontdesk/dashboard?propertyId=${propertyId}`);
    }
  },
  refunds: {
    async list(propertyId: string) {
      return apiFetch(`/api/v1/refund-requests?propertyId=${encodeURIComponent(propertyId)}`);
    },
    async request(data: any) {
      return apiFetch(`/api/v1/payments/${data.paymentId}/refund`, { method: 'POST', body: JSON.stringify(data) });
    }
  },
  guests: {
    async list() {
      return apiFetch(`/api/v1/guests`);
    },
    async search(query: string) {
      return apiFetch(`/api/v1/guests?search=${encodeURIComponent(query)}&limit=50`);
    }
  },
  roomTypes: {
    async list(propertyId: string) {
      return apiFetch(`/api/v1/room-types?propertyId=${propertyId}`);
    },
    async create(data: any) {
      return apiFetch(`/api/v1/room-types`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },
  reservations: {
    list: async (propertyId, params) => {
      const query = new URLSearchParams({ propertyId, ...params });
      return apiFetch(`/api/v1/reservations?${query.toString()}`);
    },
    async get(id: string) {
      return apiFetch(`/api/v1/reservations/${id}`);
    },
    async lookupByRoom(roomNo: string, propertyId: string) {
      try {
        const res = await apiFetch(`/api/v1/reservations/lookup?roomNo=${roomNo}&propertyId=${propertyId}`);
        return res.data?.reservation || null;
      } catch {
        return null;
      }
    },
    async create(data: any) {
      return apiFetch(`/api/v1/reservations`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    update: async (id, data) => {
      return apiFetch(`/api/v1/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    cancel: async (id, reason) => {
      return apiFetch(`/api/v1/reservations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },
    markLateArrival: async (id, notes) => apiFetch(`/api/v1/reservations/${id}/late-arrival`, { method: 'POST', body: JSON.stringify({ notes }) }),
    assessNoShow: async (id) => apiFetch(`/api/v1/reservations/${id}/no-show`, { method: 'POST', body: '{}' }),
    reinstate: async (id, reason) => apiFetch(`/api/v1/reservations/${id}/reinstate`, { method: 'POST', body: JSON.stringify({ reason }) }),
    checkIn: async (id, userId, deviceId) => {
      return apiFetch(`/api/v1/reservations/${id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ userId, deviceId })
      });
    },
    checkOut: async (id, userId, deviceId) => {
      return apiFetch(`/api/v1/reservations/${id}/check-out`, {
        method: 'POST',
        body: JSON.stringify({ userId, deviceId })
      });
    },
    extendStay: async (id, newCheckOutDate) => {
      return apiFetch(`/api/v1/reservations/${id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ newCheckOutDate })
      });
    },
    previewExtendStay: async (id: string, newCheckOutDate: string) => {
      return apiFetch(`/api/v1/reservations/${id}/extend/preview`, {
        method: 'POST',
        body: JSON.stringify({ newCheckoutDate: newCheckOutDate })
      });
    },
    reassignRoom: async (id: string, data: any) => {
      return apiFetch(`/api/v1/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    }
  },
  rooms: {
    async list(propertyId: string, params?: any) {
      const qs = params ? new URLSearchParams(params).toString() : '';
      return apiFetch(`/api/v1/rooms?propertyId=${propertyId}&${qs}`);
    },
    async getAvailable(propertyId: string, roomTypeId: string, checkIn: string, checkOut: string) {
      return apiFetch(`/api/v1/rooms/available?propertyId=${propertyId}&roomTypeId=${roomTypeId}&checkIn=${checkIn}&checkOut=${checkOut}`);
    },
    async getActiveReservation(roomId: string) {
      return apiFetch(`/api/v1/rooms/${roomId}/active-reservation`);
    },
    async updateStatus(roomId: string, newStatus: string, source: string) {
      return apiFetch(`/api/v1/rooms/${roomId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus, source })
      });
    },
    async create(data: any) {
      return apiFetch(`/api/v1/rooms`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },
  folios: {
    get: async (id) => {
      return apiFetch(`/api/v1/folios/${id}`);
    },
    addCharge: async (folioId, charge) => {
      return apiFetch(`/api/v1/folios/${folioId}/charges`, {
        method: 'POST',
        body: JSON.stringify(charge)
      });
    },
    addPayment: async (folioId, payment) => {
      return apiFetch(`/api/v1/folios/${folioId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payment)
      });
    },
    addDeposit: async () => ({ success: false, error: 'Advance deposits are available on the desktop front desk.' })
  },
  keycards: {
    encode: async (roomId, lockCode, reservationId) => {
      return apiFetch(`/api/v1/hardware/keycards/encode`, {
        method: 'POST',
        body: JSON.stringify({ roomId, lockCode, reservationId })
      });
    },
    read: async () => {
      return apiFetch(`/api/v1/hardware/keycards/read`);
    },
    cancel: async () => {
      return apiFetch(`/api/v1/hardware/keycards/cancel`, {
        method: 'POST'
      });
    }
  },
  housekeeping: {
    list: async (propertyId) => {
      return apiFetch(`/api/v1/housekeeping?propertyId=${propertyId}`);
    },
    updateTask: async (taskId, status) => {
      return apiFetch(`/api/v1/housekeeping/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    }
  },
  maintenance: {
    list: async (propertyId) => {
      return apiFetch(`/api/v1/maintenance?propertyId=${propertyId}`);
    },
    createTicket: async (ticket) => {
      return apiFetch(`/api/v1/maintenance`, {
        method: 'POST',
        body: JSON.stringify(ticket)
      });
    },
    resolveTicket: async (ticketId: string, resolution?: any) => {
      return apiFetch(`/api/v1/maintenance/${ticketId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution })
      });
    }
  },
  receipts: {
    generate: async (folioId) => {
      return apiFetch(`/api/v1/payments/${folioId}/receipt`, {
        method: 'GET'
      });
    }
  },
  pos: {
    getProducts: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/pos/products?propertyId=${propertyId}`);
    },
    getCategories: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/pos/categories?propertyId=${propertyId}`);
    },
    getActiveStaff: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/pos/staff?propertyId=${propertyId}`);
    },
    getCurrentOperator: async (sessionId: string, operatorToken?: string | null) => {
      if (!sessionId) return { success: false, data: null, error: 'No active session' };
      const headers = operatorToken ? { Authorization: `Bearer ${operatorToken}` } : undefined;
      return apiFetchResult(`/api/v1/pos/operator?sessionId=${sessionId}`, { headers });
    },
    authenticateOperator: async (staffId: string, pin: string, propertyId: string, sessionId: string, outletId?: string, deviceId?: string) => {
      return apiFetchResult(`/api/v1/pos/auth`, {
        method: 'POST',
        body: JSON.stringify({ staffId, pin, propertyId, sessionId, outletId, deviceId })
      });
    },
    validateSupervisorPin: async (pin: string, propertyId?: string) => {
      return Promise.resolve({ data: null, error: 'Not implemented online' });
    },
    getAuthorizedOutlets: async (propertyId: string, deviceId: string) => {
      return apiFetchResult(`/api/v1/pos/outlets/authorized?propertyId=${propertyId}&deviceId=${deviceId}`);
    },
    startSession: async (data: { userId: string; propertyId: string; deviceId: string; outletId: string; openingCash: number }) => {
      return apiFetchResult(`/api/v1/pos/sessions`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    startEmergencyBank: async (pin: string, reason: string, operatorToken: string) => {
      let deviceId = 'web-browser';
      let outletId = '';
      if (typeof window !== 'undefined') {
        deviceId = localStorage.getItem('lodgecore_pos_device_id') || 'web-browser';
        outletId = localStorage.getItem('lodgecore_pos_outlet_id') || '';
      }
      return apiFetchResult(`/api/v1/pos/sessions/emergency-bank`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({ pin, reason, deviceId, outletId })
      });
    },
    getSessionContext: async (sessionId: string) => {
      if (!sessionId) return { success: false, data: null, error: 'No active session' };
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/context`);
    },
    getFloorPlans: async (outletId: string, operatorToken?: string | null) => {
      const headers: Record<string, string> = operatorToken ? { Authorization: `Bearer ${operatorToken}` } : {};
      return apiFetchResult(`/api/v1/pos/outlets/${outletId}/floor-plans`, { headers });
    },
    getTables: async (floorPlanId: string, operatorToken?: string | null) => {
      const headers: Record<string, string> = operatorToken ? { Authorization: `Bearer ${operatorToken}` } : {};
      return apiFetchResult(`/api/v1/pos/floor-plans/${floorPlanId}/tables`, { headers });
    },
    getProductModifiers: async (productId: string) => {
      return apiFetchResult(`/api/v1/pos/products/${productId}/modifiers`);
    },
    splitCheck: async (orderId: string, itemIds: string[], userId: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}/split`, {
        method: 'POST',
        body: JSON.stringify({ itemIds, userId })
      });
    },
    getWaiterTickets: async (outletId: string, operatorToken: string, sessionId: string) => {
      const res = await fetch(`/api/v1/pos/kds/waiter-tickets?outletId=${outletId}&sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${operatorToken}` }
      });
      return await res.json();
    },
    fireKot: async (orderId: string, itemIds: string[], operatorToken: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}/fire`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({ itemIds })
      });
    },
    createOrder: async (data: any, operatorToken: string) => {
      return apiFetchResult(`/api/v1/pos/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify(data)
      });
    },
    updateOrderStatus: async (orderId: string, status: string, reason?: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason })
      });
    },
    payOrder: async (orderId: string, paymentData: any, operatorToken: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify(paymentData)
      });
    },
    getOrder: async (orderId: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}`);
    },
    getReceipt: async (orderId: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}/receipt`);
    },
    getServerOrders: async (range: string, statusFilter: string, sessionId?: string, operatorToken?: string) => {
      const headers = operatorToken ? { Authorization: `Bearer ${operatorToken}` } : undefined;
      return apiFetchResult(`/api/v1/pos/reports/server-orders?range=${range}&status=${statusFilter}${sessionId ? `&sessionId=${sessionId}` : ''}`, { headers });
    },
    getServerSales: async (range: string, sessionId?: string, operatorToken?: string) => {
      const headers = operatorToken ? { Authorization: `Bearer ${operatorToken}` } : undefined;
      return apiFetchResult(`/api/v1/pos/reports/server-sales?range=${range}${sessionId ? `&sessionId=${sessionId}` : ''}`, { headers });
    },
    getCashMovements: async (sessionId: string) => {
      if (!sessionId) return { success: false, data: [], error: 'No active session' };
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/cash-movements`);
    },
    createCashMovement: async (propertyId: string, sessionId: string, amount: number, type: string, reasonCode: string, notes?: string, receiptReference?: string, authorizerId?: string) => {
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/cash-movements`, {
        method: 'POST',
        body: JSON.stringify({ propertyId, amount, type, reasonCode, notes, receiptReference, authorizerId })
      });
    },
    getSessionSettlementDetails: async (sessionId: string) => {
      if (!sessionId) return { success: false, data: null, error: 'No active session' };
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/settlement-details`);
    },
    settleSession: async (sessionId: string, actualCash: number, operatorId: string, authorizerId?: string) => {
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/settle`, {
        method: 'POST',
        body: JSON.stringify({ actualCash, operatorId, authorizerId })
      });
    },
    confirmHandover: async (sessionId: string, managerPin: string) => {
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/confirm-handover`, {
        method: 'POST',
        body: JSON.stringify({ managerPin })
      });
    },
    getCashOfficeOverview: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/pos/cash-office/overview?propertyId=${propertyId}`);
    },
    getPendingHandovers: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/pos/cash-office/handovers?propertyId=${propertyId}`);
    },
    getSafeLedger: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/pos/cash-office/ledger?propertyId=${propertyId}`);
    },
    openSafe: async (propertyId: string, amount: number, managerPin: string) => {
      return apiFetchResult(`/api/v1/pos/cash-office/open-safe`, {
        method: 'POST',
        body: JSON.stringify({ propertyId, amount, managerPin })
      });
    },
    recordBankDeposit: async (propertyId: string, amount: number, reference: string, managerPin: string) => {
      return apiFetchResult(`/api/v1/pos/cash-office/deposit`, {
        method: 'POST',
        body: JSON.stringify({ propertyId, amount, reference, managerPin })
      });
    },
    // Service-first waiter flow
    fireItems: async (orderId: string, items: any[], operatorToken: string) => {
      return apiFetchResult(`/api/v1/pos/orders/${orderId}/fire`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({ items }),
      });
    },
    getActiveOrders: async (sessionId: string, operatorToken: string, filter?: string) => {
      if (!sessionId) return { success: false, data: [], error: 'No active session' };
      return apiFetchResult(`/api/v1/pos/sessions/${sessionId}/active-orders${filter ? `?filter=${filter}` : ''}`, {
        headers: { 'Authorization': `Bearer ${operatorToken}` }
      });
    },
    getProductionBatches: async (outletId: string, station: string) => {
      return apiFetchResult(`/api/v1/pos/outlets/${outletId}/production-batches?station=${station}`);
    },
    updateBatchStatus: async (batchId: string, status: string) => {
      return apiFetchResult(`/api/v1/pos/production-batches/${batchId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
  },
  laundry: {
    getItems: async (propertyId: string) => {
      return apiFetchResult(`/api/v1/laundry/items?propertyId=${propertyId}`);
    },
    getOrders: async (propertyId: string, status?: string) => {
      let url = `/api/v1/laundry/orders?propertyId=${propertyId}`;
      if (status) url += `&status=${status}`;
      return apiFetchResult(url);
    },
    createOrder: async (data: any) => {
      return apiFetchResult(`/api/v1/laundry/orders`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    updateOrderStatus: async (orderId: string, status: string) => {
      return apiFetchResult(`/api/v1/laundry/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    deliverOrder: async (orderId: string) => {
      return apiFetchResult(`/api/v1/laundry/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DELIVERED' })
      });
    }
  }
};
