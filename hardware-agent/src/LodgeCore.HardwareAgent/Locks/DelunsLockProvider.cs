using System.Text;
using LodgeCore.HardwareAgent.Native;
using Microsoft.Extensions.Logging;

namespace LodgeCore.HardwareAgent.Locks;

public class DelunsLockProvider : ILockProvider
{
    private readonly ILogger<DelunsLockProvider> _logger;
    private bool _initialized = false;
    private const string DateFormat = "yyyy-MM-dd HH:mm";

    public DelunsLockProvider(ILogger<DelunsLockProvider> logger)
    {
        _logger = logger;
    }

    public string VendorName => "Deluns";

    private void EnsureInitialized()
    {
        int lockType = 4; // RF57 is typical default, could be 5 for RF50
        try
        {
            var envLockType = Environment.GetEnvironmentVariable("DELUNS_LOCK_TYPE");
            if (!string.IsNullOrEmpty(envLockType) && int.TryParse(envLockType, out var parsedType))
            {
                lockType = parsedType;
            }
        }
        catch { }

        // We explicitly do NOT cache initialization (i.e. we removed `if (_initialized) return;`)
        // The Deluns SDK DLL is known to heavily cache state. Re-calling TP_Configuration 
        // before every read/write flushes the internal buffers and forces a real hardware check,
        // preventing the SDK from returning the previously read card when the encoder is disconnected.
        int res = NativeSdkBridge.TP_Configuration(lockType);
        
        if (res == (int)LockSdkError.OPR_OK) 
        {
            _initialized = true;
        }
        else
        {
            _logger.LogWarning("Deluns SDK TP_Configuration failed with code {Code}", res);
            _initialized = false;
        }
    }

    public async Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Waiting for card on Deluns USB encoder...");
        EnsureInitialized();
        if (!_initialized) return false;

        var startTime = DateTime.UtcNow;
        while (DateTime.UtcNow - startTime < timeout)
        {
            if (cancellationToken.IsCancellationRequested) return false;

            var cardSnr = new StringBuilder(20);
            int result = NativeSdkBridge.TP_GetCardSnr(cardSnr);
            if (result == (int)LockSdkError.OPR_OK)
            {
                _logger.LogInformation("Card detected by Deluns Encoder. SNR={Snr}", cardSnr.ToString().TrimEnd('\0'));
                return true;
            }
            await Task.Delay(500, cancellationToken);
        }
        return false;
    }

    public async Task<LockResult> EncodeCardAsync(string lockCode, DateTime checkInDate, DateTime checkOutDate, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Encoding Deluns card for lock {LockCode}...", lockCode);
        EnsureInitialized();
        if (!_initialized) return LockResult.Fail("-999", "SDK not initialized", VendorName);

        var cardSnr = new StringBuilder(20);
        string checkinStr = checkInDate.ToString(DateFormat);
        string checkoutStr = checkOutDate.ToString(DateFormat);
        int flags = 1; // 1 = allow open deadbolt

        int result = NativeSdkBridge.TP_MakeGuestCardEx2(cardSnr, lockCode, checkinStr, checkoutStr, flags, 0);

        if (result == (int)LockSdkError.OPR_OK)
        {
            _logger.LogInformation("Deluns Encoding successful.");
            return LockResult.Ok(VendorName);
        }
        else
        {
            _logger.LogError("Failed to encode Deluns card. SDK returned: {Error}", result);
            return LockResult.Fail(result.ToString(), $"Deluns SDK error code: {result}", VendorName);
        }
    }

    public async Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Running Deluns Diagnostic Read...");
        EnsureInitialized();
        if (!_initialized) return new DiagnosticResult { Success = false, ErrorMessage = "SDK not initialized", Vendor = VendorName };

        var cardSnr = new StringBuilder(20);
        int result = NativeSdkBridge.TP_GetCardSnr(cardSnr);
        
        if (result == (int)LockSdkError.OPR_OK)
        {
            string hex = cardSnr.ToString().TrimEnd('\0');
            return new DiagnosticResult { Success = true, RawDataHex = hex, Vendor = VendorName };
        }
        return new DiagnosticResult { Success = false, ErrorMessage = $"Failed to read card. SDK error code: {result}", Vendor = VendorName };
    }

    public async Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Reading card data from Deluns encoder...");
        EnsureInitialized();
        if (!_initialized) return ReadCardResult.Fail("-999", "SDK not initialized", VendorName);

        // Guard: explicitly check if hardware encoder and card are physically present
        var pingSnr = new StringBuilder(20);
        int pingResult = NativeSdkBridge.TP_GetCardSnr(pingSnr);
        if (pingResult != (int)LockSdkError.OPR_OK)
        {
            _logger.LogWarning("Pre-read ping failed (code {Code}). Encoder disconnected or no card present.", pingResult);
            if (pingResult == (int)LockSdkError.NO_CARD) return ReadCardResult.Blank(VendorName);
            return ReadCardResult.Fail(pingResult.ToString(), $"Hardware ping failed: {pingResult}", VendorName);
        }

        var cardSnr = new StringBuilder(20);
        var roomNo = new StringBuilder(20);
        var checkinTime = new StringBuilder(30);
        var checkoutTime = new StringBuilder(30);
        int iFlags = 0;

        // waitMs=500 to force a real hardware poll instead of reading the DLL's internal memory cache
        int result = NativeSdkBridge.TP_ReadGuestCardEx2(cardSnr, roomNo, checkinTime, checkoutTime, ref iFlags, 500);

        if (result == (int)LockSdkError.OPR_OK)
        {
            string snr = cardSnr.ToString().TrimEnd('\0');
            string room = roomNo.ToString().TrimEnd('\0');
            string cinStr = checkinTime.ToString().TrimEnd('\0');
            string coutStr = checkoutTime.ToString().TrimEnd('\0');

            if (string.IsNullOrWhiteSpace(room))
            {
                return ReadCardResult.Blank(VendorName);
            }

            DateTime? cin = DateTime.TryParse(cinStr, out var c1) ? c1 : null;
            DateTime? cout = DateTime.TryParse(coutStr, out var c2) ? c2 : null;
            string? vFrom = cin?.ToString("yyyy-MM-dd HH:mm:ss");
            string? vTo = cout?.ToString("yyyy-MM-dd HH:mm:ss");

            return ReadCardResult.WithData(room, snr, vFrom, vTo, VendorName);
        }
        else if (result == (int)LockSdkError.NO_CARD)
        {
            return ReadCardResult.Blank(VendorName);
        }
        
        _logger.LogError("Deluns ReadCard returned error: {Error}", result);
        return ReadCardResult.Fail(result.ToString(), $"SDK ReadCard error: {result}", VendorName);
    }

    public async Task<LockResult> CancelCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Cancelling (erasing) card on Deluns encoder...");
        EnsureInitialized();
        if (!_initialized) return LockResult.Fail("-999", "SDK not initialized", VendorName);

        var cardSnr = new StringBuilder(20);
        int result = NativeSdkBridge.TP_CancelCardEx2(cardSnr, 0);

        if (result == (int)LockSdkError.OPR_OK)
        {
            _logger.LogInformation("Card cancelled successfully.");
            return LockResult.Ok(VendorName);
        }
        else
        {
            _logger.LogError("Failed to cancel card. SDK returned: {Error}", result);
            return LockResult.Fail(result.ToString(), $"SDK cancel error: {result}", VendorName);
        }
    }
}
