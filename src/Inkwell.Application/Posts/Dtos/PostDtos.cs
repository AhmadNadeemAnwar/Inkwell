using Inkwell.Domain.Common;

namespace Inkwell.Application.Posts.Dtos;

public sealed record AuthorSummaryDto(
    Guid Id,
    string Handle,
    string DisplayName,
    string? AvatarUrl,
    string? Bio);

public sealed record TagDto(
    Guid Id,
    string Name,
    string Slug,
    int PostCount);

/// <summary>Feed-card shape. Deliberately excludes the post body so list endpoints stay light.</summary>
public sealed record PostSummaryDto(
    Guid Id,
    string? Slug,
    string Title,
    string? Subtitle,
    string Excerpt,
    string? CoverImageUrl,
    int ReadingTimeMinutes,
    int ClapCount,
    int CommentCount,
    string Status,
    DateTimeOffset? PublishedAt,
    AuthorSummaryDto Author,
    IReadOnlyList<TagDto> Tags);

/// <summary>Per-viewer engagement flags, null for anonymous readers.</summary>
public sealed record ViewerStateDto(bool HasClapped, bool HasBookmarked, bool IsFollowingAuthor, bool IsAuthor);

public sealed record PostDetailDto(
    Guid Id,
    string? Slug,
    string Title,
    string? Subtitle,
    string ContentJson,
    string? CoverImageUrl,
    int ReadingTimeMinutes,
    int ClapCount,
    int CommentCount,
    int ViewCount,
    string Status,
    DateTimeOffset? PublishedAt,
    DateTimeOffset UpdatedAt,
    AuthorSummaryDto Author,
    IReadOnlyList<TagDto> Tags,
    ViewerStateDto? Viewer);

public sealed record CreatePostRequest(
    string Title,
    string? Subtitle,
    string ContentJson,
    string? CoverImageUrl,
    IReadOnlyList<string>? Tags);

public sealed record UpdatePostRequest(
    string Title,
    string? Subtitle,
    string ContentJson,
    string? CoverImageUrl,
    IReadOnlyList<string>? Tags);

public sealed record PostRevisionDto(Guid Id, string Title, DateTimeOffset CreatedAt);

/// <summary>Query-string binding for the browse/search endpoint.</summary>
public sealed class PostQueryParameters
{
    private const int MaxPageSize = 50;
    private int _pageSize = 20;
    private int _pageNumber = 1;

    /// <summary>Free-text search term matched against title, subtitle and body.</summary>
    public string? Q { get; set; }
    public string? Tag { get; set; }
    public string? Author { get; set; }
    public PostSort Sort { get; set; } = PostSort.Latest;

    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value switch { < 1 => 20, > MaxPageSize => MaxPageSize, _ => value };
    }

    public PostQuery ToQuery() => new()
    {
        SearchTerm = string.IsNullOrWhiteSpace(Q) ? null : Q.Trim(),
        TagSlug = string.IsNullOrWhiteSpace(Tag) ? null : Tag.Trim().ToLowerInvariant(),
        AuthorHandle = string.IsNullOrWhiteSpace(Author) ? null : Author.Trim().ToLowerInvariant(),
        Sort = Sort,
        PageNumber = PageNumber,
        PageSize = PageSize
    };
}
