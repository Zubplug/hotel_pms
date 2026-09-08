using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;

namespace LodgeCore.Desktop.Services
{
    public static class RawPrinterHelper
    {
        private const int PRINTER_ENUM_LOCAL = 0x00000002;
        private const int PRINTER_ENUM_CONNECTIONS = 0x00000004;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct PRINTER_INFO_4
        {
            public IntPtr pPrinterName;
            public IntPtr pServerName;
            public uint Attributes;
        }

        [DllImport("winspool.drv", EntryPoint = "EnumPrintersW", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool EnumPrinters(
            int flags,
            string? name,
            uint level,
            IntPtr printerInfo,
            uint printerInfoSize,
            out uint bytesNeeded,
            out uint printersReturned);

        /// <summary>
        /// Lists printers registered with the Windows Print Spooler, including
        /// USB printers installed through a vendor driver and shared printers.
        /// This is more reliable in a packaged desktop app than
        /// System.Drawing.Printing.PrinterSettings.InstalledPrinters.
        /// </summary>
        public static IReadOnlyList<string> GetInstalledPrinterNames()
        {
            var printers = new List<string>();
            if (!OperatingSystem.IsWindows()) return printers;

            const uint level = 4;
            var flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            EnumPrinters(flags, null, level, IntPtr.Zero, 0, out var bytesNeeded, out _);
            if (bytesNeeded == 0) return printers;

            var buffer = Marshal.AllocHGlobal((int)bytesNeeded);
            try
            {
                if (!EnumPrinters(flags, null, level, buffer, bytesNeeded, out _, out var returned))
                    return printers;

                var itemSize = Marshal.SizeOf<PRINTER_INFO_4>();
                for (var index = 0; index < returned; index++)
                {
                    var item = Marshal.PtrToStructure<PRINTER_INFO_4>(buffer + (index * itemSize));
                    var name = Marshal.PtrToStringUni(item.pPrinterName);
                    if (!string.IsNullOrWhiteSpace(name) && !printers.Contains(name, StringComparer.OrdinalIgnoreCase))
                        printers.Add(name);
                }
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }

            return printers;
        }

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
