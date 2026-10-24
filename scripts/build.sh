#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "      Building File Archaeologist Desktop Application     "
echo "=========================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/3] Building React Frontend..."
cd "$ROOT_DIR/frontend"
npm install
npm run build

echo "[2/3] Checking Backend Static Bundle..."
cd "$ROOT_DIR/backend"
if [ ! -f "app/static/index.html" ]; then
    echo "Error: Static bundle was not generated."
    exit 1
fi
echo "Frontend built successfully into backend/app/static."

echo "[3/3] Running Test Suite..."
python -m pytest tests

echo "=========================================================="
echo " Build successful! Launch app with: python scripts/run_app.py"
echo "=========================================================="
