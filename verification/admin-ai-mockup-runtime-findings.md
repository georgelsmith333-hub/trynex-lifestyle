# Admin AI and Mockup Gallery Runtime Findings

## Confirmed active files

- Frontend Admin AI: `artifacts/trynex-storefront/src/pages/admin/AdminAIDeveloper.tsx`
- Frontend Mockup Gallery: `artifacts/trynex-storefront/src/pages/admin/AdminMockups.tsx`
- Backend AI routes: `artifacts/api-server/src/routes/ai.ts`
- Backend mockup routes: `artifacts/api-server/src/routes/mockups.ts`

## Confirmed Mockup Gallery limitation

`AdminMockups.tsx` uses a hidden file input with `accept="image/*"`. `handleUpload()` immediately skips every file whose MIME type does not start with `image/`, uploads the remaining file through `/api/storage/uploads/request-url`, then creates a database mockup record containing only `name`, `description`, `productId`, `productName`, `imageUrl`, `tags`, `isActive`, and `sortOrder`. The edit modal exposes image URL, name, description, linked product, tags, and active state only. There is no PSD/PSB file acceptance, master-file upload, layer extraction, smart-object binding, face/color/zone metadata, manifest generation, or connection from Gallery records to the canonical `resolveMockup()` runtime resolver.

Canonical source-kit rows are marked `isCanonical` and cannot be edited/deleted through ordinary actions; the only provided operation is an image override upload. This can create a gallery image override, but it does not create a runtime v3 manifest or replace the frontend Design Studio source contract.

## Confirmed Admin AI limitation and likely error paths

`AdminAIDeveloper.tsx` defaults to provider `pollinations`, posts to `/api/ai/developer/chat`, and when a user-supplied OpenAI key exists it sends `providerId: "openai-direct"` and `model: "gpt-4o"`. The backend `ai.ts` provider list does not define `openai-direct`; it falls back to the first provider, Pollinations. This is a misleading provider contract and can create unexpected behavior.

The backend Admin AI provider list hardcodes Pollinations model names and several third-party free-tier providers. The chat handler uses direct external fetches to Pollinations/Groq/OpenRouter/Together/Hugging Face and only falls back to Pollinations when a credentialed provider fails. It does not use the project’s built-in `invokeLLM`/`listLLMModels` path, does not dynamically discover current supported model IDs, and treats model/provider errors as generic streamed error text. The screenshot’s `Error: internal_error` therefore requires live request/log reproduction, but stale provider IDs, unsupported Pollinations model behavior, malformed tool JSON, or upstream failures are all active risks.

The frontend tool parser uses the regex `/\[TOOL:\s*(\w+)\s*(\{[^}]*\}|\{\}|)\]/g`, which cannot safely parse nested JSON objects or JSON strings containing braces. The frontend also has no structured tool-call protocol; it asks the model to emit textual pseudo-tool tags and executes them afterward. This matches the screenshot’s malformed order-command symptom (`Unexpected token '<'`) as an unsafe parsing and command-contract boundary.

## Scope decision

Do not claim PSD/PSB parity until the Gallery can store a real master file or an explicit master reference, validate it, generate or update the manifest contract, and prove that Admin preview, Design Studio preview, export, cart thumbnails, and 3D use the same face/color/zone binding. Do not claim Admin AI reliability until provider discovery, request schema, tool execution validation, authentication, and error normalization are fixed and tested against the actual live endpoint.
