namespace LodgeCore.LockAgent.Hardware;

// ─── Request / Result value objects ──────────────────────────────────────────

public record EncodeRequest(
    string RoomNo,
    DateTime CheckIn,
    DateTime CheckOut,
    int Flags = 0,        // 0 = normal, 8 = re-issue (invalidates prior cards)
    int WaitMs = 10000);

public record EncodeResult(bool Success, string? CardSnr, int SdkCode, string? Error);

public record CancelRequest(int WaitMs = 10000);
public record CancelResult(bool Success, string? CardSnr, int SdkCode, string? Error);

public record ReadRequest(int WaitMs = 10000);
public record ReadResult(bool Success, string? CardSnr, string? RoomNo, DateTime? CheckIn, DateTime? CheckOut, int? Flags, int SdkCode, string? Error);

public record InitResult(bool Success, int SdkCode, string? Error);
public record PingResult(bool EncoderPresent, bool CardPresent, int SdkCode);

// ─── Interface ───────────────────────────────────────────────────────────────

/// <summary>
/// Vendor-neutral lock provider interface.
/// The PMS and CommandWorker depend only on this — never on DelunsProvider directly.
/// </summary>
public interface ILockProvider
{
    /// <summary>Initialize hardware (open COM port, select lock type).</summary>
    Task<InitResult> InitAsync(int lockType, string comPort);

    /// <summary>Encode a guest access card.</summary>
    Task<EncodeResult> EncodeGuestCardAsync(EncodeRequest request);

    /// <summary>Write a cancellation record to a card (physical revoke).</summary>
    Task<CancelResult> CancelCardAsync(CancelRequest request);

    /// <summary>Read guest card data from a card on the encoder.</summary>
    Task<ReadResult> ReadGuestCardAsync(ReadRequest request);

    /// <summary>Check encoder presence (uses TP_GetCardSnr as non-destructive probe).</summary>
    Task<PingResult> PingAsync();

    /// <summary>Graceful shutdown — release SDK resources.</summary>
    Task ShutdownAsync();
}
