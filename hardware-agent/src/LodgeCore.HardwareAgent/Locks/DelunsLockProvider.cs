using System.Text;
using LodgeCore.HardwareAgent.Native;

namespace LodgeCore.HardwareAgent.Locks;

public class DelunsLockProvider : ILockProvider
{
    private readonly ILogger<DelunsLockProvider> _logger;

    public DelunsLockProvider(ILogger<DelunsLockProvider> logger)
    {
        _logger = logger;
    }

    public string VendorName => "Deluns";

    public async Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Waiting for card on Deluns USB encoder...");
        
        var startTime = DateTime.UtcNow;
        byte fUSB = 1;
        
        NativeSdkBridge.initializeUSB(fUSB);

        while (DateTime.UtcNow - startTime < timeout)
        {
            if (cancellationToken.IsCancellationRequested) return false;

            byte[] buffer = new byte[128];
            int res = NativeSdkBridge.ReadCard(fUSB, buffer);
            if (res == 0)
            {
                _logger.LogInformation("Card detected by Deluns Encoder.");
                return true;
            }

            await Task.Delay(500, cancellationToken);
        }

        return false;
    }

    public async Task<LockResult> EncodeCardAsync(string lockCode, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Encoding Deluns card for lock {LockCode}...", lockCode);
        
        byte fUSB = 1;
        int dlsCoID = 0;
        string bDate = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        string eDate = DateTime.Now.AddDays(1).ToString("yyyy-MM-dd HH:mm:ss");
        byte cardNo = 1;
        byte dai = 0;
        byte llock = 0;
        byte pdoors = 0;
        string cardHexStr = "";

        int res = NativeSdkBridge.GuestCard(fUSB, dlsCoID, cardNo, dai, llock, pdoors, bDate, eDate, lockCode, cardHexStr);

        if (res == 0)
        {
            _logger.LogInformation("Deluns Encoding successful. Buzzing encoder...");
            NativeSdkBridge.Buzzer(fUSB, 10);
            return LockResult.Ok(VendorName);
        }
        else
        {
            _logger.LogError("Failed to encode Deluns card. SDK returned: {Error}", res);
            return LockResult.Fail(res.ToString(), $"Deluns SDK error code: {res}", VendorName);
        }
    }

    public async Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Running Deluns Diagnostic Read...");
        
        byte fUSB = 1;
        NativeSdkBridge.initializeUSB(fUSB);
        
        byte[] buffer = new byte[128];
        int res = NativeSdkBridge.ReadCard(fUSB, buffer);
        
        if (res == 0)
        {
            string hex = BitConverter.ToString(buffer).Replace("-", "");
            _logger.LogInformation("Read diagnostic card successfully. Raw Hex: {Hex}", hex);
            
            return new DiagnosticResult 
            { 
                Success = true, 
                RawDataHex = hex,
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

    /// <summary>
    /// Reads a card from the encoder and parses room number, SNR, and validity dates.
    /// The Deluns ReadCard buffer layout (128 bytes):
    ///   Bytes 0-3:   Card SNR (4 bytes, hex)
    ///   Bytes 4-7:   Hotel code (dlsCoID)
    ///   Bytes 8-11:  Room number (ASCII, zero-padded, e.g. "0101")
    ///   Bytes 12-17: Check-in date (YYMMDD)
    ///   Bytes 18-23: Check-out date (YYMMDD)
    ///   Remaining:   Flags and padding
    /// 
    /// NOTE: If the card is blank (all zeros), IsBlank = true is returned.
    /// </summary>
    public async Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Reading card data from Deluns encoder...");
        
        byte fUSB = 1;
        NativeSdkBridge.initializeUSB(fUSB);
        
        byte[] buffer = new byte[128];
        int res = NativeSdkBridge.ReadCard(fUSB, buffer);
        
        if (res != 0)
        {
            _logger.LogError("Deluns ReadCard returned error: {Error}", res);
            return ReadCardResult.Fail(res.ToString(), $"SDK ReadCard error: {res}", VendorName);
        }

        // Check if card is blank (all zeros in meaningful region)
        bool isAllZero = true;
        for (int i = 0; i < 24; i++)
        {
            if (buffer[i] != 0) { isAllZero = false; break; }
        }

        if (isAllZero)
        {
            _logger.LogInformation("Card is blank (all zeros).");
            return ReadCardResult.Blank(VendorName);
        }

        // Parse Card SNR (bytes 0-3, as hex string)
        string cardSnr = BitConverter.ToString(buffer, 0, 4).Replace("-", "");

        // Parse Room Number (bytes 8-11, ASCII)
        string roomNo = Encoding.ASCII.GetString(buffer, 8, 4).TrimEnd('\0').Trim();
        if (string.IsNullOrWhiteSpace(roomNo))
        {
            // Also try as blank if room is empty
            return ReadCardResult.Blank(VendorName);
        }

        // Parse validity dates (bytes 12-17 = check-in YYMMDD, bytes 18-23 = check-out YYMMDD)
        string validFromRaw = Encoding.ASCII.GetString(buffer, 12, 6).TrimEnd('\0');
        string validToRaw   = Encoding.ASCII.GetString(buffer, 18, 6).TrimEnd('\0');

        // Try to parse dates (YYMMDD → yyyy-MM-dd)
        string? validFrom = TryParseYYMMDD(validFromRaw);
        string? validTo   = TryParseYYMMDD(validToRaw);

        _logger.LogInformation(
            "Card read: Room={RoomNo}, SNR={Snr}, ValidFrom={VF}, ValidTo={VT}",
            roomNo, cardSnr, validFrom, validTo);

        return ReadCardResult.WithData(roomNo, cardSnr, validFrom, validTo, VendorName);
    }

    /// <summary>
    /// Cancels/erases the card by encoding it with all-zero dates and flags.
    /// The Deluns SDK doesn't have a dedicated erase command — the standard approach
    /// is to write a card with a past checkout date so it is immediately invalid.
    /// </summary>
    public async Task<LockResult> CancelCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Cancelling (erasing) card on Deluns encoder...");
        
        byte fUSB = 1;
        int dlsCoID = 0;
        // Use a past date to invalidate the card
        string bDate = "2000-01-01 00:00:00";
        string eDate = "2000-01-01 00:00:00";
        byte cardNo = 1;
        byte dai = 0;
        byte llock = 0;
        byte pdoors = 0;
        string cardHexStr = "";
        // Room "0000" signals cancel/erase in Deluns SDK
        string lockCode = "0000";

        int res = NativeSdkBridge.GuestCard(fUSB, dlsCoID, cardNo, dai, llock, pdoors, bDate, eDate, lockCode, cardHexStr);

        if (res == 0)
        {
            _logger.LogInformation("Card cancelled successfully.");
            NativeSdkBridge.Buzzer(fUSB, 5);
            return LockResult.Ok(VendorName);
        }
        else
        {
            _logger.LogError("Failed to cancel card. SDK returned: {Error}", res);
            return LockResult.Fail(res.ToString(), $"SDK cancel error: {res}", VendorName);
        }
    }

    private static string? TryParseYYMMDD(string raw)
    {
        if (raw.Length < 6) return null;
        try
        {
            int yy = int.Parse(raw.Substring(0, 2));
            int mm = int.Parse(raw.Substring(2, 2));
            int dd = int.Parse(raw.Substring(4, 2));
            int year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
            return $"{year:D4}-{mm:D2}-{dd:D2}";
        }
        catch
        {
            return null;
        }
    }
}
