namespace Inkwell.Api.Common;

public sealed class AccountOptions
{
    public const string SectionName = "Accounts";

    /// <summary>
    /// When false, nobody can create an account through the API, and the web app hides every
    /// sign-in and sign-up prompt from visitors. Existing accounts can still sign in. This is the
    /// single switch both the API and the client follow, so the two cannot disagree.
    /// </summary>
    public bool AllowPublicSignUp { get; set; } = true;
}
