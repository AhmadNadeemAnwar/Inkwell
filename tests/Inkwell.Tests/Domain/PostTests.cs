using FluentAssertions;
using Inkwell.Domain.Entities;
using Inkwell.Domain.Enums;
using Inkwell.Domain.Exceptions;
using Xunit;

namespace Inkwell.Tests.Domain;

public class PostTests
{
    private static Post NewPost(string plainText = "Some body text.", string title = "A title") =>
        new(Guid.NewGuid(), title, null, TestDatabase.Document(plainText), plainText);

    [Fact]
    public void New_post_starts_as_a_draft_with_no_slug()
    {
        var post = NewPost();

        post.Status.Should().Be(PostStatus.Draft);
        post.Slug.Should().BeNull();
        post.PublishedAt.Should().BeNull();
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(225, 1)]
    [InlineData(226, 2)]
    [InlineData(1000, 5)]
    public void Reading_time_rounds_up_and_never_reports_zero(int wordCount, int expectedMinutes)
    {
        var post = NewPost(string.Join(' ', Enumerable.Repeat("word", wordCount)));

        post.ReadingTimeMinutes.Should().Be(expectedMinutes);
    }

    [Fact]
    public void Publish_assigns_the_slug_and_timestamp()
    {
        var post = NewPost();

        post.Publish("a-title");

        post.Status.Should().Be(PostStatus.Published);
        post.Slug.Should().Be("a-title");
        post.PublishedAt.Should().NotBeNull();
    }

    [Fact]
    public void Republishing_keeps_the_original_slug_so_inbound_links_survive_a_retitle()
    {
        var post = NewPost();
        post.Publish("original-title");
        var publishedAt = post.PublishedAt;

        post.Unpublish();
        post.UpdateDraft("A completely different title", null, TestDatabase.Document("Body"), "Body", null);
        post.Publish("a-completely-different-title");

        post.Slug.Should().Be("original-title");
        post.PublishedAt.Should().Be(publishedAt);
    }

    [Fact]
    public void Publishing_twice_is_rejected()
    {
        var post = NewPost();
        post.Publish("a-title");

        var act = () => post.Publish("a-title");

        act.Should().Throw<DomainException>().WithMessage("*already published*");
    }

    [Fact]
    public void An_empty_post_cannot_be_published()
    {
        var post = new Post(Guid.NewGuid(), "Title only", null, TestDatabase.Document(""), string.Empty);

        var act = () => post.Publish("title-only");

        act.Should().Throw<DomainException>().WithMessage("*empty post*");
    }

    [Fact]
    public void Title_is_required()
    {
        var act = () => new Post(Guid.NewGuid(), "   ", null, TestDatabase.Document("body"), "body");

        act.Should().Throw<DomainException>().WithMessage("*Title is required*");
    }

    [Fact]
    public void Drafts_are_visible_only_to_their_author()
    {
        var authorId = Guid.NewGuid();
        var post = new Post(authorId, "Draft", null, TestDatabase.Document("body"), "body");

        post.IsVisibleTo(authorId).Should().BeTrue();
        post.IsVisibleTo(Guid.NewGuid()).Should().BeFalse();
        post.IsVisibleTo(null).Should().BeFalse();
    }

    [Fact]
    public void Published_posts_are_visible_to_anonymous_readers()
    {
        var post = NewPost();
        post.Publish("a-title");

        post.IsVisibleTo(null).Should().BeTrue();
    }

    [Fact]
    public void EnsureOwnedBy_rejects_a_different_user()
    {
        var post = NewPost();

        var act = () => post.EnsureOwnedBy(Guid.NewGuid());

        act.Should().Throw<ForbiddenException>();
    }

    [Fact]
    public void Excerpt_prefers_the_subtitle_when_there_is_one()
    {
        var post = new Post(Guid.NewGuid(), "Title", "The subtitle", TestDatabase.Document("Body text"), "Body text");

        post.BuildExcerpt().Should().Be("The subtitle");
    }

    [Fact]
    public void Excerpt_truncates_on_a_word_boundary()
    {
        var body = string.Join(' ', Enumerable.Repeat("alpha", 100));
        var post = NewPost(body);

        var excerpt = post.BuildExcerpt(50);

        excerpt.Should().EndWith("...");
        excerpt.Should().NotContain("alph.");
        excerpt.Length.Should().BeLessThanOrEqualTo(54);
    }

    [Fact]
    public void Comment_count_never_goes_negative()
    {
        var post = NewPost();

        post.DecrementCommentCount();

        post.CommentCount.Should().Be(0);
    }
}
