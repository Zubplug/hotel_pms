using System.Runtime.InteropServices;
using System.Text;

namespace LodgeCore.HardwareAgent.Locks;

/// <summary>
/// P/Invoke wrappers for proRFL.dll — the ACS Hotel / Q508 proUSB card-lock encoder SDK.
/// DLL Architecture: 32-bit (x86) stdcall.
/// This project MUST be compiled as x86 (or use a 32-bit subprocess bridge) to load this DLL.
///
/// Key parameters shared by most functions:
///   fUSB    – USB port index. Use 1 for a single encoder (rarely 0).
///   dlsCoID – Hotel Code assigned when the lock system is first set up.
///             Read from the vendor app's System.ini [SYSTEM] dlsCoID key,
///             or from the CardLock.mdb database. Stored in AgentSettings.
///
/// Date/time string format: "YYMMDDHHMM"  (e.g. "2610271400" = 27-Oct-2026 14:00)
/// </summary>
internal static class ProUsbLockSdkNative
{
    private const string DllName = "proRFL.dll";

    // ── Error / return codes ─────────────────────────────────────────────────
    public enum ProUsbError
    {
        Success      = 1,
        Fail         = 0,
        NoCard       = -1,
        NoDevice     = -2,
        WriteError   = -3,
        ReadError    = -4,
    }

    // ── Device ───────────────────────────────────────────────────────────────

    /// <summary>Opens the USB encoder. Must be called before any card operation.</summary>
    /// <param name="fUSB">USB port index (normally 1).</param>
    /// <returns>1 = success, negative = error.</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int initializeUSB(byte fUSB);

    /// <summary>Closes the USB encoder handle.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int CloseUSB(byte fUSB);

    /// <summary>Triggers the encoder's beeper for <paramref name="ms"/> milliseconds.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int Buzzer(byte fUSB, int ms);

    /// <summary>Returns the DLL version string into <paramref name="version"/>.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GetDLLVersion(StringBuilder version);

    // ── Card read ────────────────────────────────────────────────────────────

    /// <summary>
    /// Reads raw card data into <paramref name="buffer"/>.
    /// The buffer receives a hex string; use the GetGuest* helpers to decode it.
    /// </summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int ReadCard(byte fUSB, StringBuilder buffer);

    /// <summary>Returns the card type from a raw card-data hex string.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GetCardTypeByCardDataStr(string cardHexStr, StringBuilder cardType);

    /// <summary>Returns the lock/room number from a raw card-data hex string.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GetGuestLockNoByCardDataStr(string cardHexStr, StringBuilder lockNo);

    /// <summary>Returns the check-in date-time string from a raw card-data hex string.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GetGuestSTimeByCardDataStr(string cardHexStr, StringBuilder sTime);

    /// <summary>Returns the check-out date-time string from a raw card-data hex string.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GetGuestETimeByCardDataStr(string cardHexStr, StringBuilder eTime);

    // ── Guest card write ─────────────────────────────────────────────────────

    /// <summary>
    /// Encodes a guest key card.
    /// </summary>
    /// <param name="fUSB">USB port index.</param>
    /// <param name="dlsCoID">Hotel code.</param>
    /// <param name="cardNo">Card sequence number 0-15 (increment when issuing a second card for the same room in the same minute).</param>
    /// <param name="dai">Guest counter / generation byte (0-255). Increment each new check-in to invalidate old cards.</param>
    /// <param name="lLock">Deadbolt flag: 0 = normal, 1 = override deadbolt.</param>
    /// <param name="pDoors">Public-door bitmask (e.g. gym, pool gate). 0 = room only.</param>
    /// <param name="bDate">Check-in date-time as "YYMMDDHHMM".</param>
    /// <param name="eDate">Check-out date-time as "YYMMDDHHMM".</param>
    /// <param name="roomNo">Room / lock number string (e.g. "101" or "001.002.028").</param>
    /// <param name="cardHexStr">Output: hex string written to the card (for logging / cancellation).</param>
    /// <returns>1 = success.</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GuestCard(
        byte fUSB,
        int dlsCoID,
        byte cardNo,
        byte dai,
        byte lLock,
        byte pDoors,
        string bDate,
        string eDate,
        string roomNo,
        StringBuilder cardHexStr);

    // ── Erase / cancel ───────────────────────────────────────────────────────

    /// <summary>Erases the card currently on the encoder (check-out / lost card).</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int CardErase(byte fUSB, int dlsCoID, StringBuilder cardHexStr);

    /// <summary>Check-out card: marks the card as checked out on the lock.</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int CheckOutCard(byte fUSB, int dlsCoID, StringBuilder cardHexStr);

    // ── Staff cards ──────────────────────────────────────────────────────────

    /// <summary>Encodes a master card (access to all rooms in the hotel).</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int MasterCard(
        byte fUSB,
        int dlsCoID,
        byte cardNo,
        byte dai,
        byte lLock,
        byte pDoors,
        string bDate,
        string eDate,
        StringBuilder cardHexStr);

    /// <summary>Encodes a floor card (access to all rooms on one floor).</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int FloorCard(
        byte fUSB,
        int dlsCoID,
        byte cardNo,
        byte dai,
        byte lLock,
        byte pDoors,
        string bDate,
        string eDate,
        string floorNo,
        StringBuilder cardHexStr);

    /// <summary>Encodes an emergency card (override all locks).</summary>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int EmergencyCard(
        byte fUSB,
        int dlsCoID,
        byte cardNo,
        byte dai,
        string bDate,
        string eDate,
        StringBuilder cardHexStr);
}
