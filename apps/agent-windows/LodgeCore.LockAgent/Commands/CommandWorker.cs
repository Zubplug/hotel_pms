using LodgeCore.LockAgent.Hardware;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Commands;

/// <summary>
/// Single-threaded command executor.
/// 
/// Uses SemaphoreSlim(1,1) to guarantee that only ONE card operation
/// runs at a time — the physical encoder cannot handle concurrent access.
/// 
/// State machine: QUEUED → CLAIMED (by PMS) → PROCESSING → COMPLETED | FAILED
/// </summary>
public sealed class CommandWorker
{
    private readonly PmsClient _pms;
    private readonly ILockProvider _lock;
    private readonly AgentConfig _config;
    private readonly ILogger<CommandWorker> _logger;

    // Enforce one-at-a-time hardware access
    private readonly SemaphoreSlim _encoderLock = new(1, 1);

    public CommandWorker(PmsClient pms, ILockProvider lockProvider, AgentConfig config, ILogger<CommandWorker> logger)
    {
        _pms    = pms;
        _lock   = lockProvider;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Poll once and execute a command if one is available.
    /// Called every PollIntervalMs by the main Worker loop.
    /// </summary>
    public async Task TickAsync(CancellationToken ct)
    {
        PmsCommand? command;
        try
        {
            command = await _pms.PollCommandAsync(ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Poll failed");
            return;
        }

        if (command is null) return;

        _logger.LogInformation("Received command {Id} type={Type}", command.Id, command.CommandType);

        await _encoderLock.WaitAsync(ct);
        try
        {
            var result = await ExecuteAsync(command, ct);
            await _pms.ReportResultAsync(command.Id, result, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error executing command {Id}", command.Id);
            await _pms.ReportResultAsync(command.Id, new CommandResult
            {
                Status = "FAILED",
                OperationStatus = "FAILED",
                ErrorCode = "AGENT_EXCEPTION",
                ErrorMessage = ex.Message,
            }, CancellationToken.None);
        }
        finally
        {
            _encoderLock.Release();
        }
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    private async Task<CommandResult> ExecuteAsync(PmsCommand command, CancellationToken ct)
    {
        return command.CommandType switch
        {
            "ENCODE"      => await HandleEncodeAsync(command, ct),
            "CANCEL_CARD" => await HandleCancelAsync(command, ct),
            "READ_CARD"   => await HandleReadAsync(command, ct),
            "PING"        => await HandlePingAsync(ct),
            _ => new CommandResult
            {
                Status = "FAILED",
                OperationStatus = "FAILED",
                ErrorCode = "UNKNOWN_COMMAND",
                ErrorMessage = $"Unknown command type: {command.CommandType}",
            }
        };
    }

    private async Task<CommandResult> HandleReadAsync(PmsCommand command, CancellationToken ct)
    {
        var readResult = await _lock.ReadGuestCardAsync(new ReadRequest(_config.CardWaitMs));

        var data = new System.Text.Json.Nodes.JsonObject();
        if (readResult.Success)
        {
            data["roomNo"] = readResult.RoomNo;
            data["checkIn"] = readResult.CheckIn?.ToString("o");
            data["checkOut"] = readResult.CheckOut?.ToString("o");
            data["flags"] = readResult.Flags;
        }

        return new CommandResult
        {
            Status          = readResult.Success ? "COMPLETED" : "FAILED",
            OperationStatus = readResult.Success ? "COMPLETED" : "FAILED",
            CardSnr         = readResult.CardSnr,
            Data            = data,
            ErrorCode       = readResult.Success ? null : $"SDK_{Math.Abs(readResult.ErrorCode)}",
            ErrorMessage    = readResult.VendorMessage,
        };
    }

    private async Task<CommandResult> HandleEncodeAsync(PmsCommand command, CancellationToken ct)
    {
        // Parse payload from PMS
        string roomNo      = command.Payload?.GetProperty("roomNo").GetString() ?? string.Empty;
        string checkInStr  = command.Payload?.GetProperty("checkIn").GetString() ?? string.Empty;
        string checkOutStr = command.Payload?.GetProperty("checkOut").GetString() ?? string.Empty;
        int flags          = command.Payload?.TryGetProperty("flags", out var f) == true ? f.GetInt32() : 0;

        if (string.IsNullOrEmpty(roomNo) || string.IsNullOrEmpty(checkOutStr))
        {
            return new CommandResult
            {
                Status = "FAILED", OperationStatus = "FAILED",
                ErrorCode = "INVALID_PAYLOAD", ErrorMessage = "roomNo and checkOut are required",
            };
        }
        DateTime.TryParse(checkInStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var checkIn);
        DateTime.TryParse(checkOutStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var checkOut);

        var encodeResult = await _lock.EncodeGuestCardAsync(new EncodeRequest(
            roomNo, checkIn, checkOut, flags, _config.CardWaitMs));

        return new CommandResult
        {
            Status          = encodeResult.Success ? "COMPLETED" : "FAILED",
            OperationStatus = encodeResult.Success ? "COMPLETED" : "FAILED",
            CardSnr         = encodeResult.CardSnr,
            ErrorCode       = encodeResult.Success ? null : $"SDK_{Math.Abs(encodeResult.ErrorCode)}",
            ErrorMessage    = encodeResult.VendorMessage,
        };
    }

    private async Task<CommandResult> HandleCancelAsync(PmsCommand command, CancellationToken ct)
    {
        var cancelResult = await _lock.CancelCardAsync(new CancelRequest(_config.CardWaitMs));

        return new CommandResult
        {
            Status          = cancelResult.Success ? "COMPLETED" : "FAILED",
            OperationStatus = cancelResult.Success ? "COMPLETED" : "FAILED",
            CardSnr         = cancelResult.CardSnr,
            ErrorCode       = cancelResult.Success ? null : $"SDK_{Math.Abs(cancelResult.ErrorCode)}",
            ErrorMessage    = cancelResult.VendorMessage,
        };
    }

    private async Task<CommandResult> HandlePingAsync(CancellationToken ct)
    {
        var ping = await _lock.PingAsync();
        return new CommandResult
        {
            Status          = ping.EncoderPresent ? "COMPLETED" : "FAILED",
            OperationStatus = ping.EncoderPresent ? "COMPLETED" : "FAILED",
            ErrorCode       = ping.EncoderPresent ? null : "ENCODER_OFFLINE",
            ErrorMessage    = ping.EncoderPresent ? null : "Encoder not detected",
        };
    }
}
