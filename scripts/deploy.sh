#!/usr/bin/env sh
set -eu

npm ci
npm run build

echo "Build complete. Start the private instance service with: npm run start"
