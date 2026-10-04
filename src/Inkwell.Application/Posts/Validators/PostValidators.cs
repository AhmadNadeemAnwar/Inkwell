using FluentValidation;
using Inkwell.Application.Posts.Dtos;
using Inkwell.Domain.Common;
using Inkwell.Domain.Entities;

namespace Inkwell.Application.Posts.Validators;

public sealed class CreatePostRequestValidator : AbstractValidator<CreatePostRequest>
{
    public CreatePostRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Give your post a title.")
            .MaximumLength(Post.MaxTitleLength);

        RuleFor(x => x.Subtitle).MaximumLength(Post.MaxSubtitleLength);
        RuleFor(x => x.ContentJson).NotEmpty().WithMessage("Post content is required.");
        RuleFor(x => x.CoverImageUrl).MaximumLength(2048)
            .Must(UrlRules.IsHttps).When(x => !string.IsNullOrWhiteSpace(x.CoverImageUrl))
            .WithMessage("Cover image must be a link starting with https://.");

        RuleFor(x => x.Tags)
            .Must(tags => tags is null || tags.Count <= 5)
            .WithMessage("A post can have at most 5 tags.");
    }
}

public sealed class UpdatePostRequestValidator : AbstractValidator<UpdatePostRequest>
{
    public UpdatePostRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Give your post a title.")
            .MaximumLength(Post.MaxTitleLength);

        RuleFor(x => x.Subtitle).MaximumLength(Post.MaxSubtitleLength);
        RuleFor(x => x.ContentJson).NotEmpty().WithMessage("Post content is required.");
        RuleFor(x => x.CoverImageUrl).MaximumLength(2048)
            .Must(UrlRules.IsHttps).When(x => !string.IsNullOrWhiteSpace(x.CoverImageUrl))
            .WithMessage("Cover image must be a link starting with https://.");

        RuleFor(x => x.Tags)
            .Must(tags => tags is null || tags.Count <= 5)
            .WithMessage("A post can have at most 5 tags.");
    }
}
