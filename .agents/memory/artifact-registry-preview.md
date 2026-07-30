---
name: Storefront preview registration
description: The TryNex storefront can serve locally with a valid artifact manifest, but the workspace artifact registry may still return no registered artifacts.
---

The storefront's `.replit-artifact/artifact.toml` can be valid and its managed workflow can serve the app while `listArtifacts()` returns an empty list and screenshot resolution reports the artifact as missing.

**Why:** This environment state blocks artifact-pane and screenshot verification without indicating a storefront runtime failure; direct localhost HTML, workflow logs, and health checks still work.

**How to apply:** Check `listArtifacts()` before relying on `Screenshot(appPreview)`. If it is empty, do not modify the existing manifest or create a duplicate artifact; report the visual-verification limitation and use live HTTP/workflow checks instead.