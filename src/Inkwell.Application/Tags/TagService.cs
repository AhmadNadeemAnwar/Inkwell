using Inkwell.Application.Posts.Dtos;
using Inkwell.Application.Posts.Mapping;
using Inkwell.Domain.Interfaces;

namespace Inkwell.Application.Tags;

public interface ITagService
{
    Task<IReadOnlyList<TagDto>> GetPopularAsync(int limit = 20, CancellationToken ct = default);
    Task<IReadOnlyList<TagDto>> SuggestAsync(string term, int limit = 10, CancellationToken ct = default);
    Task<IReadOnlyList<TagDto>> GetFollowedAsync(Guid userId, CancellationToken ct = default);
}

public sealed class TagService : ITagService
{
    private readonly ITagRepository _tags;

    public TagService(ITagRepository tags) => _tags = tags;

    public async Task<IReadOnlyList<TagDto>> GetPopularAsync(int limit = 20, CancellationToken ct = default)
    {
        var tags = await _tags.GetPopularAsync(Math.Clamp(limit, 1, 100), ct);
        return tags.Select(t => t.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<TagDto>> SuggestAsync(string term, int limit = 10, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(term)) return [];

        var tags = await _tags.SearchAsync(term.Trim(), Math.Clamp(limit, 1, 25), ct);
        return tags.Select(t => t.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<TagDto>> GetFollowedAsync(Guid userId, CancellationToken ct = default)
    {
        var tags = await _tags.GetFollowedByAsync(userId, ct);
        return tags.Select(t => t.ToDto()).ToList();
    }
}
