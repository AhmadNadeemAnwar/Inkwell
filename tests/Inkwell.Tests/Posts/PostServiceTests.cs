using FluentAssertions;
using Inkwell.Application.Posts;
using Inkwell.Application.Posts.Dtos;
using Inkwell.Domain.Exceptions;
using Xunit;

namespace Inkwell.Tests.Posts;

public class PostServiceTests : IDisposable
{
    private readonly TestDatabase _fixture = new();
    private readonly PostService _service;

    public PostServiceTests()
    {
        _service = new PostService(_fixture.Posts, _fixture.Tags, _fixture.Engagement, _fixture.Db);
    }

    private static CreatePostRequest NewRequest(
        string title = "A thoughtful title",
        string body = "Some words that make up the body of the post.",
        params string[] tags) =>
        new(title, null, TestDatabase.Document(body), null, tags);

    [Fact]
    public async Task CreateDraft_derives_plain_text_from_the_editor_document()
    {
        var author = await _fixture.AddUserAsync();

        var created = await _service.CreateDraftAsync(NewRequest(), author.Id);

        created.Status.Should().Be("Draft");
        created.Slug.Should().BeNull();

        var stored = await _fixture.Posts.GetByIdAsync(created.Id);
        stored!.PlainText.Should().Be("Some words that make up the body of the post.");
    }

    [Fact]
    public async Task Publish_assigns_a_slug_derived_from_the_title()
    {
        var author = await _fixture.AddUserAsync();
        var draft = await _service.CreateDraftAsync(NewRequest("Hello, World!"), author.Id);

        var published = await _service.PublishAsync(draft.Id, author.Id);

        published.Status.Should().Be("Published");
        published.Slug.Should().Be("hello-world");
    }

    [Fact]
    public async Task Publishing_a_duplicate_title_produces_a_distinct_slug()
    {
        var author = await _fixture.AddUserAsync();

        var first = await _service.CreateDraftAsync(NewRequest("Same Title"), author.Id);
        await _service.PublishAsync(first.Id, author.Id);

        var second = await _service.CreateDraftAsync(NewRequest("Same Title"), author.Id);
        var publishedSecond = await _service.PublishAsync(second.Id, author.Id);

        publishedSecond.Slug.Should().StartWith("same-title-");
        publishedSecond.Slug.Should().NotBe("same-title");
    }

    [Fact]
    public async Task Publishing_increments_the_post_count_of_each_tag()
    {
        var author = await _fixture.AddUserAsync();
        var draft = await _service.CreateDraftAsync(NewRequest(tags: ["Engineering", "Careers"]), author.Id);

        // Drafts are unlisted, so they must not inflate topic counts.
        (await _fixture.Tags.GetBySlugAsync("engineering"))!.PostCount.Should().Be(0);

        await _service.PublishAsync(draft.Id, author.Id);

        (await _fixture.Tags.GetBySlugAsync("engineering"))!.PostCount.Should().Be(1);
        (await _fixture.Tags.GetBySlugAsync("careers"))!.PostCount.Should().Be(1);
    }

    [Fact]
    public async Task Unpublishing_gives_the_tag_count_back()
    {
        var author = await _fixture.AddUserAsync();
        var draft = await _service.CreateDraftAsync(NewRequest(tags: ["Engineering"]), author.Id);
        await _service.PublishAsync(draft.Id, author.Id);

        await _service.UnpublishAsync(draft.Id, author.Id);

        (await _fixture.Tags.GetBySlugAsync("engineering"))!.PostCount.Should().Be(0);
    }

    [Fact]
    public async Task Editing_a_post_snapshots_the_previous_body_as_a_revision()
    {
        var author = await _fixture.AddUserAsync();
        var draft = await _service.CreateDraftAsync(NewRequest(body: "The original body."), author.Id);

        await _service.UpdateAsync(
            draft.Id,
            new UpdatePostRequest("A thoughtful title", null, TestDatabase.Document("A rewritten body."), null, []),
            author.Id);

        var revisions = await _service.GetRevisionsAsync(draft.Id, author.Id);
        revisions.Should().HaveCount(1);

        var stored = await _fixture.Posts.GetByIdAsync(draft.Id);
        stored!.PlainText.Should().Be("A rewritten body.");
    }

    [Fact]
    public async Task A_post_cannot_be_edited_by_someone_else()
    {
        var author = await _fixture.AddUserAsync("author");
        var stranger = await _fixture.AddUserAsync("stranger");
        var draft = await _service.CreateDraftAsync(NewRequest(), author.Id);

        var act = () => _service.UpdateAsync(
            draft.Id,
            new UpdatePostRequest("Hijacked", null, TestDatabase.Document("nope"), null, []),
            stranger.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Search_matches_words_from_the_body_and_excludes_drafts()
    {
        var author = await _fixture.AddUserAsync();

        var published = await _service.CreateDraftAsync(NewRequest("Published", "A note about hydroponics."), author.Id);
        await _service.PublishAsync(published.Id, author.Id);

        await _service.CreateDraftAsync(NewRequest("Unpublished", "Also about hydroponics."), author.Id);

        var results = await _service.SearchAsync(new PostQueryParameters { Q = "hydroponics" });

        results.TotalCount.Should().Be(1);
        results.Items.Single().Title.Should().Be("Published");
    }

    [Fact]
    public async Task Search_treats_wildcard_characters_as_literal_input()
    {
        var author = await _fixture.AddUserAsync();

        var plain = await _service.CreateDraftAsync(NewRequest("Growth", "Revenue grew by half."), author.Id);
        await _service.PublishAsync(plain.Id, author.Id);

        var percent = await _service.CreateDraftAsync(NewRequest("Margins", "Margins improved by 100% this year."), author.Id);
        await _service.PublishAsync(percent.Id, author.Id);

        // A bare "%" would match every row if it reached SQL as a wildcard.
        var results = await _service.SearchAsync(new PostQueryParameters { Q = "%" });

        results.Items.Select(p => p.Title).Should().Equal("Margins");
    }

    [Fact]
    public async Task Search_ignores_letter_case()
    {
        var author = await _fixture.AddUserAsync();
        var draft = await _service.CreateDraftAsync(NewRequest("Notes on Postgres", "Pooling matters."), author.Id);
        await _service.PublishAsync(draft.Id, author.Id);

        (await _service.SearchAsync(new PostQueryParameters { Q = "POSTGRES" })).TotalCount.Should().Be(1);
        (await _service.SearchAsync(new PostQueryParameters { Q = "pooling" })).TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task A_draft_is_not_readable_by_slug_for_other_readers()
    {
        var author = await _fixture.AddUserAsync("author");
        var reader = await _fixture.AddUserAsync("reader");

        var draft = await _service.CreateDraftAsync(NewRequest("Secret Notes"), author.Id);
        await _service.PublishAsync(draft.Id, author.Id);
        await _service.UnpublishAsync(draft.Id, author.Id);

        var act = () => _service.GetBySlugAsync("secret-notes", reader.Id);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Reading_a_post_counts_a_view_for_everyone_except_its_author()
    {
        var author = await _fixture.AddUserAsync("author");
        var reader = await _fixture.AddUserAsync("reader");

        var draft = await _service.CreateDraftAsync(NewRequest("Counting Views"), author.Id);
        await _service.PublishAsync(draft.Id, author.Id);

        await _service.GetBySlugAsync("counting-views", author.Id);
        (await _fixture.Posts.GetByIdAsync(draft.Id))!.ViewCount.Should().Be(0);

        await _service.GetBySlugAsync("counting-views", reader.Id);
        (await _fixture.Posts.GetByIdAsync(draft.Id))!.ViewCount.Should().Be(1);
    }

    [Fact]
    public async Task Related_posts_are_ranked_by_shared_tags_and_exclude_the_source()
    {
        var author = await _fixture.AddUserAsync();

        var source = await _service.CreateDraftAsync(NewRequest("Source", tags: ["Engineering", "Careers"]), author.Id);
        await _service.PublishAsync(source.Id, author.Id);

        var twoShared = await _service.CreateDraftAsync(NewRequest("Two shared", tags: ["Engineering", "Careers"]), author.Id);
        await _service.PublishAsync(twoShared.Id, author.Id);

        var oneShared = await _service.CreateDraftAsync(NewRequest("One shared", tags: ["Engineering"]), author.Id);
        await _service.PublishAsync(oneShared.Id, author.Id);

        var unrelated = await _service.CreateDraftAsync(NewRequest("Unrelated", tags: ["Baking"]), author.Id);
        await _service.PublishAsync(unrelated.Id, author.Id);

        var related = await _service.GetRelatedAsync(source.Id);

        related.Select(r => r.Title).Should().Equal("Two shared", "One shared");
    }

    [Fact]
    public async Task Tags_removed_from_a_published_post_lose_their_count()
    {
        var author = await _fixture.AddUserAsync();
        var draft = await _service.CreateDraftAsync(NewRequest(tags: ["Engineering", "Careers"]), author.Id);
        await _service.PublishAsync(draft.Id, author.Id);

        await _service.UpdateAsync(
            draft.Id,
            new UpdatePostRequest("A thoughtful title", null, TestDatabase.Document("body"), null, ["Engineering"]),
            author.Id);

        (await _fixture.Tags.GetBySlugAsync("engineering"))!.PostCount.Should().Be(1);
        (await _fixture.Tags.GetBySlugAsync("careers"))!.PostCount.Should().Be(0);
    }

    public void Dispose() => _fixture.Dispose();
}
