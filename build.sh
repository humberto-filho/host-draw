#!/usr/bin/env bash
# Build the Go/WASM drawing core into web/.
set -euo pipefail

cd "$(dirname "$0")"

# Prefer project-local toolchain, fall back to system go.
if [ -x ".toolchain/go/bin/go" ]; then
    GO_BIN="$(pwd)/.toolchain/go/bin/go"
else
    GO_BIN="$(command -v go)" || { echo "go not found (expected .toolchain/go or system go)"; exit 1; }
fi

GOROOT="$("$GO_BIN" env GOROOT)"
mkdir -p web

cp "$GOROOT/lib/wasm/wasm_exec.js" web/wasm_exec.js

(cd wasm && GOOS=js GOARCH=wasm "$GO_BIN" build -o ../web/main.wasm .)

echo "Built web/main.wasm ($(du -h web/main.wasm | cut -f1)) + web/wasm_exec.js"
