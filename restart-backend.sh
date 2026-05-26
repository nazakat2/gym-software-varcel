#!/bin/bash

# Quick Backend Restart Script
# Run this in Git Bash or WSL

echo "🔄 Restarting Backend Server..."
echo ""

# Navigate to api-server directory
cd "H:\gym vercel\api-server" || exit 1

echo "📦 Installing dependencies (if needed)..."
npm install

echo ""
echo "🏗️ Building backend..."
npm run build

echo ""
echo "🚀 Starting development server..."
echo "Press Ctrl+C to stop"
echo ""

npm run dev
