using Inkwell.Api.Contracts;
using Inkwell.Application.Comments;
using Inkwell.Application.Comments.Dtos;
using Inkwell.Application.Common;
using Inkwell.Application.Engagement;
using Inkwell.Application.Posts;
using Inkwell.Application.Posts.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inkwell.Api.Controllers;

[ApiController]
[Route("api/v1/posts")]
public class PostsController : ControllerBase
{
    private readonly IPostService _posts;
    private readonly ICommentService _comments;
    private readonly IEngagementService _engagement;
    private readonly ICurrentUser _currentUser;

    public PostsController(
        IPostService posts,
        ICommentService comments,
        IEngagementService engagement,
        ICurrentUser currentUser)
    {
        _posts = posts;
        _comments = comments;
        _engagement = engagement;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Browse and search published posts. Supports free text (<c>q</c>), tag, author,
    /// sort order and paging.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResponse<PostSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<PostSummaryDto>>> Search([FromQuery] PostQueryParameters parameters, CancellationToken ct) =>
        Ok(PagedResponse<PostSummaryDto>.From(await _posts.SearchAsync(parameters, ct)));

    /// <summary>Posts from the writers and topics the signed-in reader follows.</summary>
    [HttpGet("feed")]
    [Authorize]
    public async Task<ActionResult<PagedResponse<PostSummaryDto>>> Feed(
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _posts.GetPersonalFeedAsync(_currentUser.RequireUserId(), Math.Max(1, pageNumber), Math.Clamp(pageSize, 1, 50), ct);
        return Ok(PagedResponse<PostSummaryDto>.From(result));
    }

    [HttpGet("drafts")]
    [Authorize]
    public async Task<ActionResult<PagedResponse<PostSummaryDto>>> Drafts(
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _posts.GetDraftsAsync(_currentUser.RequireUserId(), Math.Max(1, pageNumber), Math.Clamp(pageSize, 1, 50), ct);
        return Ok(PagedResponse<PostSummaryDto>.From(result));
    }

    [HttpGet("bookmarks")]
    [Authorize]
    public async Task<ActionResult<PagedResponse<PostSummaryDto>>> Bookmarks(
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _posts.GetBookmarksAsync(_currentUser.RequireUserId(), Math.Max(1, pageNumber), Math.Clamp(pageSize, 1, 50), ct);
        return Ok(PagedResponse<PostSummaryDto>.From(result));
    }

    /// <summary>Reads a post by its canonical slug. Anonymous readers are allowed.</summary>
    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PostDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDetailDto>> GetBySlug(string slug, CancellationToken ct) =>
        Ok(await _posts.GetBySlugAsync(slug, _currentUser.UserId, ct));

    /// <summary>Loads a post by id for editing, including unpublished drafts.</summary>
    [HttpGet("{id:guid}/edit")]
    [Authorize]
    public async Task<ActionResult<PostDetailDto>> GetForEdit(Guid id, CancellationToken ct) =>
        Ok(await _posts.GetForEditAsync(id, _currentUser.RequireUserId(), ct));

    [HttpGet("{id:guid}/related")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<PostSummaryDto>>> Related(Guid id, [FromQuery] int limit = 4, CancellationToken ct = default) =>
        Ok(await _posts.GetRelatedAsync(id, Math.Clamp(limit, 1, 10), ct));

    [HttpGet("{id:guid}/revisions")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<PostRevisionDto>>> Revisions(Guid id, CancellationToken ct) =>
        Ok(await _posts.GetRevisionsAsync(id, _currentUser.RequireUserId(), 20, ct));

    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(PostDetailDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<PostDetailDto>> Create(CreatePostRequest request, CancellationToken ct)
    {
        var post = await _posts.CreateDraftAsync(request, _currentUser.RequireUserId(), ct);
        return CreatedAtAction(nameof(GetForEdit), new { id = post.Id }, post);
    }

    /// <summary>Saves an edit. The client calls this on autosave, which also writes a revision.</summary>
    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<PostDetailDto>> Update(Guid id, UpdatePostRequest request, CancellationToken ct) =>
        Ok(await _posts.UpdateAsync(id, request, _currentUser.RequireUserId(), ct));

    [HttpPost("{id:guid}/publish")]
    [Authorize]
    public async Task<ActionResult<PostDetailDto>> Publish(Guid id, CancellationToken ct) =>
        Ok(await _posts.PublishAsync(id, _currentUser.RequireUserId(), ct));

    [HttpPost("{id:guid}/unpublish")]
    [Authorize]
    public async Task<ActionResult<PostDetailDto>> Unpublish(Guid id, CancellationToken ct) =>
        Ok(await _posts.UnpublishAsync(id, _currentUser.RequireUserId(), ct));

    [HttpDelete("{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _posts.DeleteAsync(id, _currentUser.RequireUserId(), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/claps")]
    [Authorize]
    public async Task<ActionResult<ClapResult>> Clap(Guid id, [FromQuery] int amount = 1, CancellationToken ct = default) =>
        Ok(await _engagement.ClapAsync(id, _currentUser.RequireUserId(), Math.Clamp(amount, 1, 10), ct));

    [HttpPost("{id:guid}/bookmark")]
    [Authorize]
    public async Task<ActionResult<ToggleResult>> ToggleBookmark(Guid id, CancellationToken ct) =>
        Ok(await _engagement.ToggleBookmarkAsync(id, _currentUser.RequireUserId(), ct));

    [HttpGet("{id:guid}/comments")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<CommentDto>>> GetComments(Guid id, CancellationToken ct) =>
        Ok(await _comments.GetThreadAsync(id, ct));

    [HttpPost("{id:guid}/comments")]
    [Authorize]
    [ProducesResponseType(typeof(CommentDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<CommentDto>> AddComment(Guid id, CreateCommentRequest request, CancellationToken ct)
    {
        var comment = await _comments.AddAsync(id, request, _currentUser.RequireUserId(), ct);
        return Created($"/api/v1/posts/{id}/comments/{comment.Id}", comment);
    }
}
