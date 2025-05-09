#!/bin/bash
set -ex  # Enable verbose output

# Install system dependencies
apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Debug: Check if libGL.so.1 exists
find /usr -name "libGL.so.1" 2>/dev/null || echo "libGL not found!"

# Install Python dependencies
pip install --no-cache-dir -r requirements.txt

# Run the app
gunicorn --bind 0.0.0.0:$PORT your_app:app