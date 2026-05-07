#!/bin/bash
# Push latest commits to GitHub using the configured PAT
# Run this from the Replit shell after the agent completes a task:
#   bash push-to-github.sh

set -e

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set. Add it in Replit Secrets."
  exit 1
fi

echo "Pushing to GitHub..."
git -c "credential.helper=!f() { printf 'username=x-access-token\npassword=%s\n' \"${GITHUB_PERSONAL_ACCESS_TOKEN}\"; }; f" \
  push https://github.com/georgelsmith333-hub/trynex-liestyle.git HEAD:main

echo "Done — GitHub is up to date."
