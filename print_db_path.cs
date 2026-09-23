using System;
using System.IO;

class Program
{
    static void Main()
    {
        Console.WriteLine(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline.db"));
    }
}
