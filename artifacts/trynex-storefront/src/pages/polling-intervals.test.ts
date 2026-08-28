import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const account = readFileSync(new URL("./Account.tsx", import.meta.url), "utf8");
const track = readFileSync(new URL("./TrackOrder.tsx", import.meta.url), "utf8");
const navbar = readFileSync(new URL("../components/layout/Navbar.tsx", import.meta.url), "utf8");
const viewers = readFileSync(new URL("../components/ViewerCount.tsx", import.meta.url), "utf8");

describe("storefront polling is no longer a 5 GB chatty client", () => {
  it("slows account unread and open-chat polling", () => {
    expect(account).toContain("setInterval(fetchUnreadCount, 30000)");
    expect(account).toContain("setInterval(() => fetchMessages(selectedOrderId), 15000)");
    expect(account).not.toContain("setInterval(fetchUnreadCount, 8000)");
  });

  it("slows public track-order polling", () => {
    expect(track).toContain("setInterval(poll, 30000)");
    expect(track).not.toContain("setInterval(poll, 12000)");
  });

  it("slows navbar notification polling and product viewer heartbeats", () => {
    expect(navbar).toContain("}, 60000)");
    expect(viewers).toContain("setInterval(heartbeat, 90_000)");
  });
});
