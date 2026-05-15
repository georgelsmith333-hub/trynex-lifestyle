import React, { useEffect, useRef } from "react";
import { ShoppingCart, TrendingUp, AlertTriangle, X, Package, MapPin, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderNotification {
  id: string;
  type: "new_order" | "order_status_changed" | "low_stock";
  orderNumber?: string;
  customerName?: string;
  shippingDistrict?: string | null;
  total?: number;
  paymentMethod?: string;
  itemCount?: number;
  productName?: string;
  stock?: number;
  status?: string;
  createdAt: number;
}

interface ToastProps {
  notification: OrderNotification;
  onDismiss: (id: string) => void;
}

function formatBDT(amount: number) {
  return `৳${amount.toLocaleString("en-BD")}`;
}

export function OrderNotificationToast({ notification, onDismiss }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(notification.id), 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notification.id, onDismiss]);

  const isNewOrder = notification.type === "new_order";
  const isLowStock = notification.type === "low_stock";
  const isStatusChange = notification.type === "order_status_changed";

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-2xl px-4 py-3.5 shadow-2xl border backdrop-blur-sm",
        "animate-in slide-in-from-right-4 fade-in duration-300",
        "w-80 max-w-full"
      )}
      style={{
        background: isLowStock
          ? "linear-gradient(135deg, #1a0a00, #1f1200)"
          : "linear-gradient(135deg, #0a0f0a, #0d1a0d)",
        borderColor: isLowStock
          ? "rgba(239,68,68,0.25)"
          : isStatusChange
          ? "rgba(99,102,241,0.25)"
          : "rgba(34,197,94,0.25)",
        boxShadow: isLowStock
          ? "0 8px 32px rgba(239,68,68,0.2), 0 0 0 1px rgba(239,68,68,0.1)"
          : "0 8px 32px rgba(34,197,94,0.2), 0 0 0 1px rgba(34,197,94,0.1)",
      }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: isLowStock
            ? "rgba(239,68,68,0.15)"
            : isStatusChange
            ? "rgba(99,102,241,0.15)"
            : "rgba(34,197,94,0.15)",
        }}
      >
        {isNewOrder && <ShoppingCart className="w-4 h-4" style={{ color: "#22c55e" }} />}
        {isStatusChange && <TrendingUp className="w-4 h-4" style={{ color: "#818cf8" }} />}
        {isLowStock && <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444" }} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isNewOrder && (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
              >
                New Order
              </span>
              <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
                {notification.orderNumber}
              </span>
            </div>
            <p className="text-[13px] font-bold text-white leading-tight mb-1.5">
              {notification.customerName}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {notification.total !== undefined && (
                <span className="flex items-center gap-1 text-[12px] font-black" style={{ color: "#22c55e" }}>
                  <CreditCard className="w-3 h-3" />
                  {formatBDT(notification.total)}
                  <span className="text-[10px] font-medium opacity-60">
                    {(notification.paymentMethod || "COD").toUpperCase()}
                  </span>
                </span>
              )}
              {notification.shippingDistrict && (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <MapPin className="w-3 h-3" />
                  {notification.shippingDistrict}
                </span>
              )}
              {notification.itemCount !== undefined && (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <Package className="w-3 h-3" />
                  {notification.itemCount} item{notification.itemCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </>
        )}

        {isStatusChange && (
          <>
            <p className="text-[12px] font-black uppercase tracking-wider mb-1" style={{ color: "#818cf8" }}>
              Order Updated
            </p>
            <p className="text-[13px] font-bold text-white leading-tight">
              {notification.orderNumber}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              Status → <span className="font-bold text-indigo-300">{notification.status}</span>
            </p>
          </>
        )}

        {isLowStock && (
          <>
            <p className="text-[12px] font-black uppercase tracking-wider mb-1" style={{ color: "#ef4444" }}>
              Low Stock Alert
            </p>
            <p className="text-[13px] font-bold text-white leading-tight">
              {notification.productName}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              Only <span className="font-bold text-red-400">{notification.stock}</span> remaining
            </p>
          </>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(notification.id)}
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors mt-0.5"
        style={{ color: "rgba(255,255,255,0.25)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)"; }}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Progress bar auto-dismiss */}
      <div
        className="absolute bottom-0 left-0 h-0.5 rounded-full"
        style={{
          background: isLowStock ? "#ef4444" : isStatusChange ? "#818cf8" : "#22c55e",
          width: "100%",
          animation: "shrink-width 8s linear forwards",
          opacity: 0.4,
          borderBottomLeftRadius: "1rem",
          borderBottomRightRadius: "1rem",
        }}
      />
    </div>
  );
}

export function NotificationStack({
  notifications,
  onDismiss,
}: {
  notifications: OrderNotification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] flex flex-col gap-2.5 pointer-events-none"
      style={{ bottom: "1.5rem", right: "1.5rem", maxHeight: "calc(100vh - 3rem)", overflow: "hidden" }}
    >
      {notifications.map(n => (
        <div key={n.id} className="pointer-events-auto">
          <OrderNotificationToast notification={n} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
