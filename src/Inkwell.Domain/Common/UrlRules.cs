namespace Inkwell.Domain.Common;

/// <summary>
/// Allow-list checks for user-supplied URLs. Anything outside http(s) is rejected, which rules out
/// javascript:, data:, file: and similar schemes regardless of how a client chooses to render them.
/// </summary>
public static class UrlRules
{
    public static bool IsHttpOrHttps(string? value) =>
        TryParse(value, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    /// <summary>Images are https-only: the site is served over https, so http images would be blocked as mixed content.</summary>
    public static bool IsHttps(string? value) =>
        TryParse(value, out var uri) && uri.Scheme == Uri.UriSchemeHttps;

    private static bool TryParse(string? value, out Uri uri)
    {
        uri = null!;
        return !string.IsNullOrWhiteSpace(value)
            && Uri.TryCreate(value.Trim(), UriKind.Absolute, out uri!)
            && !string.IsNullOrEmpty(uri.Host);
    }
}
