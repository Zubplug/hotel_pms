using System;
using System.Globalization;

class Program
{
    static void Main()
    {
        System.Threading.Thread.CurrentThread.CurrentCulture = new CultureInfo("en-GB");
        DateTime d;
        bool success = DateTime.TryParse("2026-08-15 12:00:00", out d);
        Console.WriteLine(success ? d.ToString("yyyy-MM-dd HH:mm:ss") : "FAILED");
    }
}
