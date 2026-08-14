using System.Runtime.InteropServices;
using System.Text;

namespace LodgeCore.HardwareAgent.Native;

/// <summary>
/// Contains exact 32-bit P/Invoke definitions for the Deluns proRFL.dll Lock Management System
/// </summary>
internal static class NativeSdkBridge
{
    private const string DllName = "proRFL.dll";

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall)]
    public static extern int initializeUSB(byte fUSB);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall)]
    public static extern int Buzzer(byte fUSB, int duration);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int ReadCard(byte fUSB, byte[] buffer);

    [DllImport(DllName, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int GuestCard(byte fUSB, int dlsCoID, byte cardNo, byte dai, 
                                       byte llock, byte pdoors, string bDate, 
                                       string eDate, string roomNo, string cardHexStr);
}

