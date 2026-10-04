using Inkwell.Application.Admin.Dtos;
using Inkwell.Application.Common;
using Inkwell.Domain.Common;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Enums;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace Inkwell.Application.Admin;

public interface IAdminService
{
    Task<AdminStatsDto> GetStatsAsync(CancellationToken ct = default);

    Task<PagedResult<AdminPostDto>> GetPostsAsync(string? status, string? search, int pageNumber, int pageSize, CancellationToken ct = default);
    Task UnpublishPostAsync(Guid postId, string admin, CancellationToken ct = default);
    Task DeletePostAsync(Guid postId, string admin, CancellationToken ct = default);

    Task<PagedResult<AdminCommentDto>> GetCommentsAsync(int pageNumber, int pageSize, CancellationToken ct = default);
    Task DeleteCommentAsync(Guid commentId, string admin, CancellationToken ct = default);

    Task<IReadOnlyList<AdminTagDto>> GetTagsAsync(CancellationToken ct = default);
    Task<AdminTagDto> RenameTagAsync(Guid tagId, string name, string admin, CancellationToken ct = default);
    Task MergeTagAsync(Guid sourceId, Guid targetId, string admin, CancellationToken ct = default);
    Task DeleteTagAsync(Guid tagId, string admin, CancellationToken ct = default);
}

public sealed class AdminService : IAdminService
{
    private const int ChartDays = 30;

    private readonly IAdminRepository _admin;
    private readonly IPostRepository _posts;
    private readonly ICommentRepository _comments;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _time;
    private readonly ILogger<AdminService> _logger;

    public AdminService(
        IAdminRepository admin,
        IPostRepository posts,
        ICommentRepository comments,
        IUnitOfWork unitOfWork,
        ILogger<AdminService> logger,
        TimeProvider? time = null)
    {
        _admin = admin;
        _posts = posts;
        _comments = comments;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _time = time ?? TimeProvider.System;
    }

    public async Task<AdminStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var today = _time.GetUtcNow().UtcDateTime.Date;
        var since = new DateTimeOffset(today.AddDays(-(ChartDays - 1)), TimeSpan.Zero);

        var stats = await _admin.GetStatsAsync(since, ct);

        var perDay = stats.RecentPublishDates
            .GroupBy(d => d.UtcDateTime.Date)
            .ToDictionary(g => g.Key, g => g.Count());

        // Every day gets a row, including quiet ones, so the chart has no gaps.
        var series = Enumerable.Range(0, ChartDays)
            .Select(offset => since.UtcDateTime.Date.AddDays(offset))
            .Select(day => new DailyCountDto(day.ToString("yyyy-MM-dd"), perDay.GetValueOrDefault(day)))
            .ToList();

        return new AdminStatsDto(
            stats.PublishedPosts, stats.DraftPosts, stats.UnlistedPosts, stats.Users, stats.Comments,
            stats.Claps, stats.Views, stats.Bookmarks, stats.Tags,
            stats.TopByViews.Select(ToDto).ToList(),
            stats.TopByClaps.Select(ToDto).ToList(),
            series);
    }

    public async Task<PagedResult<AdminPostDto>> GetPostsAsync(string? status, string? search, int pageNumber, int pageSize, CancellationToken ct = default)
    {
        PostStatus? parsed = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<PostStatus>(status, ignoreCase: true, out var value))
                throw new DomainException("Status must be Draft, Published or Unlisted.");
            parsed = value;
        }

        var page = await _admin.SearchPostsAsync(parsed, search, pageNumber, pageSize, ct);
        return page.Map(p => new AdminPostDto(
            p.Id, p.Title, p.Slug, p.Status.ToString(), p.Author.Handle, p.Author.DisplayName,
            p.PublishedAt, p.UpdatedAt, p.ViewCount, p.ClapCount, p.CommentCount,
            p.PostTags.Select(pt => pt.Tag.Name).OrderBy(n => n).ToList()));
    }

    public async Task UnpublishPostAsync(Guid postId, string admin, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);

        var wasPublished = post.Status == PostStatus.Published;
        post.Unpublish();

        if (wasPublished)
        {
            foreach (var postTag in post.PostTags) postTag.Tag?.DecrementPostCount();
        }

        await _unitOfWork.SaveChangesAsync(ct);
        _logger.LogInformation("Admin {Admin} took down post {PostId} ({Title})", admin, post.Id, post.Title);
    }

    public async Task DeletePostAsync(Guid postId, string admin, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);

        if (post.Status == PostStatus.Published)
        {
            foreach (var postTag in post.PostTags) postTag.Tag?.DecrementPostCount();
        }

        _posts.Remove(post);
        await _unitOfWork.SaveChangesAsync(ct);
        _logger.LogWarning("Admin {Admin} deleted post {PostId} ({Title})", admin, postId, post.Title);
    }

    public async Task<PagedResult<AdminCommentDto>> GetCommentsAsync(int pageNumber, int pageSize, CancellationToken ct = default)
    {
        var page = await _admin.GetCommentsAsync(pageNumber, pageSize, ct);
        return page.Map(c => new AdminCommentDto(
            c.Id, c.Body, c.IsDeleted, c.ParentId.HasValue, c.CreatedAt,
            c.Author.Handle, c.PostId, c.Post.Title, c.Post.Slug));
    }

    public async Task DeleteCommentAsync(Guid commentId, string admin, CancellationToken ct = default)
    {
        var comment = await _comments.GetByIdAsync(commentId, ct) ?? throw new NotFoundException(nameof(Comment), commentId);
        if (comment.IsDeleted) return;

        var post = await _posts.GetByIdAsync(comment.PostId, ct);

        comment.SoftDelete();
        post?.DecrementCommentCount();

        await _unitOfWork.SaveChangesAsync(ct);
        _logger.LogWarning("Admin {Admin} removed comment {CommentId} on post {PostId}", admin, commentId, comment.PostId);
    }

    public async Task<IReadOnlyList<AdminTagDto>> GetTagsAsync(CancellationToken ct = default)
    {
        var rows = await _admin.GetTagsAsync(ct);
        return rows.Select(r => new AdminTagDto(r.Tag.Id, r.Tag.Name, r.Tag.Slug, r.Tag.PostCount, r.Followers)).ToList();
    }

    public async Task<AdminTagDto> RenameTagAsync(Guid tagId, string name, string admin, CancellationToken ct = default)
    {
        var tag = await _admin.GetTagAsync(tagId, ct) ?? throw new NotFoundException(nameof(Tag), tagId);

        var previous = tag.Name;
        tag.Rename(name);

        await _unitOfWork.SaveChangesAsync(ct);
        _logger.LogInformation("Admin {Admin} renamed tag {Slug} from '{Old}' to '{New}'", admin, tag.Slug, previous, tag.Name);

        var followers = (await _admin.GetTagsAsync(ct)).FirstOrDefault(r => r.Tag.Id == tagId)?.Followers ?? 0;
        return new AdminTagDto(tag.Id, tag.Name, tag.Slug, tag.PostCount, followers);
    }

    public async Task MergeTagAsync(Guid sourceId, Guid targetId, string admin, CancellationToken ct = default)
    {
        if (sourceId == targetId) throw new DomainException("Choose a different tag to merge into.");

        var source = await _admin.GetTagAsync(sourceId, ct) ?? throw new NotFoundException(nameof(Tag), sourceId);
        var target = await _admin.GetTagAsync(targetId, ct) ?? throw new NotFoundException(nameof(Tag), targetId);

        await _admin.MergeTagsAsync(sourceId, targetId, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogWarning("Admin {Admin} merged tag {Source} into {Target}", admin, source.Slug, target.Slug);
    }

    public async Task DeleteTagAsync(Guid tagId, string admin, CancellationToken ct = default)
    {
        var tag = await _admin.GetTagAsync(tagId, ct) ?? throw new NotFoundException(nameof(Tag), tagId);

        _admin.RemoveTag(tag);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogWarning("Admin {Admin} deleted tag {Slug}", admin, tag.Slug);
    }

    private static TopPostDto ToDto(TopPost p) => new(p.Id, p.Title, p.Slug, p.Views, p.Claps, p.Comments);
}
