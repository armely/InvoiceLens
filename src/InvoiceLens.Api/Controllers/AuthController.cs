using System.Security.Claims;
using System.Net.Http.Headers;
using System.Text.Json;
using InvoiceLens.Api.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(MicrosoftSessionTokenValidator tokenValidator, IHttpClientFactory httpClientFactory) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("session")]
    public async Task<ActionResult<AuthProfileDto>> CreateSession([FromBody] CreateSessionRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            return BadRequest(new { error = "An id token is required." });
        }

        var validation = await tokenValidator.ValidateAsync(request.IdToken, cancellationToken);
        var photoDataUrl = await TryFetchMicrosoftProfilePhotoAsync(request.AccessToken, cancellationToken);
        var details = await TryFetchMicrosoftUserDetailsAsync(request.AccessToken, cancellationToken);
        var profile = BuildProfile(validation.Principal, photoDataUrl, details);
        var principal = BuildCookiePrincipal(validation.Principal, profile);
        var expiresUtc = validation.ExpiresUtc <= DateTime.UtcNow
            ? DateTimeOffset.UtcNow.AddHours(1)
            : new DateTimeOffset(validation.ExpiresUtc, TimeSpan.Zero);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = expiresUtc,
            });

        return Ok(profile);
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult<AuthProfileDto> Me()
    {
        return Ok(BuildProfile(User));
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    private static ClaimsPrincipal BuildCookiePrincipal(ClaimsPrincipal source, AuthProfileDto profile)
    {
        var email = profile.Email ?? string.Empty;
        var nameIdentifier = GetClaimValue(source, "oid")
            ?? GetClaimValue(source, ClaimTypes.NameIdentifier)
            ?? (!string.IsNullOrWhiteSpace(email) ? email : profile.DisplayName);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, nameIdentifier),
            new(ClaimTypes.Name, profile.DisplayName),
            new(ClaimTypes.Email, email),
            new("displayName", profile.DisplayName),
            new("initials", profile.Initials),
            new("preferred_username", email),
        };

        if (!string.IsNullOrWhiteSpace(profile.JobTitle))
        {
            claims.Add(new Claim("jobTitle", profile.JobTitle));
        }

        if (!string.IsNullOrWhiteSpace(profile.Department))
        {
            claims.Add(new Claim("department", profile.Department));
        }

        if (!string.IsNullOrWhiteSpace(profile.OfficeLocation))
        {
            claims.Add(new Claim("officeLocation", profile.OfficeLocation));
        }

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme, ClaimTypes.Name, ClaimTypes.Role);
        return new ClaimsPrincipal(identity);
    }

    private static AuthProfileDto BuildProfile(ClaimsPrincipal principal, string? photoDataUrl = null, MicrosoftUserDetails? details = null)
    {
        var displayName = GetClaimValue(principal, "name")
            ?? GetClaimValue(principal, ClaimTypes.Name)
            ?? GetClaimValue(principal, "displayName")
            ?? GetClaimValue(principal, "preferred_username")
            ?? GetClaimValue(principal, ClaimTypes.Email)
            ?? "Microsoft user";

        var email = GetClaimValue(principal, "preferred_username")
            ?? GetClaimValue(principal, ClaimTypes.Email)
            ?? GetClaimValue(principal, "upn")
            ?? string.Empty;

        var jobTitle = NullIfWhiteSpace(details?.JobTitle)
            ?? GetClaimValue(principal, "jobTitle")
            ?? GetClaimValue(principal, ClaimTypes.Role)
            ?? GetClaimValue(principal, "roles");

        var department = NullIfWhiteSpace(details?.Department)
            ?? GetClaimValue(principal, "department");

        var officeLocation = NullIfWhiteSpace(details?.OfficeLocation)
            ?? GetClaimValue(principal, "officeLocation");

        var initials = BuildInitials(displayName);

        return new AuthProfileDto(displayName, initials, email, photoDataUrl, jobTitle, department, officeLocation);
    }

    private async Task<MicrosoftUserDetails?> TryFetchMicrosoftUserDetailsAsync(string? accessToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                "https://graph.microsoft.com/v1.0/me?$select=jobTitle,department,officeLocation");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var client = httpClientFactory.CreateClient(nameof(AuthController));
            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = document.RootElement;

            return new MicrosoftUserDetails(
                ReadStringProperty(root, "jobTitle"),
                ReadStringProperty(root, "department"),
                ReadStringProperty(root, "officeLocation"));
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadStringProperty(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? NullIfWhiteSpace(value.GetString())
            : null;
    }

    private static string? NullIfWhiteSpace(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private async Task<string?> TryFetchMicrosoftProfilePhotoAsync(string? accessToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://graph.microsoft.com/v1.0/me/photo/$value");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*"));

            var client = httpClientFactory.CreateClient(nameof(AuthController));
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (bytes.Length == 0)
            {
                return null;
            }

            var mediaType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            return $"data:{mediaType};base64,{Convert.ToBase64String(bytes)}";
        }
        catch
        {
            return null;
        }
    }

    private static string? GetClaimValue(ClaimsPrincipal principal, string claimType)
    {
        return principal.FindFirst(claimType)?.Value;
    }

    private static string BuildInitials(string displayName)
    {
        var initials = displayName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part[0])
            .Take(2)
            .ToArray();

        return initials.Length > 0 ? new string(initials).ToUpperInvariant() : "MU";
    }

    public sealed record CreateSessionRequest(string IdToken, string? AccessToken = null);

    public sealed record AuthProfileDto(
        string DisplayName,
        string Initials,
        string Email,
        string? PhotoDataUrl = null,
        string? JobTitle = null,
        string? Department = null,
        string? OfficeLocation = null);

    private sealed record MicrosoftUserDetails(string? JobTitle, string? Department, string? OfficeLocation);
}
