using Inkwell.Domain.Entities;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;

namespace Inkwell.Application.Engagement;

public sealed record ClapResult(int PostClapCount, int YourClapCount);
public sealed record ToggleResult(bool IsActive);

public interface IEngagementService
{
    Task<ClapResult> ClapAsync(Guid postId, Guid userId, int amount, CancellationToken ct = default);
    Task<ToggleResult> ToggleBookmarkAsync(Guid postId, Guid userId, CancellationToken ct = default);
    Task<ToggleResult> ToggleFollowUserAsync(string handle, Guid followerId, CancellationToken ct = default);
    Task<ToggleResult> ToggleFollowTagAsync(string tagSlug, Guid userId, CancellationToken ct = default);
}

public sealed class EngagementService : IEngagementService
{
    private readonly IEngagementRepository _engagement;
    private readonly IPostRepository _posts;
    private readonly IUserRepository _users;
    private readonly ITagRepository _tags;
    private readonly IUnitOfWork _unitOfWork;

    public EngagementService(
        IEngagementRepository engagement,
        IPostRepository posts,
        IUserRepository users,
        ITagRepository tags,
        IUnitOfWork unitOfWork)
    {
        _engagement = engagement;
        _posts = posts;
        _users = users;
        _tags = tags;
        _unitOfWork = unitOfWork;
    }

    public async Task<ClapResult> ClapAsync(Guid postId, Guid userId, int amount, CancellationToken ct = default)
    {
        if (amount <= 0) throw new DomainException("Clap amount must be positive.");

        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);
        if (!post.IsVisibleTo(userId)) throw new NotFoundException(nameof(Post), postId);

        var clap = await _engagement.GetClapAsync(postId, userId, ct);

        if (clap is null)
        {
            clap = new Clap(postId, userId, amount);
            await _engagement.AddClapAsync(clap, ct);
            post.AddClaps(clap.Count);
        }
        else
        {
            // Add() clamps at the per-user ceiling and reports what was actually applied,
            // so the post total never drifts from the sum of its claps.
            var applied = clap.Add(amount);
            if (applied > 0) post.AddClaps(applied);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return new ClapResult(post.ClapCount, clap.Count);
    }

    public async Task<ToggleResult> ToggleBookmarkAsync(Guid postId, Guid userId, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);
        if (!post.IsVisibleTo(userId)) throw new NotFoundException(nameof(Post), postId);

        var bookmark = await _engagement.GetBookmarkAsync(postId, userId, ct);

        if (bookmark is null)
        {
            await _engagement.AddBookmarkAsync(new Bookmark(postId, userId), ct);
            await _unitOfWork.SaveChangesAsync(ct);
            return new ToggleResult(true);
        }

        _engagement.RemoveBookmark(bookmark);
        await _unitOfWork.SaveChangesAsync(ct);
        return new ToggleResult(false);
    }

    public async Task<ToggleResult> ToggleFollowUserAsync(string handle, Guid followerId, CancellationToken ct = default)
    {
        var target = await _users.GetByHandleAsync(handle.Trim().ToLowerInvariant(), ct)
            ?? throw new NotFoundException(nameof(User), handle);

        var follow = await _engagement.GetUserFollowAsync(followerId, target.Id, ct);

        if (follow is null)
        {
            await _engagement.AddUserFollowAsync(new UserFollow(followerId, target.Id), ct);
            await _unitOfWork.SaveChangesAsync(ct);
            return new ToggleResult(true);
        }

        _engagement.RemoveUserFollow(follow);
        await _unitOfWork.SaveChangesAsync(ct);
        return new ToggleResult(false);
    }

    public async Task<ToggleResult> ToggleFollowTagAsync(string tagSlug, Guid userId, CancellationToken ct = default)
    {
        var tag = await _tags.GetBySlugAsync(tagSlug.Trim().ToLowerInvariant(), ct)
            ?? throw new NotFoundException(nameof(Tag), tagSlug);

        var follow = await _engagement.GetTagFollowAsync(userId, tag.Id, ct);

        if (follow is null)
        {
            await _engagement.AddTagFollowAsync(new TagFollow(userId, tag.Id), ct);
            await _unitOfWork.SaveChangesAsync(ct);
            return new ToggleResult(true);
        }

        _engagement.RemoveTagFollow(follow);
        await _unitOfWork.SaveChangesAsync(ct);
        return new ToggleResult(false);
    }
}
