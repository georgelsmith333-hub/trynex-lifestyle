import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const spinWheel = readFileSync(new URL("./SpinWheel.tsx", import.meta.url), "utf8");

describe("SpinWheel result settlement", () => {
  it("visibly rotates the wheel with CSS transform and settles from transitionend", () => {
    expect(spinWheel).toContain("transform: `rotate(${rotation}deg)`");
    expect(spinWheel).toContain("onTransitionEnd");
    expect(spinWheel).toContain("settleSpin()");
    expect(spinWheel).toContain("spinningRef.current");
    expect(spinWheel).toContain("window.requestAnimationFrame(settleSpin);");
  });

  it("still awards the pending prize if the animation callback is missed", () => {
    expect(spinWheel).toContain("SPIN_DURATION_MS + 400");
    expect(spinWheel).toContain("spinWatchdogRef.current = window.setTimeout(() => {");
    expect(spinWheel).not.toContain("The wheel animation did not finish. No reward was issued");
    expect(spinWheel).not.toContain("}, 7_000);");
  });
});
