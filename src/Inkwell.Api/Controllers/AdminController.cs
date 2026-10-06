using System.Security.Claims;
using Inkwell.Api.Common;
using Inkwell.Api.Contracts;
using Inkwell.Application.Admin;
using Inkwell.Application.Admin.Dtos;
using Inkwell.Application.Posts.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inkwell.Api.Controllers;

/// <summary>Site-wide management. Every route needs an admin session (password and one-time code).</summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = AdminRequirement.PolicyName)]
public class AdminController : ControllerBase
{
    private readonly IAdminService _admin;

    public AdminController(IAdminService admin) => _admin = admin;

    /// <summary>Who is signed in, so the portal can confirm the session is still valid.</summary>
    [HttpGet("me")]
    public ActionResult<object> Me() => Ok(new { email = Admin, displayName = User.FindFirstValue("displayName") });

    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsDto>> Stats(CancellationToken ct) =>
        Ok(await _admin.GetStatsAsync(ct));

    // ---- Posts ---------------------------------------------------------------------------

    [HttpGet("posts")]
    public async Task<ActionResult<PagedResponse<AdminPostDto>>> Posts(
        [FromQuery] string? status, [FromQuery] string? q,
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        var page = await _admin.GetPostsAsync(status, q, Math.Max(1, pageNumber), Math.Clamp(pageSize, 1, 100), ct);
        return Ok(PagedResponse<AdminPostDto>.From(page));
    }

    /// <summary>Moves any post to Draft, Published or Inactive.</summary>
    [HttpPost("posts/{id:guid}/status")]
    public async Task<IActionResult> SetPostStatus(Guid id, SetPostStatusRequest request, CancellationToken ct)
    {
        await _admin.SetPostStatusAsync(id, request.Status, Admin, ct);
        return NoContent();
    }

    /// <summary>Takes a published post offline (it becomes Inactive) without deleting it.</summary>
    [HttpPost("posts/{id:guid}/unpublish")]
    public async Task<IActionResult> Unpublish(Guid id, CancellationToken ct)
    {
        await _admin.UnpublishPostAsync(id, Admin, ct);
        return NoContent();
    }

    [HttpDelete("posts/{id:guid}")]
    public async Task<IActionResult> DeletePost(Guid id, CancellationToken ct)
    {
        await _admin.DeletePostAsync(id, Admin, ct);
        return NoContent();
    }

    // ---- Comments ------------------------------------------------------------------------

    [HttpGet("comments")]
    public async Task<ActionResult<PagedResponse<AdminCommentDto>>> Comments(
        [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        var page = await _admin.GetCommentsAsync(Math.Max(1, pageNumber), Math.Clamp(pageSize, 1, 100), ct);
        return Ok(PagedResponse<AdminCommentDto>.From(page));
    }

    [HttpDelete("comments/{id:guid}")]
    public async Task<IActionResult> DeleteComment(Guid id, CancellationToken ct)
    {
        await _admin.DeleteCommentAsync(id, Admin, ct);
        return NoContent();
    }

    // ---- Tags ----------------------------------------------------------------------------

    [HttpGet("tags")]
    public async Task<ActionResult<IReadOnlyList<AdminTagDto>>> Tags(CancellationToken ct) =>
        Ok(await _admin.GetTagsAsync(ct));

    [HttpPut("tags/{id:guid}")]
    public async Task<ActionResult<AdminTagDto>> RenameTag(Guid id, RenameTagRequest request, CancellationToken ct) =>
        Ok(await _admin.RenameTagAsync(id, request.Name, Admin, ct));

    /// <summary>Moves everything on this tag onto the target tag, then removes this one.</summary>
    [HttpPost("tags/{id:guid}/merge")]
    public async Task<IActionResult> MergeTag(Guid id, MergeTagRequest request, CancellationToken ct)
    {
        await _admin.MergeTagAsync(id, request.TargetTagId, Admin, ct);
        return NoContent();
    }

    [HttpDelete("tags/{id:guid}")]
    public async Task<IActionResult> DeleteTag(Guid id, CancellationToken ct)
    {
        await _admin.DeleteTagAsync(id, Admin, ct);
        return NoContent();
    }

    private string Admin => User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? "unknown";
}
