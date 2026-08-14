import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import Redis from 'ioredis';
import prisma from '@hotel-pms/db';

const PORT = parseInt(process.env.GATEWAY_PORT ?? '3001', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// --- Agent connection registry ---
const agentRegistry = new Map<string, WebSocket>(); // agentId -> ws

// --- Redis pub/sub ---
const subscriber = new Redis(REDIS_URL);
const publisher = new Redis(REDIS_URL);

subscriber.psubscribe('gateway:commands:*', (err) => {
  if (err) console.error('[Gateway] Redis psubscribe error:', err);
  else console.log('[Gateway] Subscribed to gateway:commands:* channel');
});

subscriber.on('pmessage', async (_pattern, channel, message) => {
  // channel = gateway:commands:{propertyId}
  const propertyId = channel.split(':').pop();
  if (!propertyId) return;

  const payload = JSON.parse(message);
  const { commandId, agentId } = payload;

  const ws = agentRegistry.get(agentId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log(`[Gateway] Agent ${agentId} offline. Command ${commandId} remains QUEUED.`);
    return;
  }

  // Fetch full command from DB to dispatch safely
  if (!commandId) return;
  const command = await prisma.lockCommand.findUnique({
    where: { id: commandId },
  });
  if (!command || command.status !== 'QUEUED') return;

  // Mark as DISPATCHING
  await prisma.lockCommand.update({
    where: { id: commandId },
    data: { status: 'DISPATCHING', claimedAt: new Date() },
  });
  await prisma.lockOperation.updateMany({
    where: { commandId },
    data: { status: 'DISPATCHING' },
  });

  ws.send(JSON.stringify({
    type: 'COMMAND_DISPATCH',
    command: {
      id: command.id,
      operationId: command.operationId,
      commandType: command.commandType,
      status: command.status,
      propertyId,
      payload: command.payload,
    },
  }));

  console.log(`[Gateway] Dispatched command ${commandId} to agent ${agentId}`);
});

// --- WebSocket Server ---
const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const agentId = req.headers['x-agent-id'] as string;

  if (!token || !agentId) {
    ws.close(1008, 'Missing credentials');
    return;
  }

  // Lookup agent in DB for property validation
  const agent = await prisma.hardwareAgent.findUnique({ where: { id: agentId } });
  if (!agent || !agent.enabled) {
    ws.close(1008, 'Unknown or disabled agent');
    return;
  }

  console.log(`[Gateway] Agent ${agentId} (property: ${agent.propertyId}) connected.`);
  agentRegistry.set(agentId, ws);

  // Update DB status
  await prisma.hardwareAgent.update({
    where: { id: agentId },
    data: { status: 'ONLINE', lastConnectedAt: new Date(), lastHeartbeat: new Date() },
  });

  // Emit AGENT_CONNECTED event
  await prisma.lockEvent.create({
    data: { propertyId: agent.propertyId, agentId, eventType: 'AGENT_CONNECTED' },
  });

  // Dispatch any QUEUED commands immediately on reconnect
  const pendingCommands = await prisma.lockCommand.findMany({
    where: { agentId, status: 'QUEUED' },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  for (const cmd of pendingCommands) {
    if (ws.readyState !== WebSocket.OPEN) break;
    const op = await prisma.lockOperation.findFirst({ where: { commandId: cmd.id } });
    ws.send(JSON.stringify({
      type: 'COMMAND_DISPATCH',
      command: {
        id: cmd.id,
        operationId: cmd.operationId,
        commandType: cmd.commandType,
        status: cmd.status,
        propertyId: agent.propertyId,
        payload: cmd.payload,
      },
    }));
    await prisma.lockCommand.update({ where: { id: cmd.id }, data: { status: 'DISPATCHING', claimedAt: new Date() } });
  }

  // Handle messages from agent (status updates)
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'HEARTBEAT') {
        await prisma.hardwareAgent.update({
          where: { id: agentId },
          data: { lastHeartbeat: new Date() },
        });
        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK' }));
        return;
      }

      if (msg.type === 'STATUS_UPDATE') {
        const { commandId, operationId, status, errorCode, errorMessage } = msg;

        // Validate: only allow updates to this agent's own commands
        const cmd = await prisma.lockCommand.findUnique({ where: { id: commandId } });
        if (!cmd || cmd.agentId !== agentId) {
          console.warn(`[Gateway] Agent ${agentId} tried to update unauthorized command ${commandId}`);
          return;
        }

        await prisma.lockCommand.update({
          where: { id: commandId },
          data: {
            status,
            errorCode,
            errorMessage,
            completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date() : undefined,
          },
        });

        if (operationId) {
          await prisma.lockOperation.update({
            where: { id: operationId },
            data: {
              status: mapCommandStatusToOperation(status),
              errorCode,
              errorMessage,
              completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date() : undefined,
            },
          });
        }

        // Write durable event log
        await prisma.lockEvent.create({
          data: {
            propertyId: agent.propertyId,
            agentId,
            operationId,
            commandId,
            eventType: status,
            payload: { errorCode, errorMessage },
          },
        });
      }
    } catch (e) {
      console.error('[Gateway] Failed to handle agent message:', e);
    }
  });

  ws.on('close', async () => {
    agentRegistry.delete(agentId);
    await prisma.hardwareAgent.update({
      where: { id: agentId },
      data: { status: 'OFFLINE', lastDisconnectedAt: new Date() },
    });
    await prisma.lockEvent.create({
      data: { propertyId: agent.propertyId, agentId, eventType: 'AGENT_DISCONNECTED' },
    });
    console.log(`[Gateway] Agent ${agentId} disconnected.`);
  });
});

function mapCommandStatusToOperation(commandStatus: string): string {
  const map: Record<string, string> = {
    CLAIMED: 'DISPATCHED',
    WAITING_FOR_CARD: 'WAITING_FOR_CARD',
    CARD_DETECTED: 'CARD_DETECTED',
    ENCODING: 'ENCODING',
    VERIFYING: 'VERIFYING',
    COMPLETED: 'ACTIVE',
    FAILED: 'FAILED',
  };
  return map[commandStatus] ?? commandStatus;
}

server.listen(PORT, () => {
  console.log(`[Gateway] WebSocket Gateway listening on ws://localhost:${PORT}`);
});
