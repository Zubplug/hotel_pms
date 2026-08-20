using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LodgeCore.Desktop.Services;

public class TerminalBootstrapService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ICredentialStorageService _credentialStorage;
    private readonly HttpClient _httpClient;

    public TerminalBootstrapService(
        IServiceProvider serviceProvider,
        ICredentialStorageService credentialStorage,
        HttpClient httpClient)
    {
        _serviceProvider = serviceProvider;
        _credentialStorage = credentialStorage;
        _httpClient = httpClient;
    }

    public async Task<object> GetTerminalStatusAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        var terminal = await context.PosTerminals.FirstOrDefaultAsync();

        if (terminal == null)
        {
            return new { registrationState = "UNREGISTERED" };
        }

        // Verify we actually have the secret
        var secret = _credentialStorage.LoadCredential("deviceCredential");
        if (string.IsNullOrEmpty(secret))
        {
        // Database says registered, but OS secret is missing!
        // Auto-heal: wipe the stale row so the terminal is treated as brand-new.
        context.PosTerminals.Remove(terminal);
        await context.SaveChangesAsync();
        return new { registrationState = "UNREGISTERED", error = "Credential was missing — terminal reset to factory state. Please re-provision." };
        }

        string? outletType = null;
        string desktopMode = "UNKNOWN";

        if (!string.IsNullOrEmpty(terminal.OutletId))
        {
            var outlet = await context.PosOutlets.FirstOrDefaultAsync(o => o.Id == terminal.OutletId);
            if (outlet != null)
            {
                outletType = outlet.Type;
                if (outletType == "FRONT_DESK")
                {
                    desktopMode = "FRONT_DESK";
                }
                else if (outletType == "RESTAURANT" || outletType == "BAR" || outletType == "POOL" || outletType == "ROOM_SERVICE")
                {
                    desktopMode = "POS";
                }
            }
        }

        return new
        {
            registrationState = terminal.RegistrationState,
            terminalId = terminal.Id,
            name = terminal.Name,
            licenseState = terminal.LicenseState,
            outletId = terminal.OutletId,
            outletType = outletType,
            desktopMode = desktopMode
        };
    }

    public async Task<object> ProvisionTerminalAsync(string email, string password, string propertyId, string outletId, string terminalName)
    {
        // 1. Call Cloud API
        var requestPayload = new
        {
            email,
            password,
            propertyId,
            outletId,
            terminalName,
            terminalType = "STATIONARY"
        };

        var response = await _httpClient.PostAsJsonAsync("pos/provision", requestPayload);
        
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Cloud provisioning failed: {error}");
        }

        var result = await response.Content.ReadFromJsonAsync<ProvisioningResponse>();
        if (result == null || !result.Success)
        {
            throw new Exception("Invalid response from provisioning API.");
        }

        // 2. Store Credential in DPAPI
        _credentialStorage.SaveCredential("deviceCredential", result.Data.DeviceCredential);

        // 3. Store Identity and Snapshot in SQLite
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        
        // Clear any old terminal data
        context.PosTerminals.RemoveRange(context.PosTerminals);
        
        var terminalInfo = result.Data.TerminalIdentity;
        
        var newTerminal = new LocalPosTerminal
        {
            Id = terminalInfo.Id,
            TerminalCode = terminalInfo.TerminalCode,
            Name = terminalInfo.Name,
            TerminalType = terminalInfo.TerminalType,
            OrganisationId = terminalInfo.OrganisationId,
            PropertyId = terminalInfo.PropertyId,
            OutletId = terminalInfo.OutletId,
            RegistrationState = terminalInfo.RegistrationState,
            LicenseState = terminalInfo.LicenseState,
            LicenseExpiresAt = terminalInfo.LicenseExpiresAt,
            ConfigurationVersion = terminalInfo.ConfigurationVersion,
            StaffVersion = terminalInfo.StaffVersion,
            MenuVersion = terminalInfo.MenuVersion,
            RegisteredAt = DateTime.UtcNow
        };

        context.PosTerminals.Add(newTerminal);
        
        // Optional: Save snapshot data (staff, menu, etc.) here
        // ...
        
        await context.SaveChangesAsync();

        return new { success = true, registrationState = newTerminal.RegistrationState };
    }
}

public class ProvisioningResponse
{
    public bool Success { get; set; }
    public ProvisioningData Data { get; set; } = new();
}

public class ProvisioningData
{
    public TerminalIdentity TerminalIdentity { get; set; } = new();
    public string DeviceCredential { get; set; } = string.Empty;
    public JsonElement Snapshot { get; set; }
}

public class TerminalIdentity
{
    public string Id { get; set; } = string.Empty;
    public string TerminalCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string TerminalType { get; set; } = string.Empty;
    public string OrganisationId { get; set; } = string.Empty;
    public string PropertyId { get; set; } = string.Empty;
    public string OutletId { get; set; } = string.Empty;
    public string RegistrationState { get; set; } = string.Empty;
    public string LicenseState { get; set; } = string.Empty;
    public DateTime? LicenseExpiresAt { get; set; }
    public int ConfigurationVersion { get; set; }
    public int StaffVersion { get; set; }
    public int MenuVersion { get; set; }
}
