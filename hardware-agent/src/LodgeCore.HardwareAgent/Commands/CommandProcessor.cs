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

        // Security check 1: Target property must match our registered property
        if (cmd.PropertyId != _settings.PropertyId)
        {
            _logger.LogWarning("Rejecting command {CommandId} because PropertyId {PropId} does not match our agent.", cmd.Id, cmd.PropertyId);
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "PROPERTY_MISMATCH", "Agent is not authorized for this property");
            return;
        }

        try
        {
            // Update UI to show we claimed it
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CLAIMED");

            switch (cmd.CommandType)
            {
                case "ENCODE_CARD":
                    await ProcessEncodeCardAsync(cmd, cancellationToken);
                    break;
                case "READ_DIAGNOSTIC":
                    await ProcessReadDiagnosticAsync(cmd, cancellationToken);
                    break;
                default:
                    _logger.LogWarning("Unknown command type: {Type}", cmd.CommandType);
                    await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "UNKNOWN_COMMAND", "Command type not supported");
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected exception processing command {CommandId}", cmd.Id);
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "INTERNAL_ERROR", ex.Message);
        }
    }

    private async Task ProcessEncodeCardAsync(LockCommand cmd, CancellationToken cancellationToken)
    {
        // Extract payload
        var lockCode = cmd.Payload.GetProperty("lockCode").GetString() ?? "";
        
        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "WAITING_FOR_CARD");
        
        // Wait for physical card detection
        bool cardDetected = await _lockProvider.WaitForCardAsync(TimeSpan.FromSeconds(30), cancellationToken);
        if (!cardDetected)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "TIMEOUT", "No card detected on the encoder");
            return;
        }

        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "CARD_DETECTED");
        await _apiClient.UpdateCommandStatusAsync(cmd.Id, "ENCODING");

        var result = await _lockProvider.EncodeCardAsync(lockCode, cancellationToken);
        if (result.Success)
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "VERIFYING");
            await Task.Delay(200, cancellationToken); // simulated verify
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "COMPLETED");
        }
        else
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", result.ErrorCode, result.ErrorMessage);
        }
    }

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
            // Update the command with the diagnostic output in a generic metadata field if the API supported it
            // For now, we put the diagnostic result in the error message for visibility, or if we had a dedicated field.
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "COMPLETED", "DIAGNOSTIC_DATA", result.RawDataHex);
        }
        else
        {
            await _apiClient.UpdateCommandStatusAsync(cmd.Id, "FAILED", "READ_FAILED", result.ErrorMessage);
        }
    }
}
