using System;
using System.Text.Json;

class Program
{
    static void Main()
    {
        string json = "{\"creditLimit\": 0}";
        var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        
        if (root.TryGetProperty("creditLimit", out var cl))
        {
            try {
                Console.WriteLine(cl.GetString());
            } catch (Exception e) {
                Console.WriteLine("Error: " + e.Message);
            }
        }
    }
}
