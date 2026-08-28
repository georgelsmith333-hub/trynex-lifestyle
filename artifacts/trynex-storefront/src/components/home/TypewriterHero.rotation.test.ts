import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readHeroSource() {
  return readFileSync(new URL("./TypewriterHero.tsx", import.meta.url), "utf8");
}

describe("Home hero keyword rotation", () => {
  it("retains the complete customer-facing product phrase sequence", () => {
    const source = readHeroSource();

    expect(source).toContain('"T-Shirts."');
    expect(source).toContain('"Hoodies."');
    expect(source).toContain('"Mugs."');
    expect(source).toContain('"Caps."');
    expect(source).toContain('"Water Bottles."');
    expect(source).toContain('"Custom Gifts."');
  });

  it("resets safely after configured phrases change and keeps cycling under reduced motion", () => {
    const source = readHeroSource();

    expect(source).toContain("indexRef.current = 0;");
    expect(source).toContain("setText(safe[0]);");
    expect(source).toContain('setPhase("holding");');
    expect(source).toContain("if (enabled) return;");
    expect(source).toContain("const id = window.setInterval(() => {");
    expect(source).toContain("custom.length >= 2 ? custom : DEFAULT_PHRASES");
    expect(source).toContain("animation: reduced ? undefined : \"twCursorBlink 1s steps(2, start) infinite\"");
  });

  it("cycles a distinct color for each product phrase", () => {
    const source = readHeroSource();
    expect(source).toContain("const PHRASE_COLORS");
    expect(source).toContain("color: typedColor");
    expect(source).toContain("#7c3aed");
    expect(source).toContain("#0ea5e9");
  });
});
