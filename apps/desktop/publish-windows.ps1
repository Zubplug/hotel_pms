# Build and Publish LodgeCore Windows Installer (MSIX)
param (
    [string]$Version = "1.0.0.0"
)

$ErrorActionPreference = "Stop"

Write-Host "Building LodgeCore Desktop Installer (Version $Version)..." -ForegroundColor Cyan

cd LodgeCore.Desktop

# We need to build the signed MSIX package using the MAUI framework
dotnet publish -f net8.0-windows10.0.19041.0 -c Release /p:RuntimeIdentifierOverride=win10-x64 /p:AppxPackageSigningEnabled=true /p:PackageCertificateThumbprint="YOUR_CERT_THUMBPRINT_HERE" /p:Version=$Version

Write-Host "✅ MSIX Installer generated successfully!" -ForegroundColor Green
Write-Host "Output located in: LodgeCore.Desktop/bin/Release/net8.0-windows10.0.19041.0/win10-x64/AppPackages" -ForegroundColor Yellow
