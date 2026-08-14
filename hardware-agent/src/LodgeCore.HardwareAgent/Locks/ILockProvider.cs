namespace LodgeCore.HardwareAgent.Locks;

public interface ILockProvider
{
    Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken);
    Task<LockResult> EncodeCardAsync(string lockCode, CancellationToken cancellationToken);
    Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken);
}

public class LockResult
{
    public bool Success { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    
    public static LockResult Ok() => new LockResult { Success = true };
    public static LockResult Fail(string code, string msg) => new LockResult { Success = false, ErrorCode = code, ErrorMessage = msg };
}

public class DiagnosticResult
{
    public bool Success { get; set; }
    public string? RawDataHex { get; set; }
    public int? DiscoveredCoID { get; set; }
    public string? ErrorMessage { get; set; }
}
