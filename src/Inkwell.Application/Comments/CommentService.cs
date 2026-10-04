using Inkwell.Application.Comments.Dtos;
using Inkwell.Application.Posts.Mapping;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Exceptions;
using Inkwell.Domain.Interfaces;

namespace Inkwell.Application.Comments;

public interface ICommentService
{
    Task<IReadOnlyList<CommentDto>> GetThreadAsync(Guid postId, CancellationToken ct = default);
    Task<CommentDto> AddAsync(Guid postId, CreateCommentRequest request, Guid authorId, CancellationToken ct = default);
    Task<CommentDto> UpdateAsync(Guid commentId, UpdateCommentRequest request, Guid editorId, CancellationToken ct = default);
    Task DeleteAsync(Guid commentId, Guid requesterId, CancellationToken ct = default);
}

public sealed class CommentService : ICommentService
{
    private readonly ICommentRepository _comments;
    private readonly IPostRepository _posts;
    private readonly IUnitOfWork _unitOfWork;

    public CommentService(ICommentRepository comments, IPostRepository posts, IUnitOfWork unitOfWork)
    {
        _comments = comments;
        _posts = posts;
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<CommentDto>> GetThreadAsync(Guid postId, CancellationToken ct = default)
    {
        var thread = await _comments.GetThreadAsync(postId, ct);
        return thread.Select(c => c.ToDto()).ToList();
    }

    public async Task<CommentDto> AddAsync(Guid postId, CreateCommentRequest request, Guid authorId, CancellationToken ct = default)
    {
        var post = await _posts.GetByIdAsync(postId, ct) ?? throw new NotFoundException(nameof(Post), postId);
        if (!post.IsVisibleTo(authorId)) throw new NotFoundException(nameof(Post), postId);

        if (request.ParentId is { } parentId)
        {
            var parent = await _comments.GetByIdAsync(parentId, ct)
                ?? throw new NotFoundException(nameof(Comment), parentId);

            if (parent.PostId != postId) throw new DomainException("The parent comment belongs to a different post.");
            // Threads are capped at one level: replying to a reply attaches to its top-level parent.
            if (parent.ParentId is { } grandparentId) request = request with { ParentId = grandparentId };
        }

        var comment = new Comment(postId, authorId, request.Body, request.ParentId);
        await _comments.AddAsync(comment, ct);
        post.IncrementCommentCount();
        await _unitOfWork.SaveChangesAsync(ct);

        var saved = await _comments.GetByIdAsync(comment.Id, ct)!;
        return saved!.ToDto();
    }

    public async Task<CommentDto> UpdateAsync(Guid commentId, UpdateCommentRequest request, Guid editorId, CancellationToken ct = default)
    {
        var comment = await _comments.GetByIdAsync(commentId, ct)
            ?? throw new NotFoundException(nameof(Comment), commentId);

        comment.Edit(request.Body, editorId);
        await _unitOfWork.SaveChangesAsync(ct);

        return comment.ToDto();
    }

    public async Task DeleteAsync(Guid commentId, Guid requesterId, CancellationToken ct = default)
    {
        var comment = await _comments.GetByIdAsync(commentId, ct)
            ?? throw new NotFoundException(nameof(Comment), commentId);

        var post = await _posts.GetByIdAsync(comment.PostId, ct);

        // The comment's author or the post's author may remove it.
        if (comment.AuthorId != requesterId && post?.AuthorId != requesterId)
            throw new ForbiddenException("You cannot delete this comment.");

        if (comment.IsDeleted) return;

        comment.SoftDelete();
        post?.DecrementCommentCount();
        await _unitOfWork.SaveChangesAsync(ct);
    }
}
