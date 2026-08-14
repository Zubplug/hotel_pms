using System.Runtime.InteropServices;
using System.Text;

namespace LodgeCore.LockAgent.Hardware;

/// <summary>
/// Direct P/Invoke bindings to LockSDK.dll (Deluns eLock, V4.7, 32-bit __stdcall).
/// All signatures verified from LockSDK.h and VB6 mdlPort.bas (Elock_SDK_EN.rar).
/// 
/// IMPORTANT: This DLL is 32-bit. The host process must be compiled as x86.
/// </summary>
internal static class LockSdkNative
{
    private const string DllName = "LockSDK.dll";

    /// <summary>
    /// Initialize SDK hardware and select lock type.
    /// Must be called before any card operation.
    /// </summary>
    /// <param name="lockType">4 = RF57 series, 5 = RF50 series</param>
    /// <returns>1 = success; see <see cref="LockSdkError"/> for negative codes</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_Configuration(int lockType);

    /// <summary>
    /// Encode a guest access card (V4.7 extended version with waitMs).
    /// </summary>
    /// <param name="cardSnr">OUT — card serial number. Pre-allocate StringBuilder(20).</param>
    /// <param name="roomNo">Room number string, e.g. "1.2.8102"</param>
    /// <param name="checkinTime">Check-in datetime "YYYY-MM-DD hh:mm:ss". Empty = current time.</param>
    /// <param name="checkoutTime">Check-out datetime "YYYY-MM-DD hh:mm:ss"</param>
    /// <param name="iFlags">
    ///   0 = normal guest card (overwrites prior card);
    ///   8 = re-issue (explicitly invalidates all prior cards for room);
    ///   1 = master card; 32 = one-time card; 128 = extend-stay card.
    ///   Values can be combined.
    /// </param>
    /// <param name="waitMs">Milliseconds to wait for card on encoder (e.g. 10000)</param>
    /// <returns>1 = success</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_MakeGuestCardEx2(
        StringBuilder cardSnr,
        string roomNo,
        string checkinTime,
        string checkoutTime,
        int iFlags,
        int waitMs);

    /// <summary>
    /// Read guest card data from a card on the encoder.
    /// </summary>
    /// <param name="cardSnr">OUT — card serial number. Pre-allocate StringBuilder(20).</param>
    /// <param name="roomNo">OUT — room number. Pre-allocate StringBuilder(20).</param>
    /// <param name="checkinTime">OUT — check-in time. Pre-allocate StringBuilder(30).</param>
    /// <param name="checkoutTime">OUT — check-out time. Pre-allocate StringBuilder(30).</param>
    /// <param name="iFlags">OUT — card flags byte</param>
    /// <param name="waitMs">Milliseconds to wait for card</param>
    /// <returns>1 = success</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_ReadGuestCardEx2(
        StringBuilder cardSnr,
        StringBuilder roomNo,
        StringBuilder checkinTime,
        StringBuilder checkoutTime,
        ref int iFlags,
        int waitMs);

    /// <summary>
    /// Write a cancellation record to a card (physical cancel — guest presents to lock).
    /// </summary>
    /// <param name="cardSnr">OUT — cancelled card serial number. Pre-allocate StringBuilder(20).</param>
    /// <param name="waitMs">Milliseconds to wait for card</param>
    /// <returns>1 = success</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_CancelCardEx2(
        StringBuilder cardSnr,
        int waitMs);

    /// <summary>
    /// Read the serial number of a card currently on the encoder (non-destructive).
    /// Used as a connectivity/encoder-present check (PING).
    /// </summary>
    /// <param name="cardSnr">OUT — card SNR. Pre-allocate StringBuilder(20).</param>
    /// <returns>1 = card present; -1 = no card; -2 = no encoder</returns>
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_GetCardSnr(StringBuilder cardSnr);
}

/// <summary>
/// LockSDK return codes from LockSDK.h (enum ERROR_TYPE).
/// </summary>
public enum LockSdkError : int
{
    OPR_OK            =  1,   // Success
    NO_CARD           = -1,   // No card on encoder
    NO_RW_MACHINE     = -2,   // No encoder detected
    INVALID_CARD      = -3,   // Card is invalid
    CARD_TYPE_ERROR   = -4,   // Wrong card type
    RDWR_ERROR        = -5,   // Read/write error
    PORT_NOT_OPEN     = -6,   // COM port not open
    END_OF_DATA_CARD  = -7,   // Database card exhausted
    INVALID_PARAMETER = -8,   // Invalid parameter passed
    INVALID_OPR       = -9,   // Invalid operation
    OTHER_ERROR       = -10,  // Other error
    PORT_IN_USED      = -11,  // COM port already in use
    COMM_ERROR        = -12,  // Communication error
    ERR_CLIENT        = -20,  // Client error
    ERR_NOT_REGISTERED= -29,  // SDK not registered (check .lic file)
    ERR_NO_CLIENT_DATA= -30,  // No authorization data
    ERR_ROOMS_CNT_OVER= -31,  // Room count limit exceeded
}
