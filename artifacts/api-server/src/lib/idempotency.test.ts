import { describe, expect, it } from "vitest";
import { isUniqueViolation, normalizeIdempotencyKey } from "./idempotency";

describe("normalizeIdempotencyKey", () => {
  it("accepts a UUID and similar checkout keys", () => {
    expect(normalizeIdempotencyKey("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(normalizeIdempotencyKey("tn-order-01")).toBe("tn-order-01");
  });

  it("rejects missing, short, or unsafe values", () => {
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey("abc")).toBeNull();
    expect(normalizeIdempotencyKey("has space in key!!")).toBeNull();
  });
});

describe("isUniqueViolation", () => {
  it("matches a postgres 23505 on the idempotency index", () => {
    expect(isUniqueViolation({ code: "23505", constraint: "orders_idempotency_key_uidx" }, "orders_idempotency_key_uidx")).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505", constraint: "orders_idempotency_key_uidx" } }, "orders_idempotency_key_uidx")).toBe(true);
    expect(isUniqueViolation({ code: "23505", constraint: "orders_order_number_key" }, "orders_idempotency_key_uidx")).toBe(false);
    expect(isUniqueViolation(new Error("STOCK_OUT"), "orders_idempotency_key_uidx")).toBe(false);
  });
});
