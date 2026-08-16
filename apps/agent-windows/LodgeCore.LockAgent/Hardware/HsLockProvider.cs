using System.Text;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Hardware;

/// <summary>
/// HS Lock SDK provider.
/// 
/// ARCHITECTURE: x86 required. HsLockSDK.dll is a 32-bit unmanaged DLL.
/// THREADING: The DLL is NOT thread-safe. CommandWorker serialises calls.
/// </summary>
public sealed class HsLockProvider : ILockProvider
{
    private readonly ILogger<HsLockProvider> _logger;
    private bool _initialized = false;
    private int _lockType = 4; // default RF57 or whatever HS Lock uses

    // DateTime format required by HS LockSDK (as per C++ header "YYYY-MM-DD hh:mm:ss")
    // Note: C# 'HH' is 24-hour clock.
    private const string DateFormat = "yyyy-MM-dd HH:mm:ss";

    public HsLockProvider(ILogger<HsLockProvider> logger)
    {
        _logger = logger;
    }

    public string VendorName => "HsLock";

    /// <inheritdoc/>
    public Task<InitResult> InitAsync(int lockType, string comPort)
    {
        _lockType = lockType;
        _logger.LogInformation("Initializing HsLockSDK (lock type {LockType}, port {ComPort})", lockType, comPort);

        try
        {
            // Note: HsLockSDK TP_Configuration auto-detects COM port if it works like Deluns.
            int result = HsLockSdkNative.TP_Configuration(lockType);

            if (result == (int)HsLockSdkNative.HsLockError.OPR_OK)
            {
                _initialized = true;
                _logger.LogInformation("HsLockSDK initialized successfully");
                return Task.FromResult(new InitResult(true, result, VendorName, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("HsLockSDK initialization failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new InitResult(false, result, VendorName, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception initializing HsLockSDK");
            return Task.FromResult(new InitResult(false, -999, VendorName, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task<EncodeResult> EncodeGuestCardAsync(EncodeRequest request)
    {
        if (!_initialized)
            return Task.FromResult(new EncodeResult(false, null, -999, VendorName, "SDK not initialized"));

        _logger.LogInformation(
            "Encoding HS guest card: Room={Room}, CheckIn={CheckIn:s}, CheckOut={CheckOut:s}, Flags={Flags}",
            request.RoomNo, request.CheckIn, request.CheckOut, request.Flags);

        try
        {
            var cardSnr = new StringBuilder(20);
            string checkinStr  = request.CheckIn == DateTime.MinValue
                ? string.Empty
                : request.CheckIn.ToString(DateFormat, System.Globalization.CultureInfo.InvariantCulture);
            string checkoutStr = request.CheckOut.ToString(DateFormat, System.Globalization.CultureInfo.InvariantCulture);

            // Note: HS Lock SDK doesn't take WaitMs on MakeGuestCardEx, unlike Deluns
            int result = HsLockSdkNative.TP_MakeGuestCardEx(
                cardSnr,
                request.RoomNo,
                checkinStr,
                checkoutStr,
                request.Flags);

            if (result == (int)HsLockSdkNative.HsLockError.OPR_OK)
            {
                var snr = cardSnr.ToString().TrimEnd('\0');
                _logger.LogInformation("HS Card encoded successfully. SNR={Snr}", snr);
                return Task.FromResult(new EncodeResult(true, snr, result, VendorName, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("HS Card encode failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new EncodeResult(false, null, result, VendorName, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception encoding HS card");
            return Task.FromResult(new EncodeResult(false, null, -999, VendorName, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task<CancelResult> CancelCardAsync(CancelRequest request)
    {
        if (!_initialized)
            return Task.FromResult(new CancelResult(false, null, -999, VendorName, "SDK not initialized"));

        _logger.LogInformation("Writing HS cancellation card");

        try
        {
            var cardSnr = new StringBuilder(20);
            int result = HsLockSdkNative.TP_CancelCard(cardSnr);

            if (result == (int)HsLockSdkNative.HsLockError.OPR_OK)
            {
                var snr = cardSnr.ToString().TrimEnd('\0');
                _logger.LogInformation("HS Cancellation card written. SNR={Snr}", snr);
                return Task.FromResult(new CancelResult(true, snr, result, VendorName, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("HS Cancel card failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new CancelResult(false, null, result, VendorName, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception writing HS cancellation card");
            return Task.FromResult(new CancelResult(false, null, -999, VendorName, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task<ReadResult> ReadGuestCardAsync(ReadRequest request)
    {
        if (!_initialized)
            return Task.FromResult(new ReadResult(false, null, null, null, null, null, -999, VendorName, "SDK not initialized"));

        _logger.LogInformation("Reading HS guest card");

        try
        {
            var cardSnr = new StringBuilder(20);
            var roomNo = new StringBuilder(20);
            var checkinTime = new StringBuilder(30);
            var checkoutTime = new StringBuilder(30);
            int iFlags = 0;

            int result = HsLockSdkNative.TP_ReadGuestCardEx(cardSnr, roomNo, checkinTime, checkoutTime, ref iFlags);

            if (result == (int)HsLockSdkNative.HsLockError.OPR_OK)
            {
                var snr = cardSnr.ToString().TrimEnd('\0');
                var rn = roomNo.ToString().TrimEnd('\0');
                var cinStr = checkinTime.ToString().TrimEnd('\0');
                var coutStr = checkoutTime.ToString().TrimEnd('\0');

                DateTime? cin = DateTime.TryParse(cinStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var c1) ? c1 : null;
                DateTime? cout = DateTime.TryParse(coutStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var c2) ? c2 : null;

                _logger.LogInformation("HS Card read successfully. SNR={Snr}, Room={Room}, CheckIn={Cin}, CheckOut={Cout}, Flags={Flags}", snr, rn, cin, cout, iFlags);
                return Task.FromResult(new ReadResult(true, snr, rn, cin, cout, iFlags, result, VendorName, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("HS Read card failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new ReadResult(false, null, null, null, null, null, result, VendorName, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception reading HS card");
            return Task.FromResult(new ReadResult(false, null, null, null, null, null, -999, VendorName, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task<PingResult> PingAsync()
    {
        try
        {
            var cardSnr = new StringBuilder(20);
            int result = HsLockSdkNative.TP_GetCardSnr(cardSnr);

            // -2 = no encoder, -1 = encoder present but no card, 1 = card present
            bool encoderPresent = result != (int)HsLockSdkNative.HsLockError.NO_RW_MACHINE;
            bool cardPresent    = result == (int)HsLockSdkNative.HsLockError.OPR_OK;

            return Task.FromResult(new PingResult(encoderPresent, cardPresent, result, VendorName, null));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during HS PING");
            return Task.FromResult(new PingResult(false, false, -999, VendorName, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task ShutdownAsync()
    {
        _initialized = false;
        _logger.LogInformation("HsLockSDK shutdown");
        return Task.CompletedTask;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static string DescribeError(int code) => (HsLockSdkNative.HsLockError)code switch
    {
        HsLockSdkNative.HsLockError.NO_CARD            => "No card detected on encoder",
        HsLockSdkNative.HsLockError.NO_RW_MACHINE      => "No encoder/reader detected — check USB connection",
        HsLockSdkNative.HsLockError.INVALID_CARD       => "Invalid card",
        HsLockSdkNative.HsLockError.CARD_TYPE_ERROR    => "Wrong card type",
        HsLockSdkNative.HsLockError.RDWR_ERROR         => "Card read/write error",
        HsLockSdkNative.HsLockError.PORT_NOT_OPEN      => "COM port not open",
        HsLockSdkNative.HsLockError.INVALID_PARAMETER  => "Invalid parameter",
        HsLockSdkNative.HsLockError.PORT_IN_USED       => "COM port already in use by another process",
        HsLockSdkNative.HsLockError.COMM_ERROR         => "Communication error",
        HsLockSdkNative.HsLockError.ERR_NOT_REGISTERED => "LockSDK not registered — check SDK license file",
        HsLockSdkNative.HsLockError.ERR_ROOMS_CNT_OVER => "Room count limit exceeded",
        _                                              => $"Unknown error code: {code}",
    };
}
