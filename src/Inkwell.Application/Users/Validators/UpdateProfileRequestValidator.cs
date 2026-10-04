using FluentValidation;
using Inkwell.Application.Users.Dtos;

namespace Inkwell.Application.Users.Validators;

public sealed class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Display name is required.")
            .MaximumLength(60);

        RuleFor(x => x.Bio).MaximumLength(300);
        RuleFor(x => x.AvatarUrl).MaximumLength(2048);
        RuleFor(x => x.WebsiteUrl).MaximumLength(2048);
    }
}
