import { LodgeCoreDataProvider } from './DataProvider';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Helper for standard API requests
async function apiFetch(url: string, options: RequestInit = {}) {
  const fullUrl = url.startsWith('/') && BASE_URL ? `${BASE_URL}${url}` : url;
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
    }
  },
  keycards: {
    encode: async (roomId, guestName, checkIn, checkOut) => {
      return apiFetch(`/api/v1/hardware/keycards/encode`, {
        method: 'POST',
        body: JSON.stringify({ roomId, guestName, checkIn, checkOut })
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
    resolveTicket: async (ticketId, resolution) => {
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
  }
};
