#!/bin/bash
set -e

echo "Building LodgeCore Web Application..."
cd ../../apps/web
# Build the static Front Desk bundle
npm run build:desktop

echo "Copying Static Front Desk Bundle to Desktop App..."
rm -rf ../../apps/desktop/LodgeCore.Desktop/wwwroot
mkdir -p ../../apps/desktop/LodgeCore.Desktop/wwwroot
cp -r out/* ../../apps/desktop/LodgeCore.Desktop/wwwroot/

echo "Building MAUI Desktop App..."
cd ../../apps/desktop/LodgeCore.Desktop
dotnet build -c Release

echo "Desktop build complete."
