import re

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'r') as f:
    content = f.read()

# Add a global store at the top
if 'const syncOperations = new Map' not in content:
    content = content.replace('export const DesktopDataProvider:', 'const syncOperations = new Map<string, any>();\n\nexport const DesktopDataProvider:')

# Update keycards to save to syncOperations
content = content.replace("id: 'sync_read_' + Date.now(),", "id: (() => { const id = 'sync_read_' + Date.now(); syncOperations.set(id, res.data); return id; })(),")
content = content.replace("id: 'sync_encode_' + Date.now(),", "id: (() => { const id = 'sync_encode_' + Date.now(); syncOperations.set(id, res.data); return id; })(),")
content = content.replace("id: 'sync_cancel_' + Date.now(),", "id: (() => { const id = 'sync_cancel_' + Date.now(); syncOperations.set(id, res.data); return id; })(),")

# Update poll to read from syncOperations
old_poll = """  hardware: {
    poll: async (operationId) => {
      // For synchronous desktop operations, they are already resolved.
      // The UI might still poll the mock operation ID.
      // We must return `{ data: { operation: { status: 'SUCCESS' } } }` format
      // but actually, our mock operation ID encodes the status!
      const status = operationId.includes('FAILED') ? 'FAILED' : 'SUCCESS';
      return { success: true, data: { operation: { status: 'SUCCESS', command: {} } } };
    }
  },"""

new_poll = """  hardware: {
    poll: async (operationId) => {
      const status = operationId.includes('FAILED') ? 'FAILED' : 'SUCCESS';
      const responseData = syncOperations.get(operationId);
      return { success: true, data: { operation: { status, command: { responseData } } } };
    }
  },"""

content = content.replace(old_poll, new_poll)

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'w') as f:
    f.write(content)
