using Inkwell.Application.Common;
using Inkwell.Application.Posts.Dtos;
using Inkwell.Application.Posts.Mapping;
using Inkwell.Domain.Common;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Enums;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;

namespace Inkwell.Application.Posts;

public sealed class PostService : IPostService
{
    private const int MaxTagsPerPost = 5;

    private readonly IPostRepository _posts;
    private readonly ITagRepository _tags;
    private readonly IEngagementRepository _engagement;
    private readonly IUnitOfWork _unitOfWork;

    public PostService(
        IPostRepository posts,
        ITagRepository tags,
        IEngagementRepository engagement,
        IUnitOfWork unitOfWork)
    {
        _posts = posts;
        _tags = tags;
        _engagement = engagement;
        _unitOfWork = unitOfWork;
    }

    public async Task<PostDetailDto> CreateDraftAsync(CreatePostRequest request, Guid authorId, CancellationToken ct = default)
    {
        PostContent.Validate(request.ContentJson);
        var plainText = ProseMirrorText.Extract(request.ContentJson);
        var post = new Post(authorId, request.Title, request.Subtitle, request.ContentJson, plainText, request.CoverImageUrl);

        await _posts.AddAsync(post, ct);
        await SyncTagsAsync(post, request.Tags, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return await LoadDetailAsync(post.Id, authorId, ct);
    }

    public async Task<PostDetailDto> UpdateAsync(Guid id, UpdatePostRequest request, Guid authorId, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(id, ct) ?? throw new NotFoundException(nameof(Post), id);
        post.EnsureOwnedBy(authorId);

        // Snapshot the pre-edit body first, so a bad edit is always recoverable.
        await _posts.AddRevisionAsync(new PostRevision(post.Id, post.Title, post.ContentJson), ct);

        PostContent.Validate(request.ContentJson);
        var plainText = ProseMirrorText.Extract(request.ContentJson);
        post.UpdateDraft(request.Title, request.Subtitle, request.ContentJson, plainText, request.CoverImageUrl);

        await SyncTagsAsync(post, request.Tags, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return await LoadDetailAsync(post.Id, authorId, ct);
    }

    public Task<PostDetailDto> PublishAsync(Guid id, Guid authorId, CancellationToken ct = default) =>
        ChangeStatusAsync(id, PostStatus.Published, authorId, ct);

    public Task<PostDetailDto> UnpublishAsync(Guid id, Guid authorId, CancellationToken ct = default) =>
        ChangeStatusAsync(id, PostStatus.Inactive, authorId, ct);

    public Task<PostDetailDto> SetStatusAsync(Guid id, string status, Guid authorId, CancellationToken ct = default) =>
        ChangeStatusAsync(id, PostStatusChange.Parse(status), authorId, ct);

    private async Task<PostDetailDto> ChangeStatusAsync(Guid id, PostStatus status, Guid authorId, CancellationToken ct)
    {
        var post = await _posts.GetByIdAsync(id, ct) ?? throw new NotFoundException(nameof(Post), id);
        post.EnsureOwnedBy(authorId);

        await PostStatusChange.ApplyAsync(post, status, _posts, ct);

        await _unitOfWork.SaveChangesAsync(ct);
        return await LoadDetailAsync(post.Id, authorId, ct);
    }

    public async Task DeleteAsync(Guid id, Guid authorId, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(id, ct) ?? throw new NotFoundException(nameof(Post), id);
        post.EnsureOwnedBy(authorId);

        if (post.Status == PostStatus.Published)
        {
            foreach (var postTag in post.PostTags)
            {
                postTag.Tag?.DecrementPostCount();
            }
        }

        _posts.Remove(post);
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<PostDetailDto> GetBySlugAsync(string slug, Guid? viewerId, CancellationToken ct = default)
    {
        var post = await _posts.GetBySlugAsync(slug, ct) ?? throw new NotFoundException(nameof(Post), slug);

        if (!post.IsVisibleTo(viewerId)) throw new NotFoundException(nameof(Post), slug);

        // Author previews of their own drafts should not inflate the counter.
        if (viewerId != post.AuthorId)
        {
            post.RegisterView();
            await _unitOfWork.SaveChangesAsync(ct);
        }

        return post.ToDetail(await BuildViewerStateAsync(post, viewerId, ct));
    }

    public async Task<PostDetailDto> GetForEditAsync(Guid id, Guid authorId, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(id, ct) ?? throw new NotFoundException(nameof(Post), id);
        post.EnsureOwnedBy(authorId);
        return post.ToDetail(await BuildViewerStateAsync(post, authorId, ct));
    }

    public async Task<PagedResult<PostSummaryDto>> SearchAsync(PostQueryParameters parameters, CancellationToken ct = default)
    {
        var result = await _posts.SearchAsync(parameters.ToQuery(), ct);
        return result.Map(p => p.ToSummary());
    }

    public async Task<PagedResult<PostSummaryDto>> GetPersonalFeedAsync(Guid userId, int pageNumber, int pageSize, CancellationToken ct = default)
    {
        var result = await _posts.GetPersonalFeedAsync(userId, pageNumber, pageSize, ct);
        return result.Map(p => p.ToSummary());
    }

    public async Task<PagedResult<PostSummaryDto>> GetDraftsAsync(Guid authorId, int pageNumber, int pageSize, CancellationToken ct = default)
    {
        var result = await _posts.GetDraftsAsync(authorId, pageNumber, pageSize, ct);
        return result.Map(p => p.ToSummary());
    }

    public async Task<PagedResult<PostSummaryDto>> GetBookmarksAsync(Guid userId, int pageNumber, int pageSize, CancellationToken ct = default)
    {
        var result = await _posts.GetBookmarkedAsync(userId, pageNumber, pageSize, ct);
        return result.Map(p => p.ToSummary());
    }

    public async Task<IReadOnlyList<PostSummaryDto>> GetRelatedAsync(Guid postId, int limit = 4, CancellationToken ct = default)
    {
        var related = await _posts.GetRelatedAsync(postId, limit, ct);
        return related.Select(p => p.ToSummary()).ToList();
    }

    public async Task<IReadOnlyList<PostRevisionDto>> GetRevisionsAsync(Guid postId, Guid authorId, int limit = 20, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);
        post.EnsureOwnedBy(authorId);

        var revisions = await _posts.GetRevisionsAsync(postId, limit, ct);
        return revisions.Select(r => r.ToDto()).ToList();
    }

    /// <summary>
    /// Reconciles a post's tags against the submitted names, creating any that do not exist yet.
    /// Tag post-counts are only adjusted for published posts, since drafts are not listed.
    /// </summary>
    private async Task SyncTagsAsync(Post post, IReadOnlyList<string>? tagNames, CancellationToken ct)
    {
        var requested = (tagNames ?? [])
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => (Name: t.Trim(), Slug: SlugGenerator.Generate(t)))
            .Where(t => t.Slug.Length > 0)
            .DistinctBy(t => t.Slug)
            .Take(MaxTagsPerPost)
            .ToList();

        if (tagNames is { Count: > MaxTagsPerPost })
            throw new DomainException($"A post can have at most {MaxTagsPerPost} tags.");

        var existing = await _tags.GetBySlugsAsync(requested.Select(t => t.Slug), ct);
        var bySlug = existing.ToDictionary(t => t.Slug, StringComparer.OrdinalIgnoreCase);

        foreach (var (name, slug) in requested)
        {
            if (bySlug.ContainsKey(slug)) continue;

            var tag = new Tag(name, slug);
            await _tags.AddAsync(tag, ct);
            bySlug[slug] = tag;
        }

        var isPublished = post.Status == PostStatus.Published;
        var desiredIds = requested.Select(t => bySlug[t.Slug].Id).ToHashSet();

        foreach (var removed in post.PostTags.Where(pt => !desiredIds.Contains(pt.TagId)).ToList())
        {
            if (isPublished) removed.Tag?.DecrementPostCount();
            post.PostTags.Remove(removed);
        }

        var currentIds = post.PostTags.Select(pt => pt.TagId).ToHashSet();
        foreach (var (_, slug) in requested)
        {
            var tag = bySlug[slug];
            if (currentIds.Contains(tag.Id)) continue;

            post.PostTags.Add(new PostTag(post.Id, tag.Id));
            if (isPublished) tag.IncrementPostCount();
        }
    }

    private async Task<ViewerStateDto?> BuildViewerStateAsync(Post post, Guid? viewerId, CancellationToken ct)
    {
        if (viewerId is not { } userId) return null;

        var (hasClapped, hasBookmarked) = await _engagement.GetViewerStateAsync(post.Id, userId, ct);
        var isFollowing = post.AuthorId != userId
            && await _engagement.GetUserFollowAsync(userId, post.AuthorId, ct) is not null;

        return new ViewerStateDto(hasClapped, hasBookmarked, isFollowing, post.AuthorId == userId);
    }

    private async Task<PostDetailDto> LoadDetailAsync(Guid postId, Guid viewerId, CancellationToken ct)
    {
        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);
        return post.ToDetail(await BuildViewerStateAsync(post, viewerId, ct));
    }
}
