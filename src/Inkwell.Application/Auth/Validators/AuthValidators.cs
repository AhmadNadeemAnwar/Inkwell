using FluentValidation;
using Inkwell.Application.Auth.Dtos;

namespace Inkwell.Application.Auth.Validators;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(254);

        RuleFor(x => x.Handle)
            .NotEmpty().WithMessage("Handle is required.")
            .MinimumLength(3).WithMessage("Handle must be at least 3 characters.")
            .MaximumLength(30)
            .Matches("^[a-zA-Z0-9_-]+$")
            .WithMessage("Handle can only contain letters, numbers, hyphens and underscores.");

        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Display name is required.")
            .MaximumLength(60);

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .MaximumLength(128);
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}
