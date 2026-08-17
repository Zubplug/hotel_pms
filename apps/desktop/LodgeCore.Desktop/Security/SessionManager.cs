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

        // Find if there's an active POS session for this outlet
        var activeSession = await _dbContext.PosSessions
            .Where(s => s.PropertyId == property.Id && s.Status == "OPEN")
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync();

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
            DeviceId = await Microsoft.Maui.Storage.SecureStorage.Default.GetAsync("DEVICE_ID") ?? "UNKNOWN_DEVICE",
            PropertyId = property.Id,
            OutletId = outlet.Id,
            StaffId = staff.Id,
            SessionId = activeSession?.Id ?? string.Empty,
            OperatorTokenVersion = Guid.NewGuid().ToString(),
            AuthenticatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(12),
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
            .FirstOrDefaultAsync(c => c.IsActive && c.ExpiresAt > DateTime.UtcNow);

        if (context == null)
            throw new UnauthorizedAccessException("No active operator session found on this terminal.");

        // Check if POS Session changed
        var activePosSession = await _dbContext.PosSessions
            .Where(s => s.PropertyId == context.PropertyId && s.Status == "OPEN")
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync();
            
        if (activePosSession != null && context.SessionId != activePosSession.Id)
        {
            context.SessionId = activePosSession.Id;
            await _dbContext.SaveChangesAsync();
        }

        return context;
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
        // Secure hash verification using SHA256
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(pin);
        var computedHash = Convert.ToBase64String(sha256.ComputeHash(bytes));
        
        // In production, PINs must be securely hashed and we strictly compare.
        // We assume the hash in DB matches the Base64 SHA256 of the PIN.
        return computedHash == hash;
    }
}
