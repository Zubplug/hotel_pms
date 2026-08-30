using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;

namespace LodgeCore.HardwareAgent.Locks;

public class Rfv2016LockProvider : ILockProvider
{
    private readonly ILogger<Rfv2016LockProvider> _logger;
    private const string VendorId = "RFV2016";

    public string VendorName => VendorId;

    public Rfv2016LockProvider(ILogger<Rfv2016LockProvider> logger)
    {
        _logger = logger;
    }

    public Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        // Not heavily used in offline desktop but interface requires it.
        return Task.FromResult(true);
    }

    public Task<LockResult> EncodeCardAsync(string lockCode, DateTime checkInDate, DateTime checkOutDate, CancellationToken cancellationToken)
    {
        return Task.Run(() =>
        {
            try
            {
                // Format: yyyymmddhhmm
                string startStr = checkInDate.ToString("yyyyMMddHHmm");
                string endStr = checkOutDate.ToString("yyyyMMddHHmm");

                // nCode = 1 (new guest card)
                // jLift = "0" (no elevator by default, or configurable if needed)
                int res = Rfv2016LockSdkNative.W_Card(lockCode, startStr, endStr, "API", 1, "0");

                if (res == (int)Rfv2016LockSdkNative.RfvError.SUCCESS)
                {
                    return LockResult.Ok(VendorId);
                }

                return LockResult.Fail(res.ToString(), GetErrorMessage(res), VendorId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RFV2016 encode failed");
                return LockResult.Fail("-1", ex.Message, VendorId);
            }
        });
    }

    public Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new DiagnosticResult { Success = true, Vendor = VendorId });
    }

    public Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken)
    {
        return Task.Run(() =>
        {
            try
            {
                IntPtr ptr = Rfv2016LockSdkNative.R_Card(1);
                string? resultStr = Marshal.PtrToStringAnsi(ptr);

                if (string.IsNullOrEmpty(resultStr))
                {
                    return ReadCardResult.Fail("-1", "Read empty from encoder", VendorId);
                }

                // Check for numeric errors
                if (int.TryParse(resultStr, out int errCode))
                {
                    if (errCode == (int)Rfv2016LockSdkNative.RfvError.NO_CARD_INFO)
                    {
                        return ReadCardResult.Blank(VendorId);
                    }
                    if (errCode == (int)Rfv2016LockSdkNative.RfvError.NO_CARD)
                    {
                        return ReadCardResult.Fail(errCode.ToString(), "No Card", VendorId);
                    }
                    return ReadCardResult.Fail(errCode.ToString(), GetErrorMessage(errCode), VendorId);
                }

                if (resultStr.StartsWith("WOFF"))
                {
                    return ReadCardResult.Blank(VendorId); // Cancelled
                }

                // Expected format: ok + 1101 + guest card + 2009-03-31 08: 00 + 2009-12-31 12: 00 + ...
                if (resultStr.StartsWith("ok", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = resultStr.Split('+');
                    if (parts.Length >= 5)
                    {
                        string roomNo = parts[1].Trim();
                        string checkIn = parts[3].Trim();
                        string checkOut = parts[4].Trim();

                        // Try to get card SNR if available (often the last part)
                        string snr = parts.Length > 8 ? parts[parts.Length - 1].Trim() : "";
                        
                        return ReadCardResult.WithData(roomNo, snr, checkIn, checkOut, VendorId);
                    }
                }

                return ReadCardResult.Fail("-1", $"Unexpected response: {resultStr}", VendorId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RFV2016 read failed");
                return ReadCardResult.Fail("-1", ex.Message, VendorId);
            }
        });
    }

    public Task<LockResult> CancelCardAsync(CancellationToken cancellationToken)
    {
        return Task.Run(() =>
        {
            try
            {
                int res = Rfv2016LockSdkNative.Woff_Card(0);
                if (res == (int)Rfv2016LockSdkNative.RfvError.SUCCESS)
                {
                    return LockResult.Ok(VendorId);
                }
                return LockResult.Fail(res.ToString(), GetErrorMessage(res), VendorId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RFV2016 cancel failed");
                return LockResult.Fail("-1", ex.Message, VendorId);
            }
        });
    }

    private string GetErrorMessage(int code)
    {
        return (Rfv2016LockSdkNative.RfvError)code switch
        {
            Rfv2016LockSdkNative.RfvError.COMM_ERROR => "Communication error",
            Rfv2016LockSdkNative.RfvError.DATA_DECRYPT_ERROR => "Data decryption error",
            Rfv2016LockSdkNative.RfvError.BAD_START_DATE => "Incorrect start date format",
            Rfv2016LockSdkNative.RfvError.BAD_END_DATE => "Incorrect end date format",
            Rfv2016LockSdkNative.RfvError.DB_CONNECT_FAIL => "Failed to connect to database",
            Rfv2016LockSdkNative.RfvError.NO_ROOM => "Room number not found",
            Rfv2016LockSdkNative.RfvError.UNPLUG_SETTER => "Please unplug the setter before operating",
            Rfv2016LockSdkNative.RfvError.NO_CARD => "No card detected",
            Rfv2016LockSdkNative.RfvError.DATA_LEN_MISMATCH => "Data length mismatch",
            Rfv2016LockSdkNative.RfvError.READ_DATA_ERR => "Read data block error",
            Rfv2016LockSdkNative.RfvError.KEY_COMPARE_ERR => "Sector key compare error",
            Rfv2016LockSdkNative.RfvError.NO_CARD_INFO => "No information on card",
            _ => $"Unknown error {code}"
        };
    }
}
