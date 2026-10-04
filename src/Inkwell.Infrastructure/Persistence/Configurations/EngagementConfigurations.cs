using Inkwell.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Inkwell.Infrastructure.Persistence.Configurations;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Body).IsRequired().HasMaxLength(Comment.MaxBodyLength);

        builder.HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Parent)
            .WithMany(c => c.Replies)
            .HasForeignKey(c => c.ParentId)
            // Replies are removed explicitly with their parent's post, not via a self-referencing cascade.
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(c => new { c.PostId, c.CreatedAt });
    }
}

public class ClapConfiguration : IEntityTypeConfiguration<Clap>
{
    public void Configure(EntityTypeBuilder<Clap> builder)
    {
        builder.ToTable("claps");
        // One row per reader per post: the composite key is what stops double-counting.
        builder.HasKey(c => new { c.PostId, c.UserId });

        builder.HasOne(c => c.Post).WithMany().HasForeignKey(c => c.PostId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class BookmarkConfiguration : IEntityTypeConfiguration<Bookmark>
{
    public void Configure(EntityTypeBuilder<Bookmark> builder)
    {
        builder.ToTable("bookmarks");
        builder.HasKey(b => new { b.PostId, b.UserId });

        builder.HasOne(b => b.Post).WithMany().HasForeignKey(b => b.PostId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(b => b.User).WithMany().HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Cascade);

        // Reading list, newest saved first.
        builder.HasIndex(b => new { b.UserId, b.CreatedAt });
    }
}

public class UserFollowConfiguration : IEntityTypeConfiguration<UserFollow>
{
    public void Configure(EntityTypeBuilder<UserFollow> builder)
    {
        builder.ToTable("user_follows");
        builder.HasKey(f => new { f.FollowerId, f.FolloweeId });

        builder.HasOne(f => f.Follower)
            .WithMany()
            .HasForeignKey(f => f.FollowerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(f => f.Followee)
            .WithMany()
            .HasForeignKey(f => f.FolloweeId)
            // Restrict on the second leg: two cascade paths into the same table is not portable.
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(f => f.FolloweeId);
    }
}

public class TagFollowConfiguration : IEntityTypeConfiguration<TagFollow>
{
    public void Configure(EntityTypeBuilder<TagFollow> builder)
    {
        builder.ToTable("tag_follows");
        builder.HasKey(f => new { f.UserId, f.TagId });

        builder.HasOne(f => f.User).WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(f => f.Tag).WithMany().HasForeignKey(f => f.TagId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(f => f.TagId);
    }
}
