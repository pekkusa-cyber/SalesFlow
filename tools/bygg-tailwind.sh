#!/bin/sh
# Bygger om tailwind.css. Kör när du lagt till nya Tailwind-klasser (t.ex. "px-3", "bg-slate-50") i HTML eller JS.
# Kräver node. Installerar Tailwind 3 i en tillfällig mapp, rör inte projektets package.json.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
cd "$T"
npm init -y >/dev/null 2>&1
npm install --silent --no-audit --no-fund tailwindcss@3.4.17
cat > tailwind.config.js <<CFG
module.exports = { content: ['$HERE/index.html', '$HERE/script.js', '$HERE/fx.js', '$HERE/fxsidor.js', '$HERE/fxkal.js', '$HERE/fxangra.js'], theme: { extend: {} }, plugins: [] };
CFG
echo '@tailwind base; @tailwind components; @tailwind utilities;' > in.css
./node_modules/.bin/tailwindcss -c tailwind.config.js -i in.css -o "$HERE/tailwind.css" --minify
echo "Klart: $HERE/tailwind.css"
