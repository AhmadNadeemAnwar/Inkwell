using Inkwell.Domain.Entities;

namespace Inkwell.Domain.Interfaces;

/// <summary>Claps, bookmarks and follows — the small join-table writes that drive the social layer.</summary>
public interface IEngagementRepository
{
    Task<Clap?> GetClapAsync(Guid postId, Guid userId, CancellationToken ct = default);
    Task AddClapAsync(Clap clap, CancellationToken ct = default);

    Task<Bookmark?> GetBookmarkAsync(Guid postId, Guid userId, CancellationToken ct = default);
    Task AddBookmarkAsync(Bookmark bookmark, CancellationToken ct = default);
    void RemoveBookmark(Bookmark bookmark);

    Task<UserFollow?> GetUserFollowAsync(Guid followerId, Guid followeeId, CancellationToken ct = default);
    Task AddUserFollowAsync(UserFollow follow, CancellationToken ct = default);
    void RemoveUserFollow(UserFollow follow);

    Task<TagFollow?> GetTagFollowAsync(Guid userId, Guid tagId, CancellationToken ct = default);
    Task AddTagFollowAsync(TagFollow follow, CancellationToken ct = default);
    void RemoveTagFollow(TagFollow follow);

    /// <summary>Per-post engagement flags for the current viewer, so the client can render correct button states.</summary>
    Task<(bool HasClapped, bool HasBookmarked)> GetViewerStateAsync(Guid postId, Guid userId, CancellationToken ct = default);
}
