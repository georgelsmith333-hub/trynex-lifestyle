import { useEffect, useRef, useCallback } from "react";
import { getApiUrl, getAuthHeaders } from "@/lib/utils";

export type AdminStreamEvent =
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

interface UseAdminStreamOptions {
  onEvent: (event: AdminStreamEvent) => void;
  enabled?: boolean;
}

export function useAdminStream({ onEvent, enabled = true }: UseAdminStreamOptions) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const token = sessionStorage.getItem("trynex_admin_token");
    if (!token) return;

    const url = getApiUrl(`/api/admin/events?_t=${Date.now()}`);

    let es: EventSource;
    try {
      es = new EventSource(url, { withCredentials: false });
    } catch {
      return;
    }

    const handleEvent = (eventType: string, e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        onEventRef.current({ type: eventType, payload } as AdminStreamEvent);
      } catch {}
    };

    es.addEventListener("new_order",             (e) => handleEvent("new_order", e as MessageEvent));
    es.addEventListener("order_status_changed",  (e) => handleEvent("order_status_changed", e as MessageEvent));
    es.addEventListener("low_stock",             (e) => handleEvent("low_stock", e as MessageEvent));
    es.addEventListener("ping",                  (e) => handleEvent("ping", e as MessageEvent));

    es.onerror = () => {
      es.close();
      esRef.current = null;
      reconnectTimer.current = setTimeout(connect, 5_000);
    };

    esRef.current = es;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled, connect]);
}
