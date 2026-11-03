using Xunit;

namespace Davids.Frontend.Web.Tests;

[Trait("Category", "Unit")]
public sealed class ArchitectureTests
{
    [Fact]
    public void FrontendWebRemainsStatelessUiHostWithoutBackendOrPersistenceCoupling()
    {
        var assembly = typeof(Program).Assembly;
        var referencedNames = assembly.GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty)
            .ToArray();

        Assert.DoesNotContain(referencedNames, n => n.StartsWith("Davids.Services.", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(referencedNames, n => n.StartsWith("Davids.APIGateway", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(referencedNames, n => n.StartsWith("Davids.Frontend.Admin", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(referencedNames, n => n.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(referencedNames, n => n.StartsWith("OpenIddict", StringComparison.OrdinalIgnoreCase));
    }
}
