using System.Diagnostics;
using OtpNet;
using QRCoder;

// One-time helper for the admin portal's second sign-in factor.
//
//   dotnet run --project tools/Inkwell.AdminSetup -- you@example.com
//
// It makes a secret, shows it as a QR code to scan with an authenticator app (Google Authenticator,
// Authy, 1Password, Microsoft Authenticator...), checks that the app produces matching codes, and
// prints the one value to put on the host. Nothing is sent anywhere and nothing is written except a
// temporary QR image, which is deleted before this exits.

const string Issuer = "Inkwell Admin";

if (args.Contains("--check"))
{
    // Non-interactive self-test (no secret is printed): can this tool make a secret and verify its own codes?
    var key = KeyGeneration.GenerateRandomKey(20);
    var totp = new Totp(key);
    var ok = totp.VerifyTotp(totp.ComputeTotp(), out _, VerificationWindow.RfcSpecifiedNetworkDelay);
    Console.WriteLine(ok ? "Self-check passed." : "Self-check FAILED.");
    return ok ? 0 : 1;
}

var email = args.FirstOrDefault(a => !a.StartsWith("--"))?.Trim();
if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
{
    Console.WriteLine("Usage: dotnet run --project tools/Inkwell.AdminSetup -- you@example.com");
    Console.WriteLine("Use the email address of your Inkwell account.");
    return 2;
}

var secretBytes = KeyGeneration.GenerateRandomKey(20);
var secret = Base32Encoding.ToString(secretBytes);

var uri = $"otpauth://totp/{Uri.EscapeDataString(Issuer)}:{Uri.EscapeDataString(email)}" +
          $"?secret={secret}&issuer={Uri.EscapeDataString(Issuer)}&algorithm=SHA1&digits=6&period=30";

var qrPath = Path.Combine(Path.GetTempPath(), $"inkwell-admin-setup-{Guid.NewGuid():N}.png");

try
{
    using (var generator = new QRCodeGenerator())
    using (var data = generator.CreateQrCode(uri, QRCodeGenerator.ECCLevel.Q))
    {
        File.WriteAllBytes(qrPath, new PngByteQRCode(data).GetGraphic(12));
    }

    Console.WriteLine();
    Console.WriteLine("Step 1. Scan the QR code with your authenticator app.");
    Console.WriteLine($"        It is saved at: {qrPath}");
    Console.WriteLine("        (It should open by itself. This tool deletes the file when it finishes.)");
    try { Process.Start(new ProcessStartInfo(qrPath) { UseShellExecute = true }); } catch { /* the path above is enough */ }

    Console.WriteLine();
    Console.WriteLine("        Can't scan? Add it by typing this key into the app instead (time-based, 6 digits):");
    Console.WriteLine($"        {string.Join(' ', Enumerable.Range(0, (secret.Length + 3) / 4).Select(i => secret.Substring(i * 4, Math.Min(4, secret.Length - i * 4))))}");

    var totp = new Totp(secretBytes);
    var confirmed = false;

    Console.WriteLine();
    Console.WriteLine("Step 2. Prove it works: type the 6-digit code your app shows now.");

    for (var attempt = 1; attempt <= 5 && !confirmed; attempt++)
    {
        Console.Write("        Code: ");
        var code = Console.ReadLine()?.Trim().Replace(" ", "");
        if (code is null) { Console.WriteLine("No input, stopping. Nothing has been set up."); return 1; }

        confirmed = totp.VerifyTotp(code, out _, VerificationWindow.RfcSpecifiedNetworkDelay);
        Console.WriteLine(confirmed ? "        That matches." : "        That code is not right. Wait for the next one and try again.");
    }

    if (!confirmed)
    {
        Console.WriteLine("Too many wrong codes. Start again; nothing has been set up.");
        return 1;
    }

    Console.WriteLine();
    Console.WriteLine("Step 3. Give the secret to the server. On Render, open your service, then Environment,");
    Console.WriteLine("        and add these two variables (the second line is YOUR Inkwell login email):");
    Console.WriteLine();
    Console.WriteLine($"          Admin__TotpSecret = {secret}");
    Console.WriteLine($"          Admin__Emails__0  = {email}");
    Console.WriteLine();
    Console.WriteLine("Keep the secret private: anyone holding it can generate your codes. Don't paste it into");
    Console.WriteLine("chat, email or a file in the repository. If you lose your phone, run this tool again and");
    Console.WriteLine("replace the value on Render; the old secret stops working at once.");
    return 0;
}
finally
{
    try { File.Delete(qrPath); } catch { /* temp file; harmless if it lingers */ }
}
