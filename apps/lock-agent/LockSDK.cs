using System.Runtime.InteropServices;
using System.Text;

namespace LodgeCore.LockAgent
{
    public static class LockSDK
    {
        private const string DllName = "LockSDK.dll";

        [DllImport(DllName, CallingConvention = CallingConvention.StdCall)]
        public static extern int TP_Configuration(int lock_type);

        [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
        public static extern int TP_MakeGuestCardEx2(
            StringBuilder card_snr,
            string room_no,
            string checkin_time,
            string checkout_time,
            int iflags,
            int waitMs);

        [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
        public static extern int TP_ReadGuestCardEx2(
            StringBuilder card_snr,
            StringBuilder room_no,
            StringBuilder checkin_time,
            StringBuilder checkout_time,
            out int iflags,
            int waitMs);

        [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
        public static extern int TP_CancelCardEx2(
            StringBuilder card_snr,
            int waitMs);
            
        // Helper to interpret errors based on the SDK header
        public static string GetErrorMessage(int errorCode)
        {
            return errorCode switch
            {
                1 => "OPR_OK",
                -1 => "NO_CARD (No card detected)",
                -2 => "NO_RW_MACHINE (Encoder not detected)",
                -3 => "INVALID_CARD (Card is invalid/broken)",
                -4 => "CARD_TYPE_ERROR (Wrong card type)",
                -5 => "RDWR_ERROR (Read/Write Error)",
                -6 => "PORT_NOT_OPEN",
                -8 => "INVALID_PARAMETER",
                -10 => "OTHER_ERROR",
                -11 => "PORT_IN_USED",
                -12 => "COMM_ERROR (Communication Error)",
                -20 => "ERR_CLIENT (Client code error)",
                _ => $"UNKNOWN_ERROR ({errorCode})"
            };
        }
    }
}
