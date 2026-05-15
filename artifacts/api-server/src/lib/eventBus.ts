import { EventEmitter } from "events";

export type AdminEvent =
  | { type: "new_order"; payload: {
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      shippingDistrict: string | null;
      total: number;
      paymentMethod: string;
      itemCount: number;
      createdAt: string;
    }
  }
  | { type: "order_status_changed"; payload: {
      orderNumber: string;
      status: string;
      previousStatus: string;
    }
  }
  | { type: "low_stock"; payload: { productName: string; stock: number } }
  | { type: "ping"; payload: { ts: number } };

class AdminEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  broadcast(event: AdminEvent): void {
    this.emit("event", event);
  }
}

export const adminBus = new AdminEventBus();
