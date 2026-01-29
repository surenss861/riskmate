#!/usr/bin/env bash
# Build Riskmate iOS app with writable DerivedData (run in Terminal, not from Cursor sandbox).
# Usage: ./build-ios.sh   or   bash build-ios.sh

set -e
cd "$(dirname "$0")"

# Writable build dir (inside repo so sandbox-friendly if you ever run from constrained env)
DERIVED="$PWD/.xcode-build/DerivedData"
mkdir -p "$DERIVED"

echo "Building with DerivedData: $DERIVED"

# Build for device (no simulator) so CoreSimulatorService isn't required
xcodebuild \
  -project Riskmate.xcodeproj \
  -scheme Riskmate \
  -configuration Debug \
  -sdk iphoneos \
  -derivedDataPath "$DERIVED" \
  clean build

echo "Build finished successfully."
