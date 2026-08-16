# Pollinations current API evidence

- Probed legacy endpoint `POST https://text.pollinations.ai/openai` on 2026-08-16 UTC with a minimal streaming chat request.
- Result: HTTP 404 from the Pollinations Express service. This explains why the current Admin AI implementation can fail before a valid model response arrives.
- Current official documentation identifies `https://gen.pollinations.ai` as the base URL and `https://gen.pollinations.ai/v1/chat/completions` as the OpenAI-compatible text route. The current docs state that generation requests require a Pollinations API key; model listing is available from `GET https://gen.pollinations.ai/v1/models`.
- `GET https://gen.pollinations.ai/v1/models` returned HTTP success and 238 catalog entries in the sandbox probe. The first returned model IDs included `openai`, `openai-large`, `mistral`, `gemini`, `llama-maverick`, `gpt-oss`, `qwen-large`, and newer provider-specific IDs.
- Conclusion: the active TryNex `text.pollinations.ai/openai` zero-key provider and hardcoded model list are stale. A production fix must use a configured server-side Pollinations key or another configured provider; it must not claim unlimited free generation or hardcode the catalog.

References:

1. https://gen.pollinations.ai/docs — current official Pollinations API documentation.
2. https://gen.pollinations.ai/v1/models — live model catalog endpoint.
3. https://raw.githubusercontent.com/pollinations/pollinations/master/APIDOCS.md — API specification and legacy endpoint documentation.
