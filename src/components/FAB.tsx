// src/components/FAB.tsx
import React from "react";

export default function FAB({
  apiBase,
  defaultSymbol = "EURUSD",
  onAddSymbol,
  onOrder,                  // NEW
  style = {},
}: {
  apiBase: string;
  defaultSymbol?: string;
  onAddSymbol?: (s: string) => void;
  onOrder?: () => void;     // NEW
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 20,
        ...style,
      }}
    >
      <button
        className="gb-btn gb-solid"
        onClick={() => {
          const s = prompt("Add symbol (e.g. BTCUSD):", defaultSymbol) || "";
          if (s && onAddSymbol) onAddSymbol(s.toUpperCase().replace(/\s+/g, ""));
        }}
      >
        + Symbol
      </button>

      <button
        className="gb-btn"
        style={{
          borderColor: "rgba(212,175,55,.5)",
          background: "rgba(212,175,55,.10)",
        }}
        onClick={() => onOrder?.()}     // NEW
        title="Open Order Ticket"
      >
        Order
      </button>
    </div>
  );
}
