# Build and Publish LodgeCore Windows Installer (MSIX)
# Usage: .\publish-windows.ps1 -Version 1.2.27.0 -CertThumbprint <thumbprint>
param (
    [string]$Version = "1.2.27.0",          # Keep in sync with csproj ApplicationDisplayVersion
    [Parameter(Mandatory=$true)]
    [string]$CertThumbprint                  # Must be provided — no silent default
)

$ErrorActionPreference = "Stop"

Write-Host "Building LodgeCore Desktop Installer (Version $Version)..." -ForegroundColor Cyan

cd LodgeCore.Desktop

# Target net10.0 (matches csproj TargetFramework) and win10-x86 (matches hardware SDK requirement)
dotnet publish `
  -f net10.0-windows10.0.19041.0 `
  -c Release `
  /p:RuntimeIdentifierOverride=win10-x86 `
  /p:GenerateAppxPackageOnBuild=true `
  /p:AppxPackageSigningEnabled=true `
  "/p:PackageCertificateThumbprint=$CertThumbprint" `
  "/p:Version=$Version" `
  "/p:ApplicationVersion=$Version"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "✅ MSIX Installer generated successfully!" -ForegroundColor Green
Write-Host "Output located in: LodgeCore.Desktop/bin/Release/net10.0-windows10.0.19041.0/win10-x86/AppPackages" -ForegroundColor Yellow
