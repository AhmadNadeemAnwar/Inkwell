using System.Text.Json;
using Inkwell.Domain.Common;
using Inkwell.Domain.Exceptions;

namespace Inkwell.Application.Common;

/// <summary>
/// Checks the shape of a post body before it is stored. A body is either the original single
/// editor document (type "doc"), or a list of sections (type "sections") that the author can
/// reorder: text, an uploaded image, or a list of sources.
///
/// The public site renders only what it recognises, so this is not the only line of defence, but
/// rejecting bad input here keeps junk and unsafe links out of the database in the first place.
/// </summary>
public static class PostContent
{
    public const string TextSection = "textSection";
    public const string ImageSection = "imageSection";
    public const string ReferencesSection = "referencesSection";

    public const int MaxLength = 1_000_000;
    public const int MaxSections = 100;
    public const int MaxReferences = 50;
    public const int MaxCaptionLength = 300;
    public const int MaxReferenceTitleLength = 200;
    public const int MaxUrlLength = 2048;

    private const string NotADocument = "Post content must be a valid editor document.";

    public static void Validate(string contentJson)
    {
        if (string.IsNullOrWhiteSpace(contentJson)) throw new DomainException("Post content is required.");
        if (contentJson.Length > MaxLength) throw new DomainException("This post is too long to save.");

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(contentJson);
        }
        catch (JsonException)
        {
            throw new DomainException(NotADocument);
        }

        using (document)
        {
            var root = document.RootElement;
            switch (TypeOf(root))
            {
                case "doc":
                    return;
                case "sections":
                    ValidateSections(root);
                    return;
                default:
                    throw new DomainException(NotADocument);
            }
        }
    }

    private static void ValidateSections(JsonElement root)
    {
        if (!root.TryGetProperty("content", out var sections) || sections.ValueKind != JsonValueKind.Array)
            throw new DomainException(NotADocument);
        if (sections.GetArrayLength() > MaxSections)
            throw new DomainException($"A post can have at most {MaxSections} sections.");

        foreach (var section in sections.EnumerateArray())
        {
            switch (TypeOf(section))
            {
                case TextSection:
                    break;
                case ImageSection:
                    ValidateImage(section);
                    break;
                case ReferencesSection:
                    ValidateReferences(section);
                    break;
                default:
                    throw new DomainException("A post can only contain text, image and reference sections.");
            }
        }
    }

    private static void ValidateImage(JsonElement section)
    {
        var attrs = Attrs(section);
        if (!Guid.TryParse(Text(attrs, "imageId"), out _))
            throw new DomainException("An image section has no picture. Upload one or remove the section.");

        if ((Text(attrs, "alt")?.Length ?? 0) > MaxCaptionLength || (Text(attrs, "caption")?.Length ?? 0) > MaxCaptionLength)
            throw new DomainException($"Image descriptions and captions can be at most {MaxCaptionLength} characters.");
    }

    private static void ValidateReferences(JsonElement section)
    {
        var attrs = Attrs(section);
        if (attrs.ValueKind != JsonValueKind.Object || !attrs.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
            throw new DomainException("A reference section must be a list of sources.");
        if (items.GetArrayLength() > MaxReferences)
            throw new DomainException($"A reference section can list at most {MaxReferences} sources.");

        foreach (var item in items.EnumerateArray())
        {
            var title = Text(item, "title");
            var url = Text(item, "url");

            if (string.IsNullOrWhiteSpace(title)) throw new DomainException("Every reference needs a title.");
            if (title.Length > MaxReferenceTitleLength)
                throw new DomainException($"A reference title can be at most {MaxReferenceTitleLength} characters.");

            // The link is optional (a book has none), but when present it must be a real web address.
            if (!string.IsNullOrWhiteSpace(url) && (url.Length > MaxUrlLength || !UrlRules.IsHttpOrHttps(url)))
                throw new DomainException($"The link for \"{title}\" must start with http:// or https://.");
        }
    }

    private static string? TypeOf(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object ? Text(element, "type") : null;

    private static JsonElement Attrs(JsonElement section) =>
        section.TryGetProperty("attrs", out var attrs) ? attrs : default;

    private static string? Text(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
