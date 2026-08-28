import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkout = readFileSync(new URL("./Checkout.tsx", import.meta.url), "utf8");
const hooks = readFileSync(new URL("../../../../lib/api-client-react/src/trynex-hooks.ts", import.meta.url), "utf8");

describe("checkout order idempotency", () => {
  it("sends a session-stable Idempotency-Key on POST /api/orders", () => {
    expect(hooks).toContain("Idempotency-Key");
    expect(hooks).toContain("getOrderIdempotencyKey");
    expect(hooks).toContain("trynex_order_idempotency_key");
  });

  it("clears the key only after a successful create so retries reuse it", () => {
    expect(checkout).toContain("clearOrderIdempotencyKey");
    const successIdx = checkout.indexOf("clearOrderIdempotencyKey()");
    const retryLoopIdx = checkout.indexOf("for (let attempt = 0");
    expect(successIdx).toBeGreaterThan(retryLoopIdx);
  });
});
