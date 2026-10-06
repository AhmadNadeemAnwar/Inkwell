namespace Inkwell.Application.Admin.Dtos;

public sealed record AdminLoginRequest(string Email, string Code);

public sealed record AdminSessionDto(string Token, DateTimeOffset ExpiresAt, string Email, string DisplayName);

public sealed record DailyCountDto(string Date, int Count);

public sealed record TopPostDto(Guid Id, string Title, string? Slug, int Views, int Claps, int Comments);

public sealed record AdminStatsDto(
    int PublishedPosts,
    int DraftPosts,
    int InactivePosts,
    int Users,
    int Comments,
    long Claps,
    long Views,
    int Bookmarks,
    int Tags,
    IReadOnlyList<TopPostDto> TopByViews,
    IReadOnlyList<TopPostDto> TopByClaps,
    IReadOnlyList<DailyCountDto> PublishedLast30Days);

public sealed record AdminPostDto(
    Guid Id,
    string Title,
    string? Slug,
    string Status,
    string AuthorHandle,
    string AuthorName,
    DateTimeOffset? PublishedAt,
    DateTimeOffset UpdatedAt,
    int Views,
    int Claps,
    int Comments,
    IReadOnlyList<string> Tags);

public sealed record AdminCommentDto(
    Guid Id,
    string Body,
    bool IsDeleted,
    bool IsReply,
    DateTimeOffset CreatedAt,
    string AuthorHandle,
    Guid PostId,
    string PostTitle,
    string? PostSlug);

public sealed record AdminTagDto(Guid Id, string Name, string Slug, int PostCount, int Followers);

public sealed record RenameTagRequest(string Name);

public sealed record MergeTagRequest(Guid TargetTagId);
