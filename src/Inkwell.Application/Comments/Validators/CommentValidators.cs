using FluentValidation;
using Inkwell.Application.Comments.Dtos;
using Inkwell.Domain.Entities;

namespace Inkwell.Application.Comments.Validators;

public sealed class CreateCommentRequestValidator : AbstractValidator<CreateCommentRequest>
{
    public CreateCommentRequestValidator()
    {
        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("Write something before posting.")
            .MaximumLength(Comment.MaxBodyLength);
    }
}

public sealed class UpdateCommentRequestValidator : AbstractValidator<UpdateCommentRequest>
{
    public UpdateCommentRequestValidator()
    {
        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("Write something before posting.")
            .MaximumLength(Comment.MaxBodyLength);
    }
}
