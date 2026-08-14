# SDK Integration Protocol

Before bridging a new C++ DLL (like `LockSDK.dll` for HomeLock), you must acquire:
1. `LockSDK.dll`
2. `LockSDK.h` (C/C++ Header file)
3. Documentation PDF

## Required Checklist
- [ ] Determine Architecture (x86 or x64). The Agent is compiled as `win-x64`, so if the DLL is 32-bit (`x86`), the agent MUST be compiled as `win-x86`.
- [ ] Determine Calling Convention (`__stdcall` vs `__cdecl`).
- [ ] Determine Struct Layouts (packing size).
- [ ] Determine Character Encoding (Ansi, Unicode, UTF8).

Once determined, add the `DllImport` definitions to `NativeSdkBridge.cs`.
