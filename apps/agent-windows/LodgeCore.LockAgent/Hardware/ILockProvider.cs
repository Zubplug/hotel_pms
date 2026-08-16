namespace LodgeCore.LockAgent.Hardware;

// ─── Request / Result value objects ──────────────────────────────────────────

public record EncodeRequest(
    string RoomNo,
    DateTime CheckIn,
    DateTime CheckOut,
    int Flags = 0,        // 0 = normal, 8 = re-issue (invalidates prior cards)
    int WaitMs = 10000);

public record CancelRequest(int WaitMs = 10000);

public record ReadRequest(int WaitMs = 10000);

// Base result to preserve raw SDK error information
public abstract record LockOperationResult(
    bool Success, 
    int ErrorCode, 
    string Vendor, 
    string? VendorMessage);

public record EncodeResult(bool Success, string? CardSnr, int ErrorCode, string Vendor, string? VendorMessage) 
    : LockOperationResult(Success, ErrorCode, Vendor, VendorMessage);

public record CancelResult(bool Success, string? CardSnr, int ErrorCode, string Vendor, string? VendorMessage) 
    : LockOperationResult(Success, ErrorCode, Vendor, VendorMessage);

public record ReadResult(bool Success, string? CardSnr, string? RoomNo, DateTime? CheckIn, DateTime? CheckOut, int? Flags, int ErrorCode, string Vendor, string? VendorMessage) 
    : LockOperationResult(Success, ErrorCode, Vendor, VendorMessage);

public record InitResult(bool Success, int ErrorCode, string Vendor, string? VendorMessage) 
    : LockOperationResult(Success, ErrorCode, Vendor, VendorMessage);

public record PingResult(bool EncoderPresent, bool CardPresent, int ErrorCode, string Vendor, string? VendorMessage) 
    : LockOperationResult(EncoderPresent && CardPresent, ErrorCode, Vendor, VendorMessage);

// ─── Interface ───────────────────────────────────────────────────────────────

/// <summary>
/// Vendor-neutral lock provider interface.
/// </summary>
public interface ILockProvider
{
    string VendorName { get; }

    /// <summary>Initialize hardware (open COM port, select lock type).</summary>
    Task<InitResult> InitAsync(int lockType, string comPort);

    /// <summary>Encode a guest access card.</summary>
    Task<EncodeResult> EncodeGuestCardAsync(EncodeRequest request);

    /// <summary>Write a cancellation record to a card (physical revoke).</summary>
    Task<CancelResult> CancelCardAsync(CancelRequest request);

    /// <summary>Read guest card data from a card on the encoder.</summary>
    Task<ReadResult> ReadGuestCardAsync(ReadRequest request);

    /// <summary>Check encoder presence.</summary>
    Task<PingResult> PingAsync();

    /// <summary>Graceful shutdown — release SDK resources.</summary>
    Task ShutdownAsync();
}
