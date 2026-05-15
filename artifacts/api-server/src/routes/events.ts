import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../middlewares/adminAuth";
import { adminBus, type AdminEvent } from "../lib/eventBus";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /api/admin/events
 *
 * Server-Sent Events stream for the admin panel.
 * Requires admin auth (Bearer token). Streams events as they happen:
 *   - new_order      — a buyer just placed an order
 *   - order_status_changed — status updated by admin
 *   - low_stock      — product stock dropped below threshold
 *   - ping           — keepalive every 25s
 */
router.get("/admin/events", requireAdmin, (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientIp = (req as any).ip ?? "unknown";
  req.log?.info?.({ ip: clientIp }, "admin SSE client connected");

  function send(event: AdminEvent) {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
      if (typeof (res as any).flush === "function") (res as any).flush();
    } catch {
    }
  }

  send({ type: "ping", payload: { ts: Date.now() } });

  const onEvent = (event: AdminEvent) => send(event);
  adminBus.on("event", onEvent);

  const ping = setInterval(() => {
    send({ type: "ping", payload: { ts: Date.now() } });
  }, 25_000);

  req.on("close", () => {
    clearInterval(ping);
    adminBus.off("event", onEvent);
    req.log?.info?.({ ip: clientIp }, "admin SSE client disconnected");
  });
});

export default router;
