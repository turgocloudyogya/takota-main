#!/bin/bash

# Start Takota Frontend

echo "🚀 Starting Takota Frontend..."

cd web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Run the dev server
echo "🎯 Frontend akan berjalan di http://localhost:5173"
echo "🔗 Backend default: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
