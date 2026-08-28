import { describe, expect, it } from "vitest";
import {
  backupSyncShouldRun,
  mutationsAllowedForRole,
  schedulerShouldRun,
  shouldRejectMutation,
} from "./runtimePolicy";

describe("runtime role mutation policy", () => {
  it("allows the existing primary and an explicit promotion", () => {
    expect(mutationsAllowedForRole("primary")).toBe(true);
    expect(mutationsAllowedForRole("promoted")).toBe(true);
    expect(shouldRejectMutation("primary", "POST")).toBe(false);
    expect(shouldRejectMutation("promoted", "PATCH")).toBe(false);
  });

  it("rejects all mutation methods on standby and DR roles", () => {
    for (const role of ["standby", "dr"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(shouldRejectMutation(role, method), `${role} ${method}`).toBe(true);
      }
      expect(shouldRejectMutation(role, "GET")).toBe(false);
      expect(shouldRejectMutation(role, "HEAD")).toBe(false);
    }
  });
});

describe("scheduler and backup ownership", () => {
  it("starts the scheduler only on the canonical writer", () => {
    expect(schedulerShouldRun("promoted", undefined)).toBe(true);
    expect(schedulerShouldRun("primary", "true")).toBe(true);
    expect(schedulerShouldRun("standby", undefined)).toBe(false);
    expect(schedulerShouldRun("dr", "true")).toBe(false);
    expect(schedulerShouldRun("promoted", "false")).toBe(false);
  });

  it("never starts the full Neon mirror on standby even if the flag is copied", () => {
    expect(backupSyncShouldRun("promoted", "true")).toBe(true);
    expect(backupSyncShouldRun("standby", "true")).toBe(false);
    expect(backupSyncShouldRun("dr", "true")).toBe(false);
    expect(backupSyncShouldRun("promoted", "false")).toBe(false);
    expect(backupSyncShouldRun("primary", undefined)).toBe(false);
  });
});
