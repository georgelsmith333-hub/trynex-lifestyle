---
name: TryNex GitHub repo
description: GitHub repo owner and name — the typo was fixed by renaming on GitHub
---

## Rule
The GitHub repo is `georgelsmith333-hub/trynex-lifestyle` — the repo was renamed on GitHub
(previously `trynex-liestyle`). GitHub now 301-redirects the old name to the new one.

**Why:** The owner renamed the repo on GitHub to fix the original "liestyle" typo.

**How to apply:** Use `trynex-lifestyle` in all GitHub API calls. The old name still works via redirect (use `-L` with curl to follow it), but use the canonical name `trynex-lifestyle` going forward.

## Token info
Use `GITHUB_PERSONAL_ACCESS_TOKEN` env var (PAT with repo scope).
`GITHUB_TOKEN` (shorter, 40-char) returns 401 — use the PAT.
Owner: `georgelsmith333-hub`. Never hardcode tokens — read from environment.
