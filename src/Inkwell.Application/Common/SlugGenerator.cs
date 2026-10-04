using System.Globalization;
using System.Text;

namespace Inkwell.Application.Common;

/// <summary>Turns human titles into URL-safe slugs. Deterministic, so the same title always yields the same base.</summary>
public static class SlugGenerator
{
    private const int MaxLength = 80;

    public static string Generate(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        // Strip accents so "Café" and "Cafe" collapse to the same slug.
        var normalized = input.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        var lastWasDash = false;

        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;

            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(char.ToLowerInvariant(ch));
                lastWasDash = false;
            }
            else if (!lastWasDash && builder.Length > 0)
            {
                builder.Append('-');
                lastWasDash = true;
            }
        }

        var slug = builder.ToString().Trim('-');
        if (slug.Length > MaxLength)
        {
            slug = slug[..MaxLength].TrimEnd('-');
            var lastDash = slug.LastIndexOf('-');
            if (lastDash > MaxLength / 2) slug = slug[..lastDash];
        }

        return slug;
    }

    /// <summary>
    /// Appends a short random discriminator. Used when the base slug is already taken, which keeps
    /// slug allocation a single insert attempt instead of a count-and-retry loop.
    /// </summary>
    public static string WithSuffix(string slug)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        return string.IsNullOrEmpty(slug) ? suffix : $"{slug}-{suffix}";
    }
}
