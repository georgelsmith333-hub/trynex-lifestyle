import { describe, expect, it } from "vitest";
import { getSafeTrustBadge4Copy } from "./Home";

describe("getSafeTrustBadge4Copy", () => {
  it("replaces unverified customer-count claims with the factual Studio label", () => {
    expect(
      getSafeTrustBadge4Copy("5,000+ Happy Customers", "98% satisfaction rate"),
    ).toEqual({
      iconKey: "layers",
      title: "Design Studio Ready",
      desc: "Preview artwork before checkout",
    });
  });

  it("also protects mixed-case social-proof wording", () => {
    expect(getSafeTrustBadge4Copy("Customer Trust", "Verified Satisfaction Rate"))
      .toMatchObject({
        title: "Design Studio Ready",
        desc: "Preview artwork before checkout",
      });
  });

  it("preserves non-social-proof admin copy", () => {
    expect(getSafeTrustBadge4Copy("Design Studio Ready", "Preview artwork before checkout"))
      .toEqual({
        iconKey: "users",
        title: "Design Studio Ready",
        desc: "Preview artwork before checkout",
      });
  });

  it("uses factual defaults when settings are empty", () => {
    expect(getSafeTrustBadge4Copy()).toEqual({
      iconKey: "layers",
      title: "Design Studio Ready",
      desc: "Preview artwork before checkout",
    });
  });
});
