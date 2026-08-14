# LodgeCore Hardware Agent

This is the production-grade Windows service that runs on a hotel's front desk computer. It bridges the cloud-based LodgeCore PMS with the physical USB card encoders (Assa Abloy, Dormakaba, ELock, etc.) via their native C++ SDKs.

## Architecture
- **WebSockets:** Uses a persistent, authenticated WebSocket connection to receive lock commands in real-time.
- **Strict Queuing:** Processes strictly one card at a time to prevent USB race conditions.
- **Safety First:** Validates property IDs, agent IDs, and command expiry before interacting with the SDK.

## P/Invoke Warning
Native `[DllImport]` signatures are intentionally isolated and omitted until the exact `LockSDK.dll` header files are inspected to prevent process crashes or memory corruption.
