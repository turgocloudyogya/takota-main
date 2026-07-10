#!/bin/bash

# Start Takota Backend Server

echo "🚀 Starting Takota Backend..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  File .env tidak ditemukan!"
    echo "📝 Menyalin dari .env.example..."
    cp .env.example .env
    echo "✅ File .env dibuat. Silakan edit konfigurasi di .env"
    echo ""
    exit 1
fi

# Check if go.mod dependencies are installed
if [ ! -d "vendor" ] && [ ! -f "go.sum" ]; then
    echo "📦 Installing Go dependencies..."
    go mod tidy
fi

# Run the server
echo "🎯 Running server on http://localhost:8080"
echo "📖 API Docs: http://localhost:8080/api"
echo ""
echo "Press Ctrl+C to stop"
echo ""

go run cmd/api/main.go
