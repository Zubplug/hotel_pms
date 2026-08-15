#!/bin/bash
set -e

echo "Building LodgeCore Web Application..."
cd ../../apps/web
# In a real pipeline, we will build the Next.js standalone server
# and copy it to the MAUI app's resources folder.
npm run build

echo "Copying Standalone Server to Desktop App..."
mkdir -p ../../apps/desktop/LodgeCore.Desktop/Resources/Raw/server
cp -r .next/standalone/* ../../apps/desktop/LodgeCore.Desktop/Resources/Raw/server/
cp -r public ../../apps/desktop/LodgeCore.Desktop/Resources/Raw/server/public
cp -r .next/static ../../apps/desktop/LodgeCore.Desktop/Resources/Raw/server/.next/static

echo "Building MAUI Desktop App..."
cd ../../apps/desktop/LodgeCore.Desktop
dotnet build -c Release

echo "Desktop build complete."
