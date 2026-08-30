using System.Runtime.InteropServices;
using System.Text;

namespace LodgeCore.HardwareAgent.Locks;

/// <summary>
/// P/Invoke wrappers for RFV2016 Lock SDK (RFV2007NETHOTEL.dll).
/// </summary>
internal static class Rfv2016LockSdkNative
{
    private const string DllName = "RFV2007NETHOTEL.dll";

    // function W_Card(nRoom,Wstartdate,Wenddate,Op,nCode,jLift):Integer;
    // nRoom: string type, room number
    // Wstartdate: string type, opening card activation time, format yyyymmddhhmm, such as 200901010830
    // Wenddate: string type, door opening deadline, format yyyymmddhhmm, such as 200912301200
    // Op: string type, operator
    // nCode: Integer, 1 to use the new business card, 0 to use co-living business card
    // jLift: string type, elevator parameters. 0 if no elevator.
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int W_Card(
        string nRoom,
        string Wstartdate,
        string Wenddate,
        string Op,
        int nCode,
        string jLift);

    // function R_Card(i_display:integer):pchar;
    // i_display: integer, please set to a fixed value of 1
    // Return value is string pointer.
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern IntPtr R_Card(int i_display);

    // function R_CardID(i_display:integer):pchar;
    // i_display: integer, please set to a fixed value of 1
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern IntPtr R_CardID(int i_display);

    // function Woff_Card(I):integer; // actually wait, doc says "Woff_Card is a card cancellation function without parameters" but signature says Woff_Card(I). I'll pass 0.
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int Woff_Card(int i);

    // function Getcardid(IntnPort:pchar):pchar;
    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern IntPtr Getcardid(string IntnPort);

    public enum RfvError
    {
        SUCCESS = 1,
        COMM_ERROR = 0,
        DATA_DECRYPT_ERROR = 51,
        BAD_START_DATE = 70,
        BAD_END_DATE = 71,
        DB_CONNECT_FAIL = 72,
        NO_ROOM = 73,
        UNPLUG_SETTER = 74,
        NO_CARD = 75,
        DATA_LEN_MISMATCH = 76,
        READ_DATA_ERR = 77,
        KEY_COMPARE_ERR = 78,
        NO_CARD_INFO = 80
    }
}
