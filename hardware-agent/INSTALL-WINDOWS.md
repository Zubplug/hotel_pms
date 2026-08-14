# Windows Installation Guide

## 1. Prerequisites
- Windows 10 or 11 (x64)
- .NET 8 Runtime installed
- Physical USB Encoder drivers installed (vendor specific)

## 2. Installation
1. Compile the project: `dotnet publish -c Release -r win-x64 --self-contained`
2. Copy the contents of `bin/Release/net8.0/win-x64/publish` to `C:\Program Files\LodgeCoreAgent`
3. Copy the vendor's `LockSDK.dll` into the same directory.
4. Open an Administrator Command Prompt and run:
   `sc create "LodgeCore Hardware Agent" binPath= "C:\Program Files\LodgeCoreAgent\LodgeCore.HardwareAgent.exe" start= auto`
5. Run `sc start "LodgeCore Hardware Agent"`
