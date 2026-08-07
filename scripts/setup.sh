#!/usr/bin/env sh
set -eu

npm ci

echo "Setup complete. Configure CARDDEMO_SOURCE_DIR or run npm run ingest to use .cache/carddemo."
