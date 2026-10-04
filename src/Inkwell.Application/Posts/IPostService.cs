using Inkwell.Application.Posts.Dtos;
using Inkwell.Domain.Common;

namespace Inkwell.Application.Posts;

public interface IPostService
{
    Task<PostDetailDto> CreateDraftAsync(CreatePostRequest request, Guid authorId, CancellationToken ct = default);
    Task<PostDetailDto> UpdateAsync(Guid id, UpdatePostRequest request, Guid authorId, CancellationToken ct = default);
    Task<PostDetailDto> PublishAsync(Guid id, Guid authorId, CancellationToken ct = default);
    Task<PostDetailDto> UnpublishAsync(Guid id, Guid authorId, CancellationToken ct = default);
    Task DeleteAsync(Guid id, Guid authorId, CancellationToken ct = default);

    /// <summary>Public read by canonical slug. Increments the view counter.</summary>
    Task<PostDetailDto> GetBySlugAsync(string slug, Guid? viewerId, CancellationToken ct = default);

    /// <summary>Loads a post by id for its author, including drafts.</summary>
    Task<PostDetailDto> GetForEditAsync(Guid id, Guid authorId, CancellationToken ct = default);

    Task<PagedResult<PostSummaryDto>> SearchAsync(PostQueryParameters parameters, CancellationToken ct = default);
    Task<PagedResult<PostSummaryDto>> GetPersonalFeedAsync(Guid userId, int pageNumber, int pageSize, CancellationToken ct = default);
    Task<PagedResult<PostSummaryDto>> GetDraftsAsync(Guid authorId, int pageNumber, int pageSize, CancellationToken ct = default);
    Task<PagedResult<PostSummaryDto>> GetBookmarksAsync(Guid userId, int pageNumber, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<PostSummaryDto>> GetRelatedAsync(Guid postId, int limit = 4, CancellationToken ct = default);
    Task<IReadOnlyList<PostRevisionDto>> GetRevisionsAsync(Guid postId, Guid authorId, int limit = 20, CancellationToken ct = default);
}
