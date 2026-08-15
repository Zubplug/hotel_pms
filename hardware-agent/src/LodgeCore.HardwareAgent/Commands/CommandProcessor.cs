using LodgeCore.HardwareAgent.Communication;
using LodgeCore.HardwareAgent.Locks;
using Microsoft.Extensions.Options;

namespace LodgeCore.HardwareAgent.Commands;

public class CommandProcessor
{
    private readonly ILogger<CommandProcessor> _logger;
    private readonly CommandQueue _queue;
    private readonly ILockProvider _lockProvider;
    private readonly LodgeCoreClient _apiClient;
    private readonly AgentSettings _settings;

    public CommandProcessor(
        ILogger<CommandProcessor> logger,
        CommandQueue queue,
        ILockProvider lockProvider,
        LodgeCoreClient apiClient,
        IOptions<AgentSettings> options)
    {
        _logger = logger;
        _queue = queue;
        _lockProvider = lockProvider;
        _apiClient = apiClient;
        _settings = options.Value;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Command Processor started. Waiting for commands...");
        
        // Strictly serialize processing: one command at a time
        await foreach (var cmd in _queue.ReadAllAsync(cancellationToken))
        {
            await ProcessCommandSafeAsync(cmd, cancellationToken);
        }
    }

    private async Task ProcessCommandSafeAsync(LockCommand cmd, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Processing command {CommandId} of type {Type}", cmd.Id, cmd.CommandType);

        // Security check: Target property must match our registered property
        if (cmd.PropertyId != _settings.PropertyId)
        {
            _logger.LogWarning("Rejecting command {CommandId}: PropertyId {PropId} does not match agent.", cmd.Id, cmd.PropertyId);
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "PROPERTY_MISMATCH", "Agent is not authorized for this property");
            return;
        }

        try
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CLAIMED");

            switch (cmd.CommandType)
            {
                case "ENCODE_CARD":
                case "ENCODE":
                    await ProcessEncodeCardAsync(cmd, cancellationToken);
                    break;

                case "READ_CARD":
                    await ProcessReadCardAsync(cmd, cancellationToken);
                    break;

                case "CANCEL_CARD":
                    await ProcessCancelCardAsync(cmd, cancellationToken);
                    break;

                case "READ_DIAGNOSTIC":
                    await ProcessReadDiagnosticAsync(cmd, cancellationToken);
                    break;

                default:
                    _logger.LogWarning("Unknown command type: {Type}", cmd.CommandType);
                    await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "UNKNOWN_COMMAND", $"Unknown command type: {cmd.CommandType}");
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected exception processing command {CommandId}", cmd.Id);
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "INTERNAL_ERROR", ex.Message);
        }
    }

    /// <summary>
    /// ENCODE_CARD: Wait for card, then write room + date payload.
    /// </summary>
    private async Task ProcessEncodeCardAsync(LockCommand cmd, CancellationToken cancellationToken)
    {
        var lockCode = cmd.Payload.GetProperty("roomNo").GetString() 
            ?? cmd.Payload.GetProperty("lockCode").GetString() 
            ?? "";

        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "WAITING_FOR_CARD");
        
        bool cardDetected = await _lockProvider.WaitForCardAsync(TimeSpan.FromSeconds(30), cancellationToken);
        if (!cardDetected)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "TIMEOUT", "No card detected on the encoder within 30 seconds");
            return;
        }

        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CARD_DETECTED");
        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "ENCODING");

        var result = await _lockProvider.EncodeCardAsync(lockCode, cancellationToken);
        if (result.Success)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "VERIFYING");
            await Task.Delay(200, cancellationToken);
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "COMPLETED");
        }
        else
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", result.ErrorCode, result.ErrorMessage);
        }
    }

    /// <summary>
    /// READ_CARD: Wait for a card, read its data, and post the results back to the PMS.
    /// The PMS uses this to confirm a card is blank before encoding (safety check).
    /// </summary>
    private async Task ProcessReadCardAsync(LockCommand cmd, CancellationToken cancellationToken)
    {
        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "WAITING_FOR_CARD");

        bool cardDetected = await _lockProvider.WaitForCardAsync(TimeSpan.FromSeconds(30), cancellationToken);
        if (!cardDetected)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "TIMEOUT", "No card detected on the encoder within 30 seconds");
            return;
        }

        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CARD_DETECTED");

        var result = await _lockProvider.ReadCardAsync(cancellationToken);

        if (!result.Success)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", result.ErrorCode, result.ErrorMessage);
            return;
        }

        // Post the structured card data back to the PMS as responseData
        var responsePayload = new
        {
            isBlank  = result.IsBlank,
            roomNo   = result.RoomNo,
            cardSnr  = result.CardSnr,
            validFrom = result.ValidFrom,
            validTo  = result.ValidTo,
        };

        _logger.LogInformation(
            "READ_CARD result: isBlank={IsBlank}, roomNo={Room}, snr={Snr}",
            result.IsBlank, result.RoomNo, result.CardSnr);

        await _apiClient.UpdateCommandWithResponseAsync(cmd.Id, responsePayload);
    }

    /// <summary>
    /// CANCEL_CARD: Erases the card by writing an all-zero / past-date payload.
    /// </summary>
    private async Task ProcessCancelCardAsync(LockCommand cmd, CancellationToken cancellationToken)
    {
        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "WAITING_FOR_CARD");

        bool cardDetected = await _lockProvider.WaitForCardAsync(TimeSpan.FromSeconds(30), cancellationToken);
        if (!cardDetected)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "TIMEOUT", "No card detected for cancel/erase");
            return;
        }

        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CARD_DETECTED");

        var result = await _lockProvider.CancelCardAsync(cancellationToken);
        if (result.Success)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "COMPLETED");
        }
        else
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", result.ErrorCode, result.ErrorMessage);
        }
    }

    /// <summary>
    /// READ_DIAGNOSTIC: Raw card read for diagnostics/debugging.
    /// </summary>
    private async Task ProcessReadDiagnosticAsync(LockCommand cmd, CancellationToken cancellationToken)
    {
        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "WAITING_FOR_CARD");
        
        bool cardDetected = await _lockProvider.WaitForCardAsync(TimeSpan.FromSeconds(30), cancellationToken);
        if (!cardDetected)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "TIMEOUT", "No card detected for diagnostic read");
            return;
        }

        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CARD_DETECTED");
        
        var result = await _lockProvider.ReadDiagnosticAsync(cancellationToken);
        if (result.Success)
        {
            await _apiClient.UpdateCommandWithResponseAsync(cmd.Id, new { rawHex = result.RawDataHex, discoveredCoID = result.DiscoveredCoID });
        }
        else
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "READ_FAILED", result.ErrorMessage);
        }
    }
}
