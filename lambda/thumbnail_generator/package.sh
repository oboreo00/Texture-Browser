#!/bin/bash
# ── Package Lambda for Deployment ─────────────────────────────────────────────
# This script bundles handler.py along with dependencies (Pillow, psycopg2-binary)
# compiled for the AWS Lambda Linux environment using Docker.

set -e

# Working directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Building Lambda package..."

# Clean up old build artifacts
rm -rf package
rm -f thumbnail_generator.zip

# Create package folder
mkdir -p package

# Use Docker to install dependencies compiled for Amazon Linux
if command -v docker &> /dev/null; then
  echo "Docker detected. Building dependencies inside Amazon Linux container..."
  docker run --rm \
    -v "$DIR":/var/task \
    public.ecr.aws/sam/build-python3.12:latest-arm64 \
    pip install -r requirements.txt -t /var/task/package
else
  echo "⚠️ WARNING: Docker not found. Installing dependencies locally."
  echo "If you are on macOS, the binary packages (Pillow/psycopg2) might fail in Lambda."
  echo "Please install Docker for a guaranteed compatible build, or use a pre-built Lambda Layer."
  pip install -r requirements.txt -t ./package
fi

# Copy the handler script
cp handler.py ./package/

# Create ZIP
echo "Creating ZIP bundle..."
cd package
zip -q -r ../thumbnail_generator.zip .
cd ..

echo "Done! Created: lambda/thumbnail_generator/thumbnail_generator.zip"
echo "You can upload this file to AWS Lambda now."
