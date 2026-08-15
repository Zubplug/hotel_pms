using System;
using System.Globalization;

class Program
{
    static void Main()
    {
        string s = "2026-08-22T12:00:00";
        bool success = DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var d);
        Console.WriteLine($"Success: {success}");
        Console.WriteLine($"Date: {d.ToString("yyyy-MM-dd HH:mm:ss")}");
    }
}
