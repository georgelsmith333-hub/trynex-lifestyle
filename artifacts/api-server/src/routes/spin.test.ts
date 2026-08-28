import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import spinRouter from "./spin";

function app() {
  const server = express();
  server.use(express.json());
  server.use(spinRouter);
  return server;
}

describe("Spin & Win protected API boundary", () => {
  it("does not expose wallet state to anonymous callers", async () => {
    const response = await request(app()).get("/spin/state");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });

  it("does not accept malformed reservation idempotency input", async () => {
    const response = await request(app())
      .post("/spin/reserve")
      .send({ idempotencyKey: "short" });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });
});
