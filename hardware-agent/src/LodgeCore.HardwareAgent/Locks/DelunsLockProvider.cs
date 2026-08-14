using System.Text;
using LodgeCore.HardwareAgent.Native;

namespace LodgeCore.HardwareAgent.Locks;

public class DelunsLockProvider : ILockProvider
{
    private readonly ILogger<DelunsLockProvider> _logger;
    private readonly AgentSettings _settings;

    // TODO: In Phase 6, we pass AgentSettings so we have access to dlsCoID if needed
    public DelunsLockProvider(ILogger<DelunsLockProvider> logger)
    {
        _logger = logger;
        // _settings = settings;
    }

    public async Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Waiting for card on Deluns USB encoder...");
        
        var startTime = DateTime.UtcNow;
        
        // 1 = USB port 1, typically Deluns uses 1 for default USB.
        byte fUSB = 1;
        
        // Ensure encoder is attached and initialized
        NativeSdkBridge.initializeUSB(fUSB);

        while (DateTime.UtcNow - startTime < timeout)
        {
            if (cancellationToken.IsCancellationRequested) return false;

            byte[] buffer = new byte[128];
            // Poll for card
            int res = NativeSdkBridge.ReadCard(fUSB, buffer);
            if (res == 0) // Typically 0 is success in Deluns SDK, though we should verify exact codes
            {
                _logger.LogInformation("Card detected by Deluns Encoder.");
                return true;
            }

            await Task.Delay(500, cancellationToken);
        }

        return false;
    }

    public async Task<LockResult> EncodeCardAsync(string lockCode, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Encoding Deluns card for lock {LockCode}...", lockCode);
        
        byte fUSB = 1;
        
        // In a complete implementation, this comes from the PMS LockCommand payload
        // or the local AgentSettings
        int dlsCoID = 0; // The Hotel Code (discovered via READ_DIAGNOSTIC)
        
        // We use dummy dates for the example. In production, these come from the LockCommand payload.
        string bDate = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        string eDate = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd HH:mm:ss");
        
        // Card Number (1-255, usually for tracking duplicates)
        byte cardNo = 1; 
        byte dai = 0; // Flags for overwriting etc, depends on Deluns docs
        byte llock = 0; // Allow opening deadbolt?
        byte pdoors = 0; // Public doors?
        string cardHexStr = ""; // Some versions require passing an empty buffer

        // Make the card
        int res = NativeSdkBridge.GuestCard(fUSB, dlsCoID, cardNo, dai, llock, pdoors, bDate, eDate, lockCode, cardHexStr);

        if (res == 0)
        {
            _logger.LogInformation("Deluns Encoding successful. Buzzing encoder...");
            NativeSdkBridge.Buzzer(fUSB, 10); // Beep success
            return LockResult.Ok();
        }
        else
        {
            _logger.LogError("Failed to encode Deluns card. SDK returned: {Error}", res);
            return LockResult.Fail(res.ToString(), $"Deluns SDK error code: {res}");
        }
    }

    public async Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Running Deluns Diagnostic Read...");
        
        byte fUSB = 1;
        NativeSdkBridge.initializeUSB(fUSB);
        
        byte[] buffer = new byte[128];
        int res = NativeSdkBridge.ReadCard(fUSB, buffer);
        
        if (res == 0)
        {
            string hex = BitConverter.ToString(buffer).Replace("-", "");
            _logger.LogInformation("Read diagnostic card successfully. Raw Hex: {Hex}", hex);
            
            // We do NOT guess the CoID from the raw bytes yet as per user instruction.
            // We return the raw hex for inspection.
            return new DiagnosticResult 
            { 
                Success = true, 
                RawDataHex = hex 
            };
        }
        
        return new DiagnosticResult 
        { 
            Success = false, 
            ErrorMessage = $"Failed to read card. SDK error code: {res}" 
        };
    }
}
