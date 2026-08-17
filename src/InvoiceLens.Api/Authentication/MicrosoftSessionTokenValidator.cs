using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace InvoiceLens.Api.Authentication;

public sealed record MicrosoftSessionValidationResult(ClaimsPrincipal Principal, DateTime ExpiresUtc);

public sealed class MicrosoftSessionTokenValidator(IOptions<MicrosoftAuthOptions> options)
{
    private readonly ConfigurationManager<OpenIdConnectConfiguration> configurationManager = CreateConfigurationManager(options.Value.TenantId);

    public async Task<MicrosoftSessionValidationResult> ValidateAsync(string idToken, CancellationToken cancellationToken)
    {
        var authOptions = options.Value;
        if (string.IsNullOrWhiteSpace(authOptions.TenantId))
        {
            throw new InvalidOperationException("Microsoft tenant ID is not configured.");
        }

        if (string.IsNullOrWhiteSpace(authOptions.ClientId))
        {
            throw new InvalidOperationException("Microsoft client ID is not configured.");
        }

        var openIdConfiguration = await configurationManager.GetConfigurationAsync(cancellationToken);

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://login.microsoftonline.com/{authOptions.TenantId}/v2.0",
            ValidateAudience = true,
            ValidAudience = authOptions.ClientId,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = openIdConfiguration.SigningKeys,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5),
            NameClaimType = "name",
            RoleClaimType = "roles",
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        tokenHandler.InboundClaimTypeMap.Clear();

        var principal = tokenHandler.ValidateToken(idToken, tokenValidationParameters, out var validatedToken);
        if (validatedToken is not JwtSecurityToken jwtToken)
        {
            throw new SecurityTokenException("The Microsoft session token could not be validated.");
        }

        var validTo = jwtToken.ValidTo.Kind == DateTimeKind.Utc
            ? jwtToken.ValidTo
            : DateTime.SpecifyKind(jwtToken.ValidTo, DateTimeKind.Utc);

        return new MicrosoftSessionValidationResult(principal, validTo);
    }

    private static ConfigurationManager<OpenIdConnectConfiguration> CreateConfigurationManager(string tenantId)
    {
        var metadataAddress = string.IsNullOrWhiteSpace(tenantId)
            ? "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
            : $"https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration";

        return new ConfigurationManager<OpenIdConnectConfiguration>(
            metadataAddress,
            new OpenIdConnectConfigurationRetriever(),
            new HttpDocumentRetriever { RequireHttps = true });
    }
}
