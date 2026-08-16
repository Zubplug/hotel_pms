import { LodgeCoreDataProvider } from './DataProvider';

// Helper for standard API requests
async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
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
  return res.json();
}

export const OnlineDataProvider: LodgeCoreDataProvider = {
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
  guests: {
    async list() {
      return apiFetch(`/api/v1/guests`);
    }
  },
  roomTypes: {
    async list(propertyId: string) {
      return apiFetch(`/api/v1/room-types?propertyId=${propertyId}`);
    }
  },
  reservations: {
    list: async (propertyId, params) => {
      const query = new URLSearchParams({ propertyId, ...params });
      return apiFetch(`/api/v1/frontdesk/reservations?${query.toString()}`);
    },
    async get(id: string) {
      return apiFetch(`/api/v1/frontdesk/reservations/${id}`);
    },
    async lookupByRoom(roomNo: string, propertyId: string) {
      const res = await fetch(`/api/v1/reservations/lookup?roomNo=${roomNo}&propertyId=${propertyId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.data?.reservation || null;
    },
    async create(data: any) {
      return apiFetch(`/api/v1/frontdesk/reservations`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    update: async (id, data) => {
      return apiFetch(`/api/v1/frontdesk/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    cancel: async (id, reason) => {
      return apiFetch(`/api/v1/frontdesk/reservations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },
    checkIn: async (id, userId, deviceId) => {
      return apiFetch(`/api/v1/frontdesk/reservations/${id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ userId, deviceId })
      });
    },
    checkOut: async (id, userId, deviceId) => {
      return apiFetch(`/api/v1/frontdesk/reservations/${id}/check-out`, {
        method: 'POST',
        body: JSON.stringify({ userId, deviceId })
      });
    },
    extendStay: async (id, newCheckOutDate) => {
      return apiFetch(`/api/v1/frontdesk/reservations/${id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ newCheckOutDate })
      });
    }
  },
  rooms: {
    async list(propertyId: string, params?: any) {
      const qs = params ? new URLSearchParams(params).toString() : '';
      return apiFetch(`/api/v1/frontdesk/rooms?propertyId=${propertyId}&${qs}`);
    },
    async getAvailable(propertyId: string, roomTypeId: string, checkIn: string, checkOut: string) {
      return apiFetch(`/api/v1/rooms/available?propertyId=${propertyId}&roomTypeId=${roomTypeId}&checkIn=${checkIn}&checkOut=${checkOut}`);
    },
    async getActiveReservation(roomId: string) {
      return apiFetch(`/api/v1/frontdesk/rooms/${roomId}/active-reservation`);
    }
  },
  folios: {
    get: async (id) => {
      return apiFetch(`/api/v1/frontdesk/folios/${id}`);
    },
    addCharge: async (folioId, charge) => {
      return apiFetch(`/api/v1/frontdesk/folios/${folioId}/charges`, {
        method: 'POST',
        body: JSON.stringify(charge)
      });
    },
    addPayment: async (folioId, payment) => {
      return apiFetch(`/api/v1/frontdesk/folios/${folioId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payment)
      });
    }
  },
  keycards: {
    encode: async (roomId, guestName, checkIn, checkOut) => {
      return apiFetch(`/api/v1/frontdesk/hardware/keycards/encode`, {
        method: 'POST',
        body: JSON.stringify({ roomId, guestName, checkIn, checkOut })
      });
    },
    read: async () => {
      return apiFetch(`/api/v1/frontdesk/hardware/keycards/read`);
    },
    cancel: async () => {
      return apiFetch(`/api/v1/hardware/locks/cancel-card`, {
        method: 'POST'
      });
    }
  },
  housekeeping: {
    list: async (propertyId) => {
      return apiFetch(`/api/v1/frontdesk/housekeeping?propertyId=${propertyId}`);
    },
    updateTask: async (taskId, status) => {
      return apiFetch(`/api/v1/frontdesk/housekeeping/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    }
  },
  maintenance: {
    list: async (propertyId) => {
      return apiFetch(`/api/v1/frontdesk/maintenance?propertyId=${propertyId}`);
    },
    createTicket: async (data) => {
      return apiFetch(`/api/v1/frontdesk/maintenance`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    resolveTicket: async (ticketId) => {
      return apiFetch(`/api/v1/frontdesk/maintenance/${ticketId}/resolve`, {
        method: 'POST'
      });
    }
  },
  receipts: {
    generate: async (folioId) => {
      return apiFetch(`/api/v1/frontdesk/folios/${folioId}/receipt`, {
        method: 'POST'
      });
    }
  }
};
