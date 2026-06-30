namespace InvoiceLens.Api.Auth;

public class CurrentUser
{
    public string UserId { get; init; } = "local-user";

    public string DisplayName { get; init; } = "Local Analyst";

    public IReadOnlyList<string> Roles { get; init; } = ["Reviewer"];
}
