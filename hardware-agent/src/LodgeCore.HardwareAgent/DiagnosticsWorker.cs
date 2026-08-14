using System.Runtime.InteropServices;
using LodgeCore.HardwareAgent.Native;

namespace LodgeCore.HardwareAgent;

public class DiagnosticsWorker : BackgroundService
{
    private readonly ILogger<DiagnosticsWorker> _logger;

    public DiagnosticsWorker(ILogger<DiagnosticsWorker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("--- LodgeCore Hardware Diagnostics ---");
        
        // 1. Validate Process Architecture
        _logger.LogInformation("Architecture Check: {Arch}", RuntimeInformation.ProcessArchitecture);
        if (RuntimeInformation.ProcessArchitecture != Architecture.X86)
        {
            _logger.LogCritical("CRITICAL ERROR: Process is running as {Arch}. It MUST run as x86 to load the 32-bit LockSDK.dll.", RuntimeInformation.ProcessArchitecture);
            Environment.Exit(1);
            return;
        }

        // 2. Validate DLL Loading
        try
        {
            _logger.LogInformation("Testing LockSDK.dll load...");
            var result = new HomeLockResult(NativeSdkBridge.TP_Configuration(4));
            
            if (result.Code == HomeLockError.NO_RW_MACHINE)
            {
                _logger.LogWarning("SDK Loaded Successfully, but NO ENCODER WAS DETECTED.");
            }
            else if (result.Success)
            {
                _logger.LogInformation("SDK Loaded Successfully and Encoder IS DETECTED!");
            }
            else
            {
                _logger.LogWarning("SDK Loaded Successfully, but returned: {Status}", result.Message);
            }
        }
        catch (DllNotFoundException)
        {
            _logger.LogCritical("CRITICAL ERROR: LockSDK.dll was not found in the application directory.");
            Environment.Exit(1);
            return;
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "CRITICAL ERROR: Exception while calling LockSDK.dll");
            Environment.Exit(1);
            return;
        }

        _logger.LogInformation("--- Diagnostics Complete ---");
    }
}
