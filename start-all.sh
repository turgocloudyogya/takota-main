#!/bin/bash

# Start Takota Full Stack (Backend + Frontend)

echo "🚀 Starting Takota Full Stack Application"
echo "=========================================="
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo "📦 Starting Backend Server..."
./start-backend.sh &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo ""
echo "📦 Starting Frontend Server..."
./start-frontend.sh &
FRONTEND_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
