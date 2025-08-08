#!/bin/bash

# Script to fix common Next.js build errors

echo "🔧 Fixing Next.js build errors..."

# 1. Stop any running Next.js processes
echo "Stopping Next.js processes..."
pkill -f "next dev" || true
pkill -f "next start" || true

# 2. Clean build directories
echo "Cleaning build directories..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc

# 3. Clear npm cache (optional but helpful)
echo "Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

# 4. Reinstall dependencies if needed
if [ "$1" == "--reinstall" ]; then
  echo "Reinstalling dependencies..."
  rm -rf node_modules package-lock.json
  npm install
fi

# 5. Start dev server
echo "Starting development server..."
npm run dev

echo "✅ Next.js errors should be fixed now!"