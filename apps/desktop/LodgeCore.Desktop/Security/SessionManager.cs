using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using System.Security.Cryptography;
using System.Text;

namespace LodgeCore.Desktop.Security;

public class SessionManager
{
    private const string DeviceIdKey = "LodgeCore_DeviceId";
    private readonly LocalDbContext _dbContext;

    public SessionManager(LocalDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Authenticates a POS operator using their PIN, establishes a trusted local context, 
    /// and persists it to SQLite so it survives offline restarts.
    /// </summary>
    public async Task<LocalOperatorContext> AuthenticateOperatorAsync(string staffId, string pin)
    {
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId && s.IsActive && s.HasPosAccess);
        if (staff == null)
            throw new Exception("Staff member not found or inactive.");

        // Simple Hash check (in production, use bcrypt/argon2 if not already done)
        if (!VerifyPin(pin, staff.PosPinHash))
            throw new Exception("Invalid PIN.");

        // Find the device and outlet (assuming single device context for the desktop app)
        var property = await _dbContext.Properties.FirstOrDefaultAsync();
        if (property == null)
            throw new Exception("Device is not configured to a property.");

        // We assume the device is tied to an outlet. For now, fetch the first active outlet
        var outlet = await _dbContext.PosOutlets.FirstOrDefaultAsync(o => o.PropertyId == property.Id && o.IsActive);
        if (outlet == null)
            throw new Exception("No active POS outlet found for this property.");

        // Fetch device ID ahead of LINQ query to avoid expression tree await error
        var deviceId = await Microsoft.Maui.Storage.SecureStorage.Default.GetAsync(DeviceIdKey)
                       ?? throw new InvalidOperationException("This terminal has no device identity. Re-provision the desktop terminal before using POS.");

        // Find if there's an active POS session for this specific operator or terminal
        var activeSession = await FindBankingSessionAsync(property, staff, deviceId);

        // Invalidate previous contexts
        var oldContexts = await _dbContext.OperatorContexts.Where(c => c.IsActive).ToListAsync();
        foreach (var c in oldContexts)
        {
            c.IsActive = false;
        }

        // Create new trusted context
        var newContext = new LocalOperatorContext
        {
            Id = Guid.NewGuid().ToString(),
            DeviceId = deviceId,
            PropertyId = property.Id,
            OutletId = outlet.Id,
            StaffId = staff.Id,
            SessionId = activeSession?.Id ?? string.Empty,
            OperatorTokenVersion = Guid.NewGuid().ToString(),
            AuthenticatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.MaxValue,
            IsActive = true
        };

        _dbContext.OperatorContexts.Add(newContext);
        await _dbContext.SaveChangesAsync();

        return newContext;
    }

    public async Task<LocalOperatorContext> EstablishOperatorContextAsync(string staffId)
    {
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId && s.IsActive && s.HasPosAccess);
        if (staff == null)
            throw new Exception("Staff member not found or inactive.");

        var property = await _dbContext.Properties.FirstOrDefaultAsync();
        if (property == null)
            throw new Exception("Device is not configured to a property.");

        var outlet = await _dbContext.PosOutlets.FirstOrDefaultAsync(o => o.PropertyId == property.Id && o.IsActive);
        if (outlet == null)
            throw new Exception("No active POS outlet found for this property.");

        var deviceId = await Microsoft.Maui.Storage.SecureStorage.Default.GetAsync(DeviceIdKey)
                       ?? throw new InvalidOperationException("This terminal has no device identity. Re-provision the desktop terminal before using POS.");
        var activeSession = await FindBankingSessionAsync(property, staff, deviceId);

        var oldContexts = await _dbContext.OperatorContexts.Where(c => c.IsActive).ToListAsync();
        foreach (var context in oldContexts)
            context.IsActive = false;

        var newContext = new LocalOperatorContext
        {
            Id = Guid.NewGuid().ToString(),
            DeviceId = deviceId,
            PropertyId = property.Id,
            OutletId = outlet.Id,
            StaffId = staff.Id,
            SessionId = activeSession?.Id ?? string.Empty,
            OperatorTokenVersion = Guid.NewGuid().ToString(),
            AuthenticatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.MaxValue,
            IsActive = true
        };

        _dbContext.OperatorContexts.Add(newContext);
        await _dbContext.SaveChangesAsync();
        return newContext;
    }

    /// <summary>
    /// Retrieves the current trusted operator context independently of React IPC payload.
    /// </summary>
    public async Task<LocalOperatorContext> GetActiveContextAsync()
    {
        var context = await _dbContext.OperatorContexts
            .FirstOrDefaultAsync(c => c.IsActive);

        if (context == null)
            throw new UnauthorizedAccessException("No active operator session found on this terminal.");

        // Check if POS Session changed
        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == context.PropertyId);
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == context.StaffId);
        var activePosSession = property != null && staff != null
            ? await FindBankingSessionAsync(property, staff, context.DeviceId)
            : null;
            
        if (activePosSession != null && context.SessionId != activePosSession.Id)
        {
            context.SessionId = activePosSession.Id;
            await _dbContext.SaveChangesAsync();
        }

        return context;
    }

    private async Task<LocalPosSession?> FindBankingSessionAsync(LocalProperty property, LocalStaff staff, string deviceId)
    {
        var query = _dbContext.PosSessions
            .Where(s => s.PropertyId == property.Id && s.Status == PosConstants.SessionStatus.Open);

        if (string.Equals(property.BankingModel, PosConstants.BankingModels.ServerBanking, StringComparison.OrdinalIgnoreCase))
        {
            return await query
                .Where(s => s.UserId == staff.Id || s.PrimaryOperatorId == staff.Id || s.StaffId == staff.Id)
                .OrderByDescending(s => s.OpenedAt)
                .FirstOrDefaultAsync();
        }

        if (string.Equals(staff.Role, "WAITER", StringComparison.OrdinalIgnoreCase)) return null;

        return await query
            .Where(s => s.DeviceId == deviceId)
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync();
    }
    
    public async Task LogoutAsync()
    {
        var context = await _dbContext.OperatorContexts.FirstOrDefaultAsync(c => c.IsActive);
        if (context != null)
        {
            context.IsActive = false;
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task KeepAliveAsync()
    {
        await Task.CompletedTask;
    }

    /// <summary>
    /// Clears the active operator session — called after settlement or explicit logout.
    /// Forces a fresh PIN authentication before the next shift begins.
    /// </summary>
    public async Task ClearOperatorSessionAsync()
    {
        var contexts = await _dbContext.OperatorContexts.Where(c => c.IsActive).ToListAsync();
        foreach (var c in contexts)
        {
            c.IsActive = false;
            c.ExpiresAt = DateTime.UtcNow; // Immediately expire
        }
        await _dbContext.SaveChangesAsync();
    }

    private bool VerifyPin(string pin, string hash)
    {
        if (string.IsNullOrEmpty(hash)) return false;
        
        try
        {
            return BCrypt.Net.BCrypt.Verify(pin, hash);
        }
        catch
        {
            return false; // In case hash is somehow invalid BCrypt format
        }
    }
}
