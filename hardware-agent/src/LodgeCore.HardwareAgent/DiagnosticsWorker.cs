using System.Runtime.InteropServices;

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

        // Do not call TP_Configuration from the background diagnostics worker.
        // The Deluns SDK owns the encoder COM port process-wide. Opening it here
        // (using the legacy HS binding) prevents the actual Deluns card operation
        // in the desktop app from acquiring the port and returns SDK error -11.
        // The configured lock provider performs the hardware initialization only
        // when a real card operation is requested.
        _logger.LogInformation("Skipping startup SDK probe; encoder initialization is owned by the configured lock provider.");

        _logger.LogInformation("--- Diagnostics Complete ---");
    }
}
