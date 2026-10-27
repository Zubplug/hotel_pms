using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LodgeCore.HardwareAgent.Locks;

/// <summary>
/// Lock provider for ACS Hotel / Q508 proUSB card-lock system.
/// Uses proRFL.dll (32-bit stdcall) via P/Invoke.
///
/// Required AgentSettings:
///   "Provider": "PROUSB"
///   "ProUsbHotelCode": &lt;dlsCoID integer from vendor app System.ini or CardLock.mdb&gt;
///
/// IMPORTANT: This project must be compiled for x86 (32-bit) because proRFL.dll is 32-bit.
/// </summary>
public class ProUsbLockProvider : ILockProvider
{
    private readonly ILogger<ProUsbLockProvider> _logger;
    private readonly int _hotelCode;        // dlsCoID
    private readonly byte _usbPort;         // usually 1
    private bool _initialized;

    // proRFL.dll date format
    private const string DateFormat = "yyMMddHHmm"; // "YYMMDDHHMM"

    public ProUsbLockProvider(ILogger<ProUsbLockProvider> logger, IOptions<AgentSettings> settings)
    {
        _logger = logger;

        _usbPort = settings.Value.ExtendedSettings.TryGetValue("ProUsbPort", out var portStr)
                   && byte.TryParse(portStr, out var port) ? port : (byte)1;

        // 1️⃣  Prefer an explicit value in appsettings.json / ExtendedSettings
        if (settings.Value.ExtendedSettings.TryGetValue("ProUsbHotelCode", out var codeStr)
            && int.TryParse(codeStr, out var configured) && configured != 0)
        {
            _hotelCode = configured;
            _logger.LogInformation("ProUsb: using configured hotel code {Code}.", _hotelCode);
            return;
        }

        // 2️⃣  Auto-discover from the vendor's System.ini on this machine
        var discovered = ProUsbHotelCodeDiscovery.TryDiscover(logger);
        if (discovered.HasValue)
        {
            _hotelCode = discovered.Value;
            return;
        }

        // 3️⃣  Nothing found — log a clear warning and leave as 0
        _hotelCode = 0;
        _logger.LogWarning(
            "ProUsb: dlsCoID could not be found automatically and is not set in appsettings.json. " +
            "Card encoding will fail at the door until ProUsbHotelCode is configured. " +
            "Read dlsCoID from C:\\<CardLock install>\\System.ini and add it to AgentSettings.ExtendedSettings.");
    }

    public string VendorName => "ProUSB";

    // ── Lifecycle ────────────────────────────────────────────────────────────

    private void EnsureInitialized()
    {
        if (_initialized) return;

        _logger.LogInformation("Initializing proRFL USB encoder (port {Port})…", _usbPort);
        int res = ProUsbLockSdkNative.initializeUSB(_usbPort);
        if (res == (int)ProUsbLockSdkNative.ProUsbError.Success)
        {
            var ver = new StringBuilder(64);
            ProUsbLockSdkNative.GetDLLVersion(ver);
            _logger.LogInformation("proRFL initialized. DLL version: {Ver}", ver.ToString());
        }
        else
        {
            _logger.LogWarning("proRFL initializeUSB returned {Code}. Proceeding anyway.", res);
        }

        _initialized = true;
    }

    // ── ILockProvider ────────────────────────────────────────────────────────

    public async Task<bool> WaitForCardAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Waiting for card on proUSB encoder…");
        EnsureInitialized();

        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (cancellationToken.IsCancellationRequested) return false;

            var buf = new StringBuilder(256);
            int res = ProUsbLockSdkNative.ReadCard(_usbPort, buf);
            if (res == (int)ProUsbLockSdkNative.ProUsbError.Success && buf.Length > 0)
            {
                _logger.LogInformation("Card detected by proUSB encoder.");
                return true;
            }

            await Task.Delay(500, cancellationToken);
        }

        return false;
    }

    public async Task<LockResult> EncodeCardAsync(
        string lockCode,
        DateTime checkInDate,
        DateTime checkOutDate,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Encoding proUSB guest card — room {LockCode}, {In} → {Out}",
            lockCode, checkInDate, checkOutDate);

        EnsureInitialized();

        string bDate = checkInDate.ToString(DateFormat);
        string eDate = checkOutDate.ToString(DateFormat);
        var cardHex = new StringBuilder(256);

        // cardNo / dai: for a single-card issue, both can be 0.
        // A real implementation would track and increment dai per room per stay.
        int res = ProUsbLockSdkNative.GuestCard(
            fUSB:       _usbPort,
            dlsCoID:    _hotelCode,
            cardNo:     0,
            dai:        0,
            lLock:      0,   // normal deadbolt behaviour
            pDoors:     0,   // room-only (no public door access)
            bDate:      bDate,
            eDate:      eDate,
            roomNo:     lockCode,
            cardHexStr: cardHex);

        if (res == (int)ProUsbLockSdkNative.ProUsbError.Success)
        {
            // Beep to confirm the card was written
            ProUsbLockSdkNative.Buzzer(_usbPort, 100);
            _logger.LogInformation("proUSB card encoded. Hex: {Hex}", cardHex.ToString());
            return LockResult.Ok(VendorName);
        }

        _logger.LogError("proUSB GuestCard failed with code {Code}", res);
        return LockResult.Fail(res.ToString(), $"proUSB SDK error code: {res}", VendorName);
    }

    public async Task<LockResult> EncodeMasterCardAsync(
        DateTime? startDate,
        DateTime? endDate,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Encoding proUSB master card…");
        EnsureInitialized();

        string bDate = (startDate ?? DateTime.Now).ToString(DateFormat);
        string eDate = (endDate   ?? DateTime.Now.AddYears(1)).ToString(DateFormat);
        var cardHex = new StringBuilder(256);

        int res = ProUsbLockSdkNative.MasterCard(
            fUSB:       _usbPort,
            dlsCoID:    _hotelCode,
            cardNo:     0,
            dai:        0,
            lLock:      0,
            pDoors:     255,  // all public doors
            bDate:      bDate,
            eDate:      eDate,
            cardHexStr: cardHex);

        if (res == (int)ProUsbLockSdkNative.ProUsbError.Success)
        {
            ProUsbLockSdkNative.Buzzer(_usbPort, 100);
            _logger.LogInformation("proUSB master card encoded.");
            return LockResult.Ok(VendorName);
        }

        _logger.LogError("proUSB MasterCard failed with code {Code}", res);
        return LockResult.Fail(res.ToString(), $"proUSB master-card error: {res}", VendorName);
    }

    public async Task<ReadCardResult> ReadCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Reading card from proUSB encoder…");
        EnsureInitialized();

        var rawBuf  = new StringBuilder(256);
        int res = ProUsbLockSdkNative.ReadCard(_usbPort, rawBuf);

        if (res != (int)ProUsbLockSdkNative.ProUsbError.Success)
        {
            if (res == (int)ProUsbLockSdkNative.ProUsbError.NoCard)
                return ReadCardResult.Blank(VendorName);

            _logger.LogError("proUSB ReadCard error {Code}", res);
            return ReadCardResult.Fail(res.ToString(), $"proUSB ReadCard error: {res}", VendorName);
        }

        string cardHex = rawBuf.ToString().TrimEnd('\0');
        if (string.IsNullOrWhiteSpace(cardHex))
            return ReadCardResult.Blank(VendorName);

        // Decode the card fields from the hex blob
        var roomBuf  = new StringBuilder(32);
        var sBuf     = new StringBuilder(32);
        var eBuf     = new StringBuilder(32);

        ProUsbLockSdkNative.GetGuestLockNoByCardDataStr(cardHex, roomBuf);
        ProUsbLockSdkNative.GetGuestSTimeByCardDataStr(cardHex, sBuf);
        ProUsbLockSdkNative.GetGuestETimeByCardDataStr(cardHex, eBuf);

        string roomNo  = roomBuf.ToString().TrimEnd('\0');
        string sTime   = sBuf.ToString().TrimEnd('\0');
        string eTime   = eBuf.ToString().TrimEnd('\0');

        if (string.IsNullOrWhiteSpace(roomNo))
            return ReadCardResult.Blank(VendorName);

        _logger.LogInformation(
            "Card read: Room={Room}, From={S}, To={E}", roomNo, sTime, eTime);

        // Attempt to parse the "YYMMDDHHMM" strings back to ISO for the PMS
        string? cin  = TryParseProUsbDate(sTime)?.ToString("yyyy-MM-dd HH:mm:ss");
        string? cout = TryParseProUsbDate(eTime)?.ToString("yyyy-MM-dd HH:mm:ss");

        return ReadCardResult.WithData(roomNo, cardHex, cin, cout, VendorName);
    }

    public async Task<DiagnosticResult> ReadDiagnosticAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Running proUSB diagnostic read…");
        EnsureInitialized();

        var buf = new StringBuilder(256);
        int res = ProUsbLockSdkNative.ReadCard(_usbPort, buf);

        if (res == (int)ProUsbLockSdkNative.ProUsbError.Success)
        {
            return new DiagnosticResult
            {
                Success      = true,
                RawDataHex   = buf.ToString(),
                DiscoveredCoID = _hotelCode,
                Vendor       = VendorName
            };
        }

        return new DiagnosticResult
        {
            Success      = false,
            ErrorMessage = $"proUSB ReadCard error: {res}",
            Vendor       = VendorName
        };
    }

    public async Task<LockResult> CancelCardAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Erasing card on proUSB encoder…");
        EnsureInitialized();

        var cardHex = new StringBuilder(256);
        int res = ProUsbLockSdkNative.CardErase(_usbPort, _hotelCode, cardHex);

        if (res == (int)ProUsbLockSdkNative.ProUsbError.Success)
        {
            _logger.LogInformation("proUSB card erased successfully.");
            return LockResult.Ok(VendorName);
        }

        _logger.LogError("proUSB CardErase failed with code {Code}", res);
        return LockResult.Fail(res.ToString(), $"proUSB erase error: {res}", VendorName);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static DateTime? TryParseProUsbDate(string raw)
    {
        // Format returned by the DLL can be "YYMMDDHHMM"
        if (DateTime.TryParseExact(raw, "yyMMddHHmm",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var dt))
        {
            return dt;
        }

        // Fallback: some builds return "YYYY-MM-DD HH:MM"
        if (DateTime.TryParse(raw, out var dt2)) return dt2;

        return null;
    }
}

/// <summary>
/// Searches common CardLock / proUSB install locations on this Windows machine
/// for a System.ini file and reads the dlsCoID value from it.
/// </summary>
internal static class ProUsbHotelCodeDiscovery
{
    // Known install directories, ordered from most to least common.
    private static readonly string[] CandidateDirs =
    [
        @"C:\Program Files\CardLock",
        @"C:\Program Files (x86)\CardLock",
        @"C:\CardLock",
        @"C:\Program Files\proUSB",
        @"C:\Program Files (x86)\proUSB",
        @"C:\proUSB",
        @"C:\Program Files\Card Lock Management System",
        @"C:\Program Files (x86)\Card Lock Management System",
        // Also check the drive root in case the hotel installed somewhere custom
        @"D:\CardLock",
        @"D:\proUSB",
    ];

    public static int? TryDiscover(ILogger logger)
    {
        // Search well-known install directories
        foreach (var dir in CandidateDirs)
        {
            var result = TryReadFromDir(dir, logger);
            if (result.HasValue) return result;
        }

        // Broader fallback: search every Program Files / drive root for System.ini
        // that contains a [SYSTEM] section with dlsCoID
        var broadResult = BroadSearch(logger);
        if (broadResult.HasValue) return broadResult;

        return null;
    }

    private static int? TryReadFromDir(string dir, ILogger logger)
    {
        if (!Directory.Exists(dir)) return null;

        // The ini is sometimes one level deeper (e.g. CardLock\app\System.ini)
        var candidates = new[]
        {
            Path.Combine(dir, "System.ini"),
            Path.Combine(dir, "app",      "System.ini"),
            Path.Combine(dir, "CardLock", "System.ini"),
        };

        foreach (var iniPath in candidates)
        {
            var code = ReadCoID(iniPath, logger);
            if (code.HasValue) return code;
        }

        return null;
    }

    private static int? BroadSearch(ILogger logger)
    {
        // Check Program Files folders on all fixed drives
        var roots = DriveInfo.GetDrives()
            .Where(d => d.DriveType == DriveType.Fixed && d.IsReady)
            .SelectMany(d => new[]
            {
                Path.Combine(d.RootDirectory.FullName, "Program Files"),
                Path.Combine(d.RootDirectory.FullName, "Program Files (x86)"),
                d.RootDirectory.FullName,
            })
            .Where(Directory.Exists);

        foreach (var root in roots)
        {
            try
            {
                // Only go one level deep to avoid scanning the whole drive
                foreach (var subDir in Directory.GetDirectories(root))
                {
                    var code = TryReadFromDir(subDir, logger);
                    if (code.HasValue) return code;
                }
            }
            catch (UnauthorizedAccessException) { /* skip protected folders */ }
        }

        return null;
    }

    private static int? ReadCoID(string iniPath, ILogger logger)
    {
        if (!File.Exists(iniPath)) return null;

        try
        {
            bool inSystemSection = false;

            foreach (var line in File.ReadLines(iniPath))
            {
                var trimmed = line.Trim();

                // Track which INI section we're in
                if (trimmed.StartsWith('['))
                {
                    inSystemSection = trimmed.Equals("[SYSTEM]", StringComparison.OrdinalIgnoreCase);
                    continue;
                }

                if (!inSystemSection) continue;

                // Match: dlsCoID = 12345   (case-insensitive, spaces around '=' optional)
                if (trimmed.StartsWith("dlsCoID", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = trimmed.Split('=', 2);
                    if (parts.Length == 2
                        && int.TryParse(parts[1].Trim(), out var code)
                        && code != 0)
                    {
                        logger.LogInformation(
                            "ProUsb auto-discovery: found dlsCoID={Code} in {Path}",
                            code, iniPath);
                        return code;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug("ProUsb auto-discovery: could not read {Path}: {Msg}", iniPath, ex.Message);
        }

        return null;
    }
}
