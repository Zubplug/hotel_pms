using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using LodgeCore.LockAgent.Auth;

namespace LodgeCore.LockAgent.Setup;

/// <summary>
/// Interactive CLI wizard for first-time agent enrollment.
/// Run with: LodgeCore.LockAgent.exe --enroll
/// 
/// Flow:
///   1. Prompt for PMS URL, enrollment token, device name, lock type, COM port
///   2. POST /api/v1/hardware/agent/enroll
///   3. Receive agentId + agentSecret
///   4. Store credentials in Windows Credential Manager (DPAPI)
///   5. Write non-sensitive config to agent.config.json
/// </summary>
public static class EnrollmentWizard
{
    public static async Task RunAsync()
    {
        Console.WriteLine();
        Console.WriteLine("╔══════════════════════════════════════════════╗");
        Console.WriteLine("║    LodgeCore Lock Agent — Enrollment Wizard  ║");
        Console.WriteLine("╚══════════════════════════════════════════════╝");
        Console.WriteLine();

        string pmsUrl     = Prompt("PMS URL",    "https://hotel-pms-web-nine.vercel.app");
        string token      = Prompt("Enrollment token (from PMS Settings → Hardware)");
        string deviceName = Prompt("Device name", $"LodgeCore-{Environment.MachineName}");
        string lockTypeStr= Prompt("Lock type (4=RF57 / 5=RF50)", "5");
        string comPort    = Prompt("COM port", "COM3");

        Console.WriteLine();
        Console.WriteLine("Enrolling with PMS...");

        var payload = new
        {
            enrollmentToken = token,
            deviceId        = Environment.MachineName.ToLowerInvariant(),
            name            = deviceName,
            agentVersion    = "1.0.0",
            sdkVersion      = "4.7",
            hostname        = Environment.MachineName,
            lockType        = lockTypeStr,
            comPort,
        };

        using var http = new HttpClient { BaseAddress = new Uri(pmsUrl) };

        HttpResponseMessage resp;
        try
        {
            resp = await http.PostAsJsonAsync("/api/v1/hardware/agent/enroll", payload);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Could not reach PMS: {ex.Message}");
            Environment.Exit(1);
            return;
        }

        var body = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
        {
            Console.WriteLine($"✗ Enrollment failed ({(int)resp.StatusCode}): {body}");
            Environment.Exit(1);
            return;
        }

        var result = JsonSerializer.Deserialize<EnrollResponse>(body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (result?.Data is null)
        {
            Console.WriteLine("✗ Unexpected response from PMS");
            Environment.Exit(1);
            return;
        }

        // Save secret to Windows Credential Manager
        var auth = new AgentAuthenticator(
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AgentAuthenticator>.Instance);
        bool saved = auth.Save(result.Data.AgentId, result.Data.AgentSecret);

        if (!saved)
        {
            Console.WriteLine("✗ Failed to save credentials to Windows Credential Manager");
            Console.WriteLine($"  agentId:     {result.Data.AgentId}");
            Console.WriteLine($"  agentSecret: {result.Data.AgentSecret}");
            Console.WriteLine("  Save these somewhere safe and re-run enrollment.");
            Environment.Exit(1);
            return;
        }

        // Write non-sensitive config
        var config = new AgentConfig
        {
            PmsUrl      = pmsUrl,
            PropertyId  = result.Data.PropertyId,
            DeviceId    = Environment.MachineName.ToLowerInvariant(),
            AgentName   = deviceName,
            SdkLockType = int.Parse(lockTypeStr),
            ComPort     = comPort,
        };
        config.Save();

        Console.WriteLine();
        Console.WriteLine($"✓ Agent registered: {deviceName}");
        Console.WriteLine($"✓ Agent ID: {result.Data.AgentId}");
        Console.WriteLine("✓ Credentials stored in Windows Credential Manager (DPAPI)");
        Console.WriteLine("✓ Configuration saved to agent.config.json");
        Console.WriteLine();
        Console.WriteLine("Install as Windows Service (run as Administrator):");
        Console.WriteLine($@"  sc create ""LodgeCoreLockAgent"" binPath= ""{AppContext.BaseDirectory}LodgeCore.LockAgent.exe"" start= auto DisplayName= ""LodgeCore Lock Agent""");
        Console.WriteLine(@"  sc description ""LodgeCoreLockAgent"" ""LodgeCore PMS hardware bridge for Deluns eLock""");
        Console.WriteLine(@"  sc start ""LodgeCoreLockAgent""");
        Console.WriteLine();
    }

    private static string Prompt(string label, string? defaultValue = null)
    {
        var hint = defaultValue is not null ? $" [{defaultValue}]" : "";
        Console.Write($"{label}{hint}: ");
        var input = Console.ReadLine()?.Trim();
        return string.IsNullOrEmpty(input) ? (defaultValue ?? string.Empty) : input;
    }

    private record EnrollResponseData(string AgentId, string AgentSecret, string PropertyId);
    private record EnrollResponse(EnrollResponseData? Data);
}
