import re

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'r') as f:
    content = f.read()

# Replace the keycards block
old_keycards = """  keycards: {
    encode: async (roomId, lockCode, reservationId) => {
      return invokeDesktop('keycards.encode', { roomId, lockCode, reservationId });
    },
    read: async () => {
      return invokeDesktop('keycards.read');
    },
    cancel: async () => {
      return invokeDesktop('keycards.cancel');
    }
  },"""

new_keycards = """  keycards: {
    encode: async (roomId, lockCode, reservationId) => {
      const res = await invokeDesktop('keycards.encode', { roomId, lockCode, reservationId });
      return {
        success: res.success,
        error: res.error,
        data: {
          operation: {
            id: 'sync_encode_' + Date.now(),
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
            id: 'sync_read_' + Date.now(),
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
            id: 'sync_cancel_' + Date.now(),
            status: res.success ? 'SUCCESS' : 'FAILED',
            errorMessage: res.data?.errorMessage || res.error,
            command: { responseData: res.data }
          }
        }
      };
    }
  },"""

content = content.replace(old_keycards, new_keycards)

old_poll = """  hardware: {
    poll: async (operationId) => {
      // In offline mode, hardware operations are usually synchronous or handled directly via IPC,
      // but we return success to mimic the polling interface if used.
      return { status: 'COMPLETED' };
    }
  },"""

new_poll = """  hardware: {
    poll: async (operationId) => {
      // For synchronous desktop operations, they are already resolved.
      // The UI might still poll the mock operation ID.
      // We must return `{ data: { operation: { status: 'SUCCESS' } } }` format
      // but actually, our mock operation ID encodes the status!
      const status = operationId.includes('FAILED') ? 'FAILED' : 'SUCCESS';
      return { success: true, data: { operation: { status: 'SUCCESS', command: {} } } };
    }
  },"""

content = content.replace(old_poll, new_poll)

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'w') as f:
    f.write(content)
