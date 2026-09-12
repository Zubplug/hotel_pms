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
    public async Task<LocalOperatorContext> AuthenticateOperatorAsync(string staffId, string pin, string? preferredSessionId = null)
    {
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId && s.IsActive && s.HasPosAccess);
        if (staff == null)
            throw new Exception("Staff member not found or inactive.");

        // Simple Hash check (in production, use bcrypt/argon2 if not already done)
        if (!VerifyPin(pin, staff.PosPinHash))
            throw new Exception("Invalid PIN.");

        // The provisioned terminal is the source of truth for the POS scope.
        // Never fall back to the first property/outlet: that can attach a
        // restarted terminal to another outlet and make a valid shift appear
        // to be missing.
        var deviceId = await Microsoft.Maui.Storage.SecureStorage.Default.GetAsync(DeviceIdKey)
                       ?? throw new InvalidOperationException("This terminal has no device identity. Re-provision the desktop terminal before using POS.");
        var terminal = await _dbContext.PosTerminals.FirstOrDefaultAsync(t => t.Id == deviceId);
        if (terminal == null || string.IsNullOrWhiteSpace(terminal.PropertyId) || string.IsNullOrWhiteSpace(terminal.OutletId))
            throw new InvalidOperationException("This terminal is not fully configured. Re-provision the desktop terminal before using POS.");

        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == terminal.PropertyId);
        if (property == null)
            throw new Exception("Device is not configured to a property.");

        var outlet = await _dbContext.PosOutlets.FirstOrDefaultAsync(o =>
            o.Id == terminal.OutletId && o.PropertyId == property.Id && o.IsActive);
        if (outlet == null)
            throw new Exception("The provisioned POS outlet is unavailable. Re-provision the desktop terminal or activate its outlet.");

        // Find if there's an active POS session for this specific operator or terminal
        // Prefer the session ID retained by the desktop across restarts when
        // it is still an open session owned by this operator. This avoids
        // forcing a waiter to open a second shift after reopening offline.
        LocalPosSession? activeSession = null;
        if (!string.IsNullOrWhiteSpace(preferredSessionId))
        {
            var preferred = await _dbContext.PosSessions.FirstOrDefaultAsync(s =>
                s.Id == preferredSessionId &&
                s.PropertyId == property.Id &&
                s.OutletId == outlet.Id &&
                s.Status == PosConstants.SessionStatus.Open &&
                (s.PrimaryOperatorId == staff.Id || s.StaffId == staff.Id || s.UserId == staff.Id));
            activeSession = preferred;
        }
        activeSession ??= await FindBankingSessionAsync(property, staff, deviceId, outlet.Id);

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

        var deviceId = await Microsoft.Maui.Storage.SecureStorage.Default.GetAsync(DeviceIdKey)
                       ?? throw new InvalidOperationException("This terminal has no device identity. Re-provision the desktop terminal before using POS.");
        var terminal = await _dbContext.PosTerminals.FirstOrDefaultAsync(t => t.Id == deviceId);
        if (terminal == null || string.IsNullOrWhiteSpace(terminal.PropertyId) || string.IsNullOrWhiteSpace(terminal.OutletId))
            throw new InvalidOperationException("This terminal is not fully configured. Re-provision the desktop terminal before using POS.");

        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == terminal.PropertyId);
        if (property == null)
            throw new Exception("Device is not configured to a property.");

        var outlet = await _dbContext.PosOutlets.FirstOrDefaultAsync(o =>
            o.Id == terminal.OutletId && o.PropertyId == property.Id && o.IsActive);
        if (outlet == null)
            throw new Exception("The provisioned POS outlet is unavailable. Re-provision the desktop terminal or activate its outlet.");
        var activeSession = await FindBankingSessionAsync(property, staff, deviceId, outlet.Id);

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
            ? await FindBankingSessionAsync(property, staff, context.DeviceId, context.OutletId)
            : null;
            
        if (activePosSession != null && context.SessionId != activePosSession.Id)
        {
            context.SessionId = activePosSession.Id;
            await _dbContext.SaveChangesAsync();
        }

        return context;
    }

    private async Task<LocalPosSession?> FindBankingSessionAsync(LocalProperty property, LocalStaff staff, string deviceId, string outletId)
    {
        var query = _dbContext.PosSessions
            .Where(s => s.PropertyId == property.Id
                && s.OutletId == outletId
                && s.Status == PosConstants.SessionStatus.Open
                && (string.IsNullOrEmpty(s.ControlStatus) || s.ControlStatus == "OPEN"));

        var serverBank = await query
            .Where(s => s.BankType == "SERVER" && (s.UserId == staff.Id || s.PrimaryOperatorId == staff.Id || s.StaffId == staff.Id))
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync();

        if (serverBank != null) return serverBank;

        if (string.Equals(property.BankingModel, PosConstants.BankingModels.ServerBanking, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (string.Equals(staff.Role, "WAITER", StringComparison.OrdinalIgnoreCase)) return null;

        return await query
            .Where(s => s.DeviceId == deviceId && s.BankType != "SERVER")
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
    /// Binds the active trusted operator to an open session after shift start.
    /// This prevents the next protected IPC call from seeing the operator as
    /// authenticated but sessionless.
    /// </summary>
    public async Task AttachSessionAsync(string sessionId)
    {
        var context = await _dbContext.OperatorContexts.FirstOrDefaultAsync(c => c.IsActive)
            ?? throw new UnauthorizedAccessException("No active operator session found on this terminal.");
        var session = await _dbContext.PosSessions.FirstOrDefaultAsync(s =>
            s.Id == sessionId
            && s.PropertyId == context.PropertyId
            && s.OutletId == context.OutletId
            && s.Status == PosConstants.SessionStatus.Open
            && (string.IsNullOrEmpty(s.ControlStatus) || s.ControlStatus == "OPEN"));
        if (session == null)
            throw new InvalidOperationException("The selected POS shift is not open for this terminal.");

        if (string.Equals(session.BankType, "SERVER", StringComparison.OrdinalIgnoreCase)
            && session.PrimaryOperatorId != context.StaffId
            && session.StaffId != context.StaffId
            && session.UserId != context.StaffId)
            throw new UnauthorizedAccessException("This POS shift belongs to another operator.");

        context.SessionId = session.Id;
        await _dbContext.SaveChangesAsync();
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
