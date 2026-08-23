using System.Text;
using Microsoft.Extensions.Logging;

namespace LodgeCore.HardwareAgent.Locks;

public class HsLockProvider : ILockProvider
{
    private readonly ILogger<HsLockProvider> _logger;
    private bool _initialized = false;
    
    // HS Lock uses format: "YYYY-MM-DD hh:mm:ss"
    private const string DateFormat = "yyyy-MM-dd HH:mm:ss";

    public HsLockProvider(ILogger<HsLockProvider> logger)
    {
        _logger = logger;
    }

    public string VendorName => "HsLock";

    private void EnsureInitialized()
    {
        if (_initialized) return;

        _logger.LogInformation("Initializing HS Lock SDK...");
        // 4 = RF57, 5 = RF50. Usually passed from config, but hardcoded to 4 here for HS Lock default.
        int result = HsLockSdkNative.TP_Configuration(4);
        if (result == (int)HsLockSdkNative.HsLockError.OPR_OK)
        {
            _initialized = true;
            _logger.LogInformation("HS Lock SDK initialized.");
        }
        else
        {
            _logger.LogWarning("HS Lock SDK Init returned {Code}. It might still work if already initialized.", result);
            _initialized = true; // Attempt to proceed anyway as some SDKs only init once per process
        }
    }

    public async Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Waiting for card on HS Lock encoder...");
        EnsureInitialized();

        var startTime = DateTime.UtcNow;

        while (DateTime.UtcNow - startTime < timeout)
        {
            if (cancellationToken.IsCancellationRequested) return false;

            var cardSnr = new StringBuilder(20);
            int res = HsLockSdkNative.TP_GetCardSnr(cardSnr);
            
            // OPR_OK (1) means card present
            if (res == (int)HsLockSdkNative.HsLockError.OPR_OK)
            {
                _logger.LogInformation("Card detected by HS Lock Encoder. SNR: {Snr}", cardSnr.ToString());
                return true;
            }

            await Task.Delay(500, cancellationToken);
        }

        return false;
    }

    public async Task<LockResult> EncodeCardAsync(string lockCode, DateTime checkInDate, DateTime checkOutDate, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Encoding HS Lock card for lock {LockCode}...", lockCode);
        EnsureInitialized();

        string checkinStr = checkInDate.ToString(DateFormat);
        string checkoutStr = checkOutDate.ToString(DateFormat);
        
        var cardSnr = new StringBuilder(20);
        int flags = 8; // Assuming 8 = override/new guest card

        int res = HsLockSdkNative.TP_MakeGuestCardEx(cardSnr, lockCode, checkinStr, checkoutStr, flags);

        if (res == (int)HsLockSdkNative.HsLockError.OPR_OK)
        {
            _logger.LogInformation("HS Encoding successful. SNR: {Snr}", cardSnr.ToString());
            return LockResult.Ok(VendorName);
        }
        else
        {
            _logger.LogError("Failed to encode HS card. SDK returned: {Error}", res);
            return LockResult.Fail(res.ToString(), $"HS SDK error code: {res}", VendorName);
        }
    }

    public async Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Running HS Diagnostic Read...");
        EnsureInitialized();

        var cardSnr = new StringBuilder(20);
        var roomNo = new StringBuilder(20);
        var checkinTime = new StringBuilder(30);
        var checkoutTime = new StringBuilder(30);
        int iFlags = 0;

        int res = HsLockSdkNative.TP_ReadGuestCardEx(cardSnr, roomNo, checkinTime, checkoutTime, ref iFlags);

        if (res == (int)HsLockSdkNative.HsLockError.OPR_OK)
        {
            _logger.LogInformation("Read HS diagnostic card successfully.");
            
            return new DiagnosticResult 
            { 
                Success = true, 
                RawDataHex = cardSnr.ToString(), // Just returning SNR as raw hex for diagnostic
                Vendor = VendorName
            };
        }
        
        return new DiagnosticResult 
        { 
            Success = false, 
            ErrorMessage = $"Failed to read card. SDK error code: {res}",
            Vendor = VendorName
        };
    }

    public async Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Reading card data from HS Lock encoder...");
        EnsureInitialized();

        var cardSnr = new StringBuilder(20);
        var roomNo = new StringBuilder(20);
        var checkinTime = new StringBuilder(30);
        var checkoutTime = new StringBuilder(30);
        int iFlags = 0;

        int res = HsLockSdkNative.TP_ReadGuestCardEx(cardSnr, roomNo, checkinTime, checkoutTime, ref iFlags);

        if (res != (int)HsLockSdkNative.HsLockError.OPR_OK)
        {
            if (res == (int)HsLockSdkNative.HsLockError.END_OF_DATA_CARD || res == (int)HsLockSdkNative.HsLockError.INVALID_CARD)
            {
                _logger.LogInformation("Card is blank or invalid.");
                return ReadCardResult.Blank(VendorName);
            }

            _logger.LogError("HS ReadCard returned error: {Error}", res);
            return ReadCardResult.Fail(res.ToString(), $"SDK ReadCard error: {res}", VendorName);
        }

        string rn = roomNo.ToString().TrimEnd('\0');
        string snr = cardSnr.ToString().TrimEnd('\0');
        string cinStr = checkinTime.ToString().TrimEnd('\0');
        string coutStr = checkoutTime.ToString().TrimEnd('\0');

        if (string.IsNullOrWhiteSpace(rn))
        {
            return ReadCardResult.Blank(VendorName);
        }

        DateTime? cin = DateTime.TryParse(cinStr, out var c1) ? c1 : null;
        DateTime? cout = DateTime.TryParse(coutStr, out var c2) ? c2 : null;
        string? vFrom = cin?.ToString("yyyy-MM-dd HH:mm:ss");
        string? vTo = cout?.ToString("yyyy-MM-dd HH:mm:ss");

        _logger.LogInformation(
            "Card read: Room={RoomNo}, SNR={Snr}, ValidFrom={VF}, ValidTo={VT}",
            rn, snr, vFrom, vTo);

        // Return the formatted string dates
        return ReadCardResult.WithData(rn, snr, vFrom, vTo, VendorName);
    }

    public async Task<LockResult> CancelCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Cancelling (erasing) card on HS Lock encoder...");
        EnsureInitialized();

        var cardSnr = new StringBuilder(20);
        int res = HsLockSdkNative.TP_CancelCard(cardSnr);

        if (res == (int)HsLockSdkNative.HsLockError.OPR_OK)
        {
            _logger.LogInformation("HS Card cancelled successfully.");
            return LockResult.Ok(VendorName);
        }
        else
        {
            _logger.LogError("Failed to cancel HS card. SDK returned: {Error}", res);
            return LockResult.Fail(res.ToString(), $"SDK cancel error: {res}", VendorName);
        }
    }
}
