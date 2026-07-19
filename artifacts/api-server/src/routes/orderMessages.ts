import { Router } from "express";
import { db, customersTable, notificationsTable, supportMessagesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { verifyCustomerToken, extractCustomerToken } from "../lib/customerAuth";
import { logger } from "../lib/logger";
import rateLimit from "express-rate-limit";

const router = Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

async function getOrderMessages(orderId: number) {
  const res = await db.execute(
    sql`SELECT id, order_id, sender_type, sender_name, message, attachment_url,
               read_by_admin, read_by_customer, created_at
        FROM order_messages WHERE order_id = ${orderId} ORDER BY created_at ASC`
  );
  return (res as any).rows ?? res ?? [];
}

function requireCustomer(req: any, res: any, next: any) {
  const token = extractCustomerToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  const decoded = verifyCustomerToken(token);
  if (!decoded) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
    return;
  }
  req.customer = decoded;
  next();
}

async function getSupportMessages(customerId: number) {
  const res = await db.execute(
    sql`SELECT id, customer_id, sender_type, sender_name, message,
               read_by_admin, read_by_customer, created_at
        FROM support_messages
        WHERE customer_id = ${customerId}
        ORDER BY created_at ASC`
  );
  return (res as any).rows ?? res ?? [];
}

/* ── Admin: list direct support conversations ─────────────── */
router.get("/admin/messages/conversations", requireAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        MAX(sm.created_at) AS last_message_at,
        COUNT(*) FILTER (WHERE sm.sender_type = 'customer' AND sm.read_by_admin = false) AS unread_count,
        (
          SELECT sm2.message
          FROM support_messages sm2
          WHERE sm2.customer_id = c.id
          ORDER BY sm2.created_at DESC
          LIMIT 1
        ) AS last_message
      FROM support_messages sm
      JOIN customers c ON c.id = sm.customer_id
      GROUP BY c.id, c.name, c.email, c.phone
      ORDER BY MAX(sm.created_at) DESC
      LIMIT 200
    `);
    res.json({ conversations: (result as any).rows ?? result ?? [] });
  } catch (err) {
    logger.error({ err }, "Failed to list support conversations");
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

/* ── Admin: direct support messages for one customer ───────── */
router.get("/admin/messages/customers/:customerId", requireAdmin, async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!customerId) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }
    const messages = await getSupportMessages(customerId);
    await db.execute(sql`
      UPDATE support_messages SET read_by_admin = true
      WHERE customer_id = ${customerId} AND read_by_admin = false
    `);
    res.json({ messages });
  } catch (err) {
    logger.error({ err }, "Failed to load admin support messages");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

router.post("/admin/messages/customers/:customerId", requireAdmin, messageLimiter, async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    const { message } = req.body ?? {};
    if (!customerId) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 chars)" });
      return;
    }
    const inserted = await db.insert(supportMessagesTable).values({
      customerId,
      senderType: "admin",
      senderName: "TryNex Team",
      message: message.trim(),
      readByAdmin: true,
    }).returning();
    await db.insert(notificationsTable).values({
      customerId,
      title: "New Support Message",
      message: "You have a new message from TryNex Team.",
      type: "message",
      link: "/account?tab=messages",
    }).catch(() => undefined);
    res.json({ message: inserted[0] });
  } catch (err) {
    logger.error({ err }, "Failed to send admin support message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ── Customer: direct support chat, no order required ──────── */
router.get("/support/messages/unread-count", requireCustomer, messageLimiter, async (req: any, res) => {
  try {
    const customerId = Number(req.customer.id);
    const result = await db.execute(sql`
      SELECT COUNT(*) AS count
      FROM support_messages
      WHERE customer_id = ${customerId}
        AND sender_type = 'admin'
        AND read_by_customer = false
    `);
    const rows = (result as any).rows ?? result ?? [];
    res.json({ count: Number(rows[0]?.count ?? 0) });
  } catch (err) {
    logger.error({ err }, "Failed to load customer support unread count");
    res.status(500).json({ error: "Failed to load unread count" });
  }
});

router.get("/support/messages", requireCustomer, messageLimiter, async (req: any, res) => {
  try {
    const customerId = Number(req.customer.id);
    const messages = await getSupportMessages(customerId);
    await db.execute(sql`
      UPDATE support_messages SET read_by_customer = true
      WHERE customer_id = ${customerId} AND read_by_customer = false
    `);
    res.json({ messages });
  } catch (err) {
    logger.error({ err }, "Failed to load customer support messages");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

router.post("/support/messages", requireCustomer, messageLimiter, async (req: any, res) => {
  try {
    const customerId = Number(req.customer.id);
    const { message } = req.body ?? {};
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 chars)" });
      return;
    }
    const customerRows = await db
      .select({ name: customersTable.name })
      .from(customersTable)
      .where(sql`${customersTable.id} = ${customerId}`)
      .limit(1);
    const inserted = await db.insert(supportMessagesTable).values({
      customerId,
      senderType: "customer",
      senderName: customerRows[0]?.name ?? "Customer",
      message: message.trim(),
      readByCustomer: true,
    }).returning();
    res.json({ message: inserted[0] });
  } catch (err) {
    logger.error({ err }, "Failed to send customer support message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ── Admin: list messages for an order ──────────────────────── */
router.get("/admin/orders/:id/messages", requireAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const messages = await getOrderMessages(orderId);

    await db.execute(
      sql`UPDATE order_messages SET read_by_admin = true
          WHERE order_id = ${orderId} AND read_by_admin = false`
    );

    res.json({ messages });
  } catch (err) {
    logger.error({ err }, "Failed to list order messages (admin)");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

/* ── Admin: send a message ───────────────────────────────────── */
router.post("/admin/orders/:id/messages", requireAdmin, messageLimiter, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const { message, attachmentUrl } = req.body ?? {};
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 chars)" });
      return;
    }

    const orderCheck = await db.execute(sql`SELECT id, customer_id, order_number FROM orders WHERE id = ${orderId}`);
    const orderRows = (orderCheck as any).rows ?? orderCheck ?? [];
    if (orderRows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const order = orderRows[0];

    const inserted = await db.execute(
      sql`INSERT INTO order_messages (order_id, sender_type, sender_name, message, attachment_url, read_by_admin)
          VALUES (${orderId}, 'admin', 'TryNex Team', ${message.trim()}, ${attachmentUrl ?? null}, true)
          RETURNING *`
    );
    const row = ((inserted as any).rows ?? inserted ?? [])[0];

    if (order.customer_id) {
      try {
        await db.insert(notificationsTable).values({
          customerId: order.customer_id,
          title: "New Message",
          message: `You have a new message from TryNex Team regarding order #${order.order_number}.`,
          type: "message",
          link: `/account`,
        });
      } catch (err) {
        logger.error({ err }, "Failed to create message notification");
      }
    }

    res.json({ message: row });
  } catch (err) {
    logger.error({ err }, "Failed to post admin order message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ── Customer: get messages for their own order ─────────────── */
router.get("/orders/:id/messages", messageLimiter, async (req, res) => {
  try {
    const token = extractCustomerToken(req);
    let customerEmail: string | null = null;
    if (token) {
      try {
        const decoded = verifyCustomerToken(token);
        customerEmail = (decoded as any)?.email ?? null;
      } catch {}
    }

    const orderId = Number(req.params.id);
    if (!orderId) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const orderRes = await db.execute(
      sql`SELECT id, customer_email FROM orders WHERE id = ${orderId}`
    );
    const order = ((orderRes as any).rows ?? orderRes ?? [])[0];
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const { trackEmail } = req.query;
    const effectiveEmail = customerEmail ?? (trackEmail as string | undefined);
    if (!effectiveEmail || order.customer_email !== effectiveEmail) {
      res.status(403).json({ error: "Not authorised to view this order" });
      return;
    }

    const messages = await getOrderMessages(orderId);

    await db.execute(
      sql`UPDATE order_messages SET read_by_customer = true
          WHERE order_id = ${orderId} AND read_by_customer = false`
    );

    res.json({ messages });
  } catch (err) {
    logger.error({ err }, "Failed to list order messages (customer)");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

/* ── Customer: reply to a message ───────────────────────────── */
router.post("/orders/:id/messages", messageLimiter, async (req, res) => {
  try {
    const token = extractCustomerToken(req);
    let customerEmail: string | null = null;
    let customerName: string | null = null;
    if (token) {
      try {
        const decoded = verifyCustomerToken(token) as any;
        customerEmail = decoded?.email ?? null;
        customerName = decoded?.name ?? null;
      } catch {}
    }

    const orderId = Number(req.params.id);
    if (!orderId) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const { message, trackEmail, senderName } = req.body ?? {};
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 chars)" });
      return;
    }

    const effectiveEmail = customerEmail ?? trackEmail;
    if (!effectiveEmail) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    const orderRes = await db.execute(
      sql`SELECT id, customer_email, customer_name FROM orders WHERE id = ${orderId}`
    );
    const order = ((orderRes as any).rows ?? orderRes ?? [])[0];
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (order.customer_email !== effectiveEmail) {
      res.status(403).json({ error: "Not authorised to reply to this order" });
      return;
    }

    const displayName = customerName ?? senderName ?? order.customer_name ?? "Customer";

    const inserted = await db.execute(
      sql`INSERT INTO order_messages (order_id, sender_type, sender_name, message, read_by_customer)
          VALUES (${orderId}, 'customer', ${displayName}, ${message.trim()}, true)
          RETURNING *`
    );
    const row = ((inserted as any).rows ?? inserted ?? [])[0];

    res.json({ message: row });
  } catch (err) {
    logger.error({ err }, "Failed to post customer order message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ── Customer: unread message count across all their orders ─── */
router.get("/orders/my/messages/unread-count", messageLimiter, async (req, res) => {
  try {
    const token = extractCustomerToken(req);
    if (!token) {
      res.json({ count: 0 });
      return;
    }
    let customerEmail: string | null = null;
    try {
      const decoded = verifyCustomerToken(token) as any;
      customerEmail = decoded?.email ?? null;
    } catch {
      res.json({ count: 0 });
      return;
    }
    if (!customerEmail) {
      res.json({ count: 0 });
      return;
    }
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM order_messages om
          JOIN orders o ON o.id = om.order_id
          WHERE o.customer_email = ${customerEmail}
          AND om.sender_type = 'admin'
          AND om.read_by_customer = false`
    );
    const rows = (result as any).rows ?? result ?? [];
    const count = Number(rows[0]?.count ?? 0);
    res.json({ count });
  } catch (err) {
    logger.error({ err }, "Failed to get unread message count");
    res.json({ count: 0 });
  }
});

export default router;
