using System;
using System.Runtime.InteropServices;

namespace LodgeCore.Desktop.Services
{
    public static class RawPrinterHelper
    {
#pragma warning disable CS8618
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
        }
#pragma warning restore CS8618

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        public static bool SendBytesToPrinter(string szPrinterName, byte[] data, out string errorMessage)
        {
            errorMessage = string.Empty;
            if (data == null || data.Length == 0)
            {
                errorMessage = "No data to print.";
                return false;
            }

            IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
            Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);

            bool success = SendBytesToPrinter(szPrinterName, pUnmanagedBytes, data.Length, out errorMessage);
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
            
            return success;
        }

        public static bool SendBytesToPrinter(string szPrinterName, IntPtr pBytes, int dwCount, out string errorMessage)
        {
            errorMessage = string.Empty;
            int dwWritten = 0;
            IntPtr hPrinter = new IntPtr(0);
            DOCINFOA di = new DOCINFOA();
            bool success = false;

            di.pDocName = "LodgeCore POS Document";
            di.pDataType = "RAW";

            if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                if (StartDocPrinter(hPrinter, 1, di))
                {
                    if (StartPagePrinter(hPrinter))
                    {
                        success = WritePrinter(hPrinter, pBytes, dwCount, out dwWritten);
                        if (!success) errorMessage = "WritePrinter failed (Win32 Error: " + Marshal.GetLastWin32Error() + ")";
                        EndPagePrinter(hPrinter);
                    }
                    else
                    {
                        errorMessage = "StartPagePrinter failed (Win32 Error: " + Marshal.GetLastWin32Error() + ")";
                    }
                    EndDocPrinter(hPrinter);
                }
                else
                {
                    errorMessage = "StartDocPrinter failed (Win32 Error: " + Marshal.GetLastWin32Error() + "). This usually means the RAW datatype is not supported by this printer driver.";
                }
                ClosePrinter(hPrinter);
            }
            else
            {
                errorMessage = "OpenPrinter failed (Win32 Error: " + Marshal.GetLastWin32Error() + "). Printer name might be invalid or access denied.";
            }

            return success;
        }
    }
}
