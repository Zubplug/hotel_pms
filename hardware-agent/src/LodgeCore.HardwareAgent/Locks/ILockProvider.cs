namespace LodgeCore.HardwareAgent.Locks;

public interface ILockProvider
{
    string VendorName { get; }

    Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken);
    Task<LockResult> EncodeCardAsync(string lockCode, DateTime checkInDate, DateTime checkOutDate, CancellationToken cancellationToken);
    Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Reads card data from the encoder. Returns structured card info (room number, SNR, validity dates).
    /// Used for the "read-before-encode" safety check during check-in.
    /// </summary>
    Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Erases / cancels the card currently on the encoder.
    /// </summary>
    Task<LockResult> CancelCardAsync(CancellationToken cancellationToken);
}

public class LockResult
{
    public bool Success { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? Vendor { get; set; }
    
    public static LockResult Ok(string vendor) => new LockResult { Success = true, Vendor = vendor };
    public static LockResult Fail(string code, string msg, string vendor) => new LockResult { Success = false, ErrorCode = code, ErrorMessage = msg, Vendor = vendor };
}

public class DiagnosticResult
{
    public bool Success { get; set; }
    public string? RawDataHex { get; set; }
    public int? DiscoveredCoID { get; set; }
    public string? ErrorMessage { get; set; }
    public string? Vendor { get; set; }
}

public class ReadCardResult
{
    public bool Success { get; set; }
    public bool IsBlank { get; set; }

    /// <summary>Room number encoded on the card (e.g. "0101" for room 101)</summary>
    public string? RoomNo { get; set; }

    /// <summary>Physical card serial number (SNR) as hex string</summary>
    public string? CardSnr { get; set; }

    /// <summary>Raw validity start date string from card</summary>
    public string? CheckIn { get; set; }

    /// <summary>Raw validity end date string from card</summary>
    public string? CheckOut { get; set; }

    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? Vendor { get; set; }

    public static ReadCardResult Blank(string vendor) => new ReadCardResult { Success = true, IsBlank = true, Vendor = vendor };
    public static ReadCardResult WithData(string roomNo, string cardSnr, string? checkIn, string? checkOut, string vendor) 
        => new ReadCardResult { Success = true, IsBlank = false, RoomNo = roomNo, CardSnr = cardSnr, CheckIn = checkIn, CheckOut = checkOut, Vendor = vendor };
    public static ReadCardResult Fail(string code, string msg, string vendor) 
        => new ReadCardResult { Success = false, ErrorCode = code, ErrorMessage = msg, Vendor = vendor };
}
