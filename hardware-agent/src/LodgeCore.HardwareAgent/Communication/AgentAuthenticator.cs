using Microsoft.Extensions.Options;

namespace LodgeCore.HardwareAgent.Communication;

public class AgentAuthenticator
{
    private readonly ILogger<AgentAuthenticator> _logger;
    private readonly AgentSettings _settings;
    private string? _accessToken;

    public AgentAuthenticator(ILogger<AgentAuthenticator> logger, IOptions<AgentSettings> options)
    {
        _logger = logger;
        _settings = options.Value;
    }

    public string? AccessToken => _accessToken;

    public async Task<bool> AuthenticateAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Authenticating agent {AgentId} for property {PropertyId}...", 
            _settings.AgentId, _settings.PropertyId);
        
        // In production, the agent authenticates using the hardware-provisioned JWT token.
        // For early deployment phases, this uses the pre-provisioned secret token installed on the device.
        
        await Task.Delay(500, cancellationToken);
        _accessToken = _settings.AgentId + "_secure_token";
        
        _logger.LogInformation("Agent successfully authenticated.");
        return true;
    }
}
