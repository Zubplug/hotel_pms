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
        
        // TODO: In production, load the DPAPI-protected secret from CredentialStore
        // and exchange it for a JWT access token via HTTPS POST /auth/agent
        // For now, we mock the success.
        
        await Task.Delay(500, cancellationToken);
        _accessToken = "mock-agent-jwt-token";
        
        _logger.LogInformation("Agent successfully authenticated.");
        return true;
    }
}
