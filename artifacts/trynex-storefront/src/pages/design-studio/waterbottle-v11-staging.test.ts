import { describe, expect, it } from "vitest";
import {
  validateWaterBottleV11StagingRecord,
  VERIFIED_WATER_BOTTLE_V11_STAGING_RECORD,
  type WaterBottleV11StagingRecord,
} from "./waterbottle-v11-staging";

function stagingRecord(): WaterBottleV11StagingRecord {
  return structuredClone(VERIFIED_WATER_BOTTLE_V11_STAGING_RECORD);
}

describe("Water Bottle v1.1 staging evidence", () => {
  it("accepts the complete neutral Front/Back staging evidence", () => {
    expect(() => validateWaterBottleV11StagingRecord(stagingRecord())).not.toThrow();
  });

  it("rejects any attempt to turn staging evidence into a runtime activation", () => {
    const record = stagingRecord();
    record.runtimeActivationAllowed = true as false;
    expect(() => validateWaterBottleV11StagingRecord(record)).toThrow("cannot enable runtime activation");
  });

  it("rejects fixed care, capacity, material, or safety claims", () => {
    const record = stagingRecord();
    record.surfaces[1] = { ...record.surfaces[1], fixedProductClaims: ["BPA FREE · 500 ML"] };
    expect(() => validateWaterBottleV11StagingRecord(record)).toThrow("must not contain fixed product claims");
  });

  it("rejects source-hash drift and missing customer faces", () => {
    const drifted = stagingRecord();
    drifted.surfaces[0] = { ...drifted.surfaces[0], sourcePsdSha256: "a".repeat(64) };
    expect(() => validateWaterBottleV11StagingRecord(drifted)).toThrow("source hashes do not match");

    const incomplete = stagingRecord();
    incomplete.surfaces = [incomplete.surfaces[0]];
    expect(() => validateWaterBottleV11StagingRecord(incomplete)).toThrow("exactly one Front and one Back");
  });
});
