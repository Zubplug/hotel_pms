using System.Runtime.InteropServices;
using System.Text;

namespace LodgeCore.LockAgent.Hardware;

/// <summary>
/// P/Invoke wrappers for HS LockSDK.dll V4.7.
/// </summary>
internal static class HsLockSdkNative
{
    private const string DllName = "HsLockSDK.dll";

    public enum HsLockError
    {
        OPR_OK              = 1,      // Success
        NO_CARD             = -1,     // No card detected
        NO_RW_MACHINE       = -2,     // No encoder/reader detected
        INVALID_CARD        = -3,     // Invalid card
        CARD_TYPE_ERROR     = -4,     // Wrong card type
        RDWR_ERROR          = -5,     // Read/write error
        PORT_NOT_OPEN       = -6,     // COM port not open
        END_OF_DATA_CARD    = -7,     // Empty data
        INVALID_PARAMETER   = -8,     // Invalid parameter
        INVALID_OPR         = -9,     // Invalid operation
        OTHER_ERROR         = -10,    // Other error
        PORT_IN_USED        = -11,    // Port in use
        COMM_ERROR          = -12,    // Comm error
        ERR_CLIENT          = -20,    
        ERR_NOT_REGISTERED  = -29,    
        ERR_NO_CLIENT_DATA  = -30,    
        ERR_ROOMS_CNT_OVER  = -31     
    }

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_Configuration(int lock_type);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_MakeGuestCardEx(
        StringBuilder card_snr, 
        string room_no, 
        string checkin_time,
        string checkout_time, 
        int iflags);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_ReadGuestCardEx(
        StringBuilder card_snr,
        StringBuilder room_no, 
        StringBuilder checkin_time, 
        StringBuilder checkout_time, 
        ref int iFlags);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_CancelCard(StringBuilder card_snr);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int TP_GetCardSnr(StringBuilder card_snr);
}
