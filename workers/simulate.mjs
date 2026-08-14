import WebSocket from 'ws';

const GATEWAY_URL = 'ws://localhost:3001';
const AGENT_ID = '123e4567-e89b-12d3-a456-426614174000';

console.log('Starting LodgeCore Simulated Hardware Agent (WebSocket)...');

let ws;

function connect() {
  ws = new WebSocket(GATEWAY_URL, {
    headers: {
      'authorization': `Bearer token_not_used_yet`,
      'x-agent-id': AGENT_ID
    }
  });

  ws.on('open', () => {
    console.log(`🔌 Connected to Gateway as ${AGENT_ID}`);
    // Start heartbeat
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
      }
    }, 15000);
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'COMMAND') {
        console.log(`\n📦 [RECEIVED COMMAND] ${msg.command.id} [${msg.command.commandType}]`);
        await processCommand(msg.command);
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('❌ Disconnected from Gateway. Reconnecting in 3s...');
    setTimeout(connect, 3000);
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
  });
}

async function updateStatus(commandId, operationStatus, errorMessage = undefined) {
  console.log(`  -> Status Update: ${operationStatus}`);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'STATUS_UPDATE',
      commandId,
      operationStatus,
      errorMessage,
    }));
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processCommand(command) {
  const payload = command.payload;
  
  if (command.commandType === 'ENCODE_CARD') {
    console.log(`  -> Please place card on encoder for room: ${payload.roomId || payload.lockCode}`);
    if (payload.dlsCoID) {
      console.log(`  -> [DELUNS PAYLOAD DETECTED] CoID: ${payload.dlsCoID}, lockCode: ${payload.lockCode}`);
    }
    
    // Simulate WAITING FOR CARD
    await updateStatus(command.id, 'WAITING_FOR_CARD');
    await sleep(2500);
    
    // Simulate CARD DETECTED
    console.log(`  -> Card Detected!`);
    await updateStatus(command.id, 'CARD_DETECTED');
    await sleep(1000);
    
    // Simulate ENCODING
    console.log(`  -> Writing to Card...`);
    await updateStatus(command.id, 'ENCODING');
    await sleep(1500);
    
    // Simulate VERIFYING
    console.log(`  -> Verifying Card Data...`);
    await updateStatus(command.id, 'VERIFYING');
    await sleep(1000);
    
    // Simulate SUCCESS
    console.log(`  ✅ Card successfully encoded!`);
    await updateStatus(command.id, 'ACTIVE');
  } else if (command.commandType === 'REVOKE_CARD') {
    console.log(`  -> Processing Revocation for credential: ${payload.credentialId}`);
    await sleep(1000);
    console.log(`  ✅ Revocation Complete!`);
    await updateStatus(command.id, 'REVOKED');
  } else if (command.commandType === 'READ_DIAGNOSTIC') {
    console.log(`  -> Running Diagnostic Card Read...`);
    await updateStatus(command.id, 'WAITING_FOR_CARD');
    await sleep(2500);
    console.log(`  -> Card Detected!`);
    await updateStatus(command.id, 'CARD_DETECTED');
    await sleep(1500);
    const mockDiagnosticHex = "000102030405060708090A0B0C0D0E0F";
    console.log(`  ✅ Diagnostic Read Complete: ${mockDiagnosticHex}`);
    await updateStatus(command.id, 'COMPLETED', mockDiagnosticHex);
  } else {
    console.log(`  -> Unknown command type: ${command.commandType}`);
  }
}

// Start connection
connect();
