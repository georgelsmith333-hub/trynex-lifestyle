---
name: TryNex GitHub repo quirk
description: The GitHub repo has a typo in its name — "liestyle" not "lifestyle"
---

## Rule
The GitHub repo is `georgelsmith333-hub/trynex-liestyle` — note "liestyle" (missing the "f").

**Why:** The repo was created with this typo and cannot be renamed without breaking CI/CD secrets/deploy configs.

**How to apply:** Always use `trynex-liestyle` in any GitHub API call, Actions URL, or repo reference. Never autocorrect to "lifestyle".

## Token info
The working GitHub token belongs to `georgelsmith333-hub`. Never hardcode tokens — read from environment or ask user.
