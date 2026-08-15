using System.Text;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Hardware;

/// <summary>
/// Deluns eLock provider — wraps LockSDK.dll V4.7 via P/Invoke.
/// 
/// THREADING: The DLL is NOT thread-safe. All calls are serialised by
/// CommandWorker via SemaphoreSlim(1,1). Do not call methods from multiple threads.
/// 
/// ARCHITECTURE: x86 required. LockSDK.dll is a 32-bit unmanaged DLL.
/// </summary>
public sealed class DelunsProvider : ILockProvider
{
    private readonly ILogger<DelunsProvider> _logger;
    private bool _initialized = false;
    private int _lockType = 5; // default RF50

    // DateTime format required by LockSDK
    private const string DateFormat = "yyyy-MM-dd HH:mm:ss";

    public DelunsProvider(ILogger<DelunsProvider> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc/>
    public Task<InitResult> InitAsync(int lockType, string comPort)
    {
        _lockType = lockType;
        _logger.LogInformation("Initializing LockSDK (lock type {LockType}, port {ComPort})", lockType, comPort);

        try
        {
            // TP_Configuration handles both lock type selection and COM port.
            // The COM port is configured via the encoder hardware itself — 
            // the SDK auto-detects or uses the Windows COM port assignment.
            int result = LockSdkNative.TP_Configuration(lockType);

            if (result == (int)LockSdkError.OPR_OK)
            {
                _initialized = true;
                _logger.LogInformation("LockSDK initialized successfully");
                return Task.FromResult(new InitResult(true, result, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("LockSDK initialization failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new InitResult(false, result, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception initializing LockSDK");
            return Task.FromResult(new InitResult(false, -999, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task<EncodeResult> EncodeGuestCardAsync(EncodeRequest request)
    {
        if (!_initialized)
            return Task.FromResult(new EncodeResult(false, null, -999, "SDK not initialized"));

        _logger.LogInformation(
            "Encoding guest card: Room={Room}, CheckIn={CheckIn:s}, CheckOut={CheckOut:s}, Flags={Flags}",
            request.RoomNo, request.CheckIn, request.CheckOut, request.Flags);

        try
        {
            var cardSnr = new StringBuilder(20);
            string checkinStr  = request.CheckIn == DateTime.MinValue
                ? string.Empty   // empty = SDK uses current time
                : request.CheckIn.ToString(DateFormat, System.Globalization.CultureInfo.InvariantCulture);
            string checkoutStr = request.CheckOut.ToString(DateFormat, System.Globalization.CultureInfo.InvariantCulture);

            int result = LockSdkNative.TP_MakeGuestCardEx2(
                cardSnr,
                request.RoomNo,
                checkinStr,
                checkoutStr,
                request.Flags,
                request.WaitMs);

            if (result == (int)LockSdkError.OPR_OK)
            {
                var snr = cardSnr.ToString().TrimEnd('\0');
                _logger.LogInformation("Card encoded successfully. SNR={Snr}", snr);
                return Task.FromResult(new EncodeResult(true, snr, result, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("Card encode failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new EncodeResult(false, null, result, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception encoding card");
            return Task.FromResult(new EncodeResult(false, null, -999, ex.Message));
        }
    }

    /// <inheritdoc/>
    public Task<CancelResult> CancelCardAsync(CancelRequest request)
    {
        if (!_initialized)
            return Task.FromResult(new CancelResult(false, null, -999, "SDK not initialized"));

        _logger.LogInformation("Writing cancellation card (waitMs={WaitMs})", request.WaitMs);

        try
        {
            var cardSnr = new StringBuilder(20);
            int result = LockSdkNative.TP_CancelCardEx2(cardSnr, request.WaitMs);

            if (result == (int)LockSdkError.OPR_OK)
            {
                var snr = cardSnr.ToString().TrimEnd('\0');
                _logger.LogInformation("Cancellation card written. SNR={Snr}", snr);
                return Task.FromResult(new CancelResult(true, snr, result, null));
            }
            else
            {
                var error = DescribeError(result);
                _logger.LogError("Cancel card failed: {Error} (code {Code})", error, result);
                return Task.FromResult(new CancelResult(false, null, result, error));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception writing cancellation card");
            return Task.FromResult(new CancelResult(false, null, -999, ex.Message));
        }
    }

    /// <inheritdoc/>
    /// Uses TP_GetCardSnr as a non-destructive encoder presence probe.
    public Task<PingResult> PingAsync()
    {
        try
        {
            var cardSnr = new StringBuilder(20);
            int result = LockSdkNative.TP_GetCardSnr(cardSnr);

            // -2 = no encoder, -1 = encoder present but no card, 1 = card present
            bool encoderPresent = result != (int)LockSdkError.NO_RW_MACHINE;
            bool cardPresent    = result == (int)LockSdkError.OPR_OK;

            return Task.FromResult(new PingResult(encoderPresent, cardPresent, result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during PING");
            return Task.FromResult(new PingResult(false, false, -999));
        }
    }

    /// <inheritdoc/>
    public Task ShutdownAsync()
    {
        _initialized = false;
        _logger.LogInformation("LockSDK shutdown");
        return Task.CompletedTask;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static string DescribeError(int code) => (LockSdkError)code switch
    {
        LockSdkError.NO_CARD            => "No card detected on encoder",
        LockSdkError.NO_RW_MACHINE      => "No encoder/reader detected — check USB connection",
        LockSdkError.INVALID_CARD       => "Invalid card",
        LockSdkError.CARD_TYPE_ERROR    => "Wrong card type (check RF series setting)",
        LockSdkError.RDWR_ERROR         => "Card read/write error",
        LockSdkError.PORT_NOT_OPEN      => "COM port not open",
        LockSdkError.INVALID_PARAMETER  => "Invalid parameter",
        LockSdkError.PORT_IN_USED       => "COM port already in use by another process",
        LockSdkError.COMM_ERROR         => "Communication error",
        LockSdkError.ERR_NOT_REGISTERED => "LockSDK not registered — check SDK license file",
        LockSdkError.ERR_ROOMS_CNT_OVER => "Room count limit exceeded",
        _                               => $"Unknown error code: {code}",
    };
}
