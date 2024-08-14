#!/usr/bin/env bash
set -euo pipefail
# Bundles and installs a local version of Cursorless, uninstalling production
# Cursorless first and using a special extension id to break update chain

# 1. Build local cursorless, using special extension id to break update chain
pnpm esbuild:prod
pnpm -F cheatsheet-local build:prod
pnpm -F cursorless-vscode-tutorial-webview build
pnpm populate-dist --local-install

# 2. Bundle the extension
cd dist
vsce package -o ../bundle.vsix

# 3. Uninstall production cursorless
code --uninstall-extension pokey.cursorless || echo "Cursorless not currently installed"

# 4. Install local Cursorless
realpath ../bundle.vsix
echo ""
echo -e "\e[1;32mInstalling local Cursorless to VSCode...\e[0m"
code --install-extension ../bundle.vsix --force

if command -v code-insiders &> /dev/null; then
  echo ""
  echo -e "\e[1;32mInstalling local Cursorless to VSCode Insiders...\e[0m"
  code-insiders --install-extension ../bundle.vsix --force
else
  echo -e "\e[1;33mVSCode Insiders not found, skipping...\e[0m"
fi

#if command -v cursor &> /dev/null; then
#  echo -e "\e[1;32mInstalling local Cursorless to Cursor...\e[0m"
#  cursor --install-extension ../bundle.vsix --force
#else
#  echo -e "\e[1;33mCursor not found, skipping...\e[0m"
#fi

echo ""
echo -e "\e[1;32mPlease restart VSCode\e[0m"
echo "To uninstall and revert to production Cursorless, run the adjacent uninstall-local.sh"
