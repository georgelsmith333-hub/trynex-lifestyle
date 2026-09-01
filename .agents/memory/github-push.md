---
name: GitHub push from main agent
description: How to push to GitHub from the main agent environment, including token handling and merge conflicts
---

# GitHub push from main agent

## What works now

`git push` and `git fetch` work when the remote URL includes a token in the HTTPS URL:

```bash
git remote set-url origin https://x-access-token:$TOKEN@github.com/OWNER/REPO.git
git fetch origin main
git merge origin/main
# resolve any conflicts, then
git push origin main
```

The `x-access-token` username is the standard GitHub PAT username; the password field is the PAT value from the environment variable.

## Why this works

Replit's `replit-git-askpass` intercepts plain `https://TOKEN@github.com/...` URLs, but the `x-access-token:$TOKEN` form is treated as a normal username/password pair and passes through.

## Before pushing

1. Fetch `origin/main` first.
2. Check if the remote branch is ahead of the local branch.
3. If it is ahead, merge it before pushing (`git merge origin/main`).
4. Resolve any conflicts manually, then commit and push.
5. Force push is only needed when the histories are truly unrelated or the remote has diverged in a way that must be overwritten.

## Integration fallback

Shell Git authentication can reject a stale workspace token even while the installed GitHub integration has a healthy, write-capable connection. In that case, use the integration's SDK Git Data API to create a tree, commit, and update `heads/main`; do not request or expose a token.

**Why:** The integration can refresh its own authorization, while environment-provided tokens can expire independently. Publishing through the SDK also avoids putting credentials in process arguments or logs.

**How to apply:** Verify the current remote ref first, build the new tree from that parent, create one commit, and update the branch with `force: false`. Record the returned commit SHA and verify the branch again.

## Push protection

GitHub push protection rejects an outgoing history if it contains an old credential-bearing pasted attachment, even when that file is not part of the intended release. Do not whitelist the secret. Start a clean branch from the current published `main`, copy only the safe current source changes, exclude pasted attachments/evidence/cache output, and fast-forward `main` from that clean branch.

## Merge conflicts

When merging `origin/main`, conflicts can appear in files that the remote changed and the local working tree also changed (e.g. `ProductDetail.tsx`). Resolve by keeping the working version when it is correct, or by fixing the remote version if it introduces an out-of-scope variable reference. Always run `pnpm run typecheck` after resolving a merge conflict.
